package com.modulo.state;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.plugin.manager.*;
import com.modulo.plugin.registry.*;
import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class PluginStateContractTest {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  PluginStateStore store;
  PluginStateGrantService grants;
  PluginSecurityManager security;
  PluginRegistry registry;
  AuthenticatedUserService users;
  String workload;

  @BeforeAll
  static void schema() throws Exception {
    source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var connection = source.getConnection()) {
      connection.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
      for (String migration :
          List.of("V3__Versioned_plugin_state.sql", "V5__Plugin_state_grants_and_delivery.sql"))
        ScriptUtils.executeSqlScript(
            connection, new ClassPathResource("db/postgresql/" + migration));
    }
  }

  @BeforeEach
  void setup() {
    jdbc = new JdbcTemplate(source);
    jdbc.execute("TRUNCATE users CASCADE");
    jdbc.update("INSERT INTO users VALUES (1),(2)");
    users = mock(AuthenticatedUserService.class);
    when(users.requireUserId()).thenReturn(1L);
    registry = mock(PluginRegistry.class);
    security = new PluginSecurityManager();
    var plugin = new PluginRegistryEntry("external", "1", "EXTERNAL", "grpc");
    plugin.setStatus(PluginStatus.ACTIVE);
    when(registry.getByName("external")).thenReturn(Optional.of(plugin));
    var permissions = new ArrayList<PluginPermissionEntry>();
    for (String permission : List.of("state.read", "state.write")) {
      var entry = new PluginPermissionEntry();
      entry.setPermission(permission);
      entry.setGranted(true);
      permissions.add(entry);
    }
    when(registry.getPluginPermissions("external")).thenReturn(permissions);
    security.grantPermissions("external", List.of("state.read", "state.write"));
    workload = security.generatePluginToken("external");
    var transactions = new DataSourceTransactionManager(source);
    store = new PluginStateStore(jdbc, transactions, users, new ObjectMapper());
    grants = new PluginStateGrantService(jdbc, transactions, users, security, registry);
    store.registerSchema(
        "personal",
        "external",
        "test",
        1,
        "{\"type\":\"object\",\"required\":[\"text\"],\"properties\":{\"text\":{\"type\":\"string\",\"maxLength\":100}},\"additionalProperties\":false}");
  }

  PluginStateGrantService.IssuedGrant grant(String... permissions) {
    return grants.create(
        "personal", new PluginStateGrantService.GrantRequest("external", Set.of(permissions), 300));
  }

  PluginStateStore delegate(PluginStateGrantService.IssuedGrant grant) {
    return grants.delegate(store, workload, grant.token());
  }

  @Test
  void workloadAndOwnerGrantBindNamespacePermissionsAndOwner() {
    var grant = grant("state.read", "state.write");
    var worker = delegate(grant);
    when(users.requireUserId())
        .thenReturn(2L); // Worker never inherits an arbitrary browser account.
    worker.put("personal", "external", "record", 0, "test", 1, "{\"text\":\"private\"}");
    assertEquals(1L, jdbc.queryForObject("SELECT owner_id FROM plugin_state", Long.class));
    assertEquals(
        "private", worker.get("personal", "external", "record").value().get("text").asText());
    assertThrows(ResponseStatusException.class, () -> worker.list("personal", "other", null, 100));
    assertThrows(ResponseStatusException.class, () -> worker.list("shared", "external", null, 100));
    assertThrows(
        ResponseStatusException.class,
        () ->
            grants.delegate(store, "forged", grant.token()).get("personal", "external", "record"));
    assertThrows(
        ResponseStatusException.class,
        () -> grants.delegate(store, workload, "forged").get("personal", "external", "record"));
    assertTrue(store.list("personal", "external", null, 100).records().isEmpty());
    assertEquals(
        "external",
        jdbc.queryForObject("SELECT actor_plugin FROM plugin_state_events", String.class));
  }

  @Test
  void readOnlyGrantCannotWriteAndWriteOnlyConflictsNeverExposeValues() {
    store.put("personal", "external", "record", 0, "test", 1, "{\"text\":\"hidden\"}");
    var reader = delegate(grant("state.read"));
    assertNotNull(reader.get("personal", "external", "record"));
    assertThrows(
        ResponseStatusException.class, () -> reader.delete("personal", "external", "record", 1));
    var writer = delegate(grant("state.write"));
    assertThrows(ResponseStatusException.class, () -> writer.get("personal", "external", "record"));
    var conflict =
        assertThrows(
            PluginStateStore.VersionConflict.class,
            () ->
                writer.put(
                    "personal", "external", "record", 0, "test", 1, "{\"text\":\"replacement\"}"));
    assertNull(conflict.current);
    assertEquals(1, conflict.actualVersion);
  }

  @Test
  void expirationRevocationAndWorkloadPermissionRemovalTakeEffect() {
    var grant = grant("state.read");
    var worker = delegate(grant);
    assertTrue(worker.list("personal", "external", null, 100).records().isEmpty());
    when(users.requireUserId()).thenReturn(2L);
    assertThrows(ResponseStatusException.class, () -> grants.revoke(grant.grant().id()));
    when(users.requireUserId()).thenReturn(1L);
    grants.revoke(grant.grant().id());
    assertThrows(
        ResponseStatusException.class, () -> worker.list("personal", "external", null, 100));
    var expired = grant("state.read");
    jdbc.update(
        "UPDATE plugin_state_grants SET expires_at=CURRENT_TIMESTAMP - interval '1 second' WHERE"
            + " token_hash=?",
        expired.grant().id());
    assertThrows(
        ResponseStatusException.class,
        () -> delegate(expired).list("personal", "external", null, 100));
    var removed = grant("state.read");
    security.revokePermissions("external", List.of("state.read"));
    assertThrows(
        ResponseStatusException.class,
        () -> delegate(removed).list("personal", "external", null, 100));
  }

  @Test
  void schemasAreImmutableNamespacedAndRejectUnknownVersionsAndMalformedValues() {
    assertThrows(
        ResponseStatusException.class,
        () -> store.put("personal", "external", "record", 0, "test", 2, "{\"text\":\"a\"}"));
    assertThrows(
        ResponseStatusException.class,
        () -> store.put("personal", "external", "record", 0, "test", 1, "{\"text\":123}"));
    assertThrows(
        ResponseStatusException.class,
        () ->
            store.put(
                "personal", "external", "record", 0, "test", 1, "{\"text\":\"a\",\"extra\":true}"));
    assertThrows(
        ResponseStatusException.class,
        () -> store.registerSchema("personal", "external", "test", 1, "{}"));
    assertThrows(
        ResponseStatusException.class,
        () ->
            store.registerSchema(
                "personal", "external", "ref", 1, "{\"$ref\":\"https://outside.test/schema\"}"));
    assertThrows(
        ResponseStatusException.class,
        () -> store.registerSchema("personal", "external", "modulo.migration", 1, "{}"));
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM plugin_state_events", Long.class));
    when(users.requireUserId()).thenReturn(2L);
    assertThrows(
        ResponseStatusException.class,
        () -> store.put("personal", "external", "record", 0, "test", 1, "{\"text\":\"a\"}"));
  }

  @Test
  void outboxRetriesMetadataWithoutLeakingDocumentsOrCredentials() throws Exception {
    store.put("personal", "external", "record", 0, "test", 1, "{\"text\":\"secret-value\"}");
    var messaging = mock(SimpMessagingTemplate.class);
    doThrow(new IllegalStateException("unavailable"))
        .doNothing()
        .when(messaging)
        .convertAndSendToUser(eq("1"), eq("/queue/state"), any(Object.class));
    var outbox = new PluginStateOutbox(jdbc, new DataSourceTransactionManager(source), messaging);
    outbox.deliver();
    assertEquals(
        1, jdbc.queryForObject("SELECT delivery_attempts FROM plugin_state_events", Integer.class));
    assertNull(jdbc.queryForObject("SELECT delivered_at FROM plugin_state_events", Object.class));
    outbox.deliver();
    verify(messaging).convertAndSendToUser(eq("1"), eq("/queue/state"), any(Object.class));
    jdbc.update(
        "UPDATE plugin_state_events SET next_attempt_at=CURRENT_TIMESTAMP - interval '1 second'");
    outbox.deliver();
    var event = org.mockito.ArgumentCaptor.forClass(Object.class);
    verify(messaging, times(2)).convertAndSendToUser(eq("1"), eq("/queue/state"), event.capture());
    assertFalse(new ObjectMapper().writeValueAsString(event.getValue()).contains("secret-value"));
    assertNotNull(
        jdbc.queryForObject("SELECT delivered_at FROM plugin_state_events", Object.class));
    assertEquals(1, store.changes("personal", "external", 0, 100).size());
  }

  @Test
  void callbackHttpContractUsesBothTokensAndReturnsMachineReadableDenials() throws Exception {
    var grant = grant("state.read", "state.write");
    var http =
        org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
                new ExternalPluginStateController(store, grants))
            .build();
    String path = "/api/plugin-state/callback/workspaces/personal/external/record";
    http.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path)
                .header("X-Modulo-Plugin-Token", workload)
                .header("X-Modulo-State-Grant", grant.token())
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(
                    "{\"expectedVersion\":0,\"schemaId\":\"test\",\"schemaVersion\":1,\"value\":{\"text\":\"saved\"}}"))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.version")
                .value(1));
    http.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path)
                .header("X-Modulo-Plugin-Token", workload))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.code")
                .value("STATE_ACCESS_DENIED"));
    http.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(
                    path.replace("external", "other"))
                .header("X-Modulo-Plugin-Token", workload)
                .header("X-Modulo-State-Grant", grant.token()))
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.status()
                .isNotFound());
  }

  @Test
  void structuredSchemasValidateNestedTypesBoundsAndEnums() {
    store.registerSchema(
        "personal",
        "external",
        "tasks",
        1,
        "{\"type\":\"array\",\"maxItems\":2,\"items\":{\"type\":\"object\",\"required\":[\"title\",\"priority\",\"status\"],\"additionalProperties\":false,\"properties\":{\"title\":{\"type\":\"string\",\"minLength\":1},\"priority\":{\"type\":\"integer\",\"minimum\":0,\"maximum\":3},\"status\":{\"enum\":[\"open\",\"done\"]}}}}");
    String valid = "[{\"title\":\"Task\",\"priority\":2,\"status\":\"open\"}]";
    store.put("personal", "external", "tasks", 0, "tasks", 1, valid);
    for (String invalid :
        List.of(
            valid.replace(":2", ":4"),
            valid.replace(":2", ":1.5"),
            valid.replace("Task", ""),
            valid.replace("open", "unknown")))
      assertThrows(
          ResponseStatusException.class,
          () -> store.put("personal", "external", "tasks", 1, "tasks", 1, invalid));
    assertEquals(1, store.get("personal", "external", "tasks").version());
  }

  @Test
  void shippedConsumerSchemasRemainWritableInTheirBoundNamespaces() {
    store.put(
        "personal",
        "canvas-board",
        "board.a",
        0,
        "modulo.canvas.board",
        1,
        "{\"id\":\"a\",\"name\":\"Board\",\"cards\":[],\"connections\":[]}");
    store.put(
        "personal", "canvas-board", "active-board", 0, "modulo.canvas.preference", 1, "\"a\"");
    store.put(
        "personal",
        "notion-database",
        "database.a",
        0,
        "modulo.embedded-database",
        1,
        "{\"id\":\"a\",\"title\":\"DB\",\"columns\":[],\"rows\":[]}");
    store.put("personal", "saved-searches", "queries", 0, "modulo.saved-searches", 1, "[]");
    store.put(
        "personal",
        "workspace-settings",
        "installed",
        0,
        "modulo.workspace.installations",
        1,
        "[{\"id\":\"notes\",\"enabled\":true}]");
    store.put(
        "personal",
        "workspace-settings",
        "tab.productivity",
        0,
        "modulo.workspace.hub-tab",
        1,
        "\"planner\"");
    store.put("personal", "canvas-board", "migration", 0, "modulo.migration", 1, "{}");
    assertEquals(7L, jdbc.queryForObject("SELECT count(*) FROM plugin_state", Long.class));
    assertThrows(
        ResponseStatusException.class,
        () ->
            store.put(
                "personal", "external", "pretend", 0, "modulo.canvas.preference", 1, "\"a\""));
  }

  @Test
  void inactiveWorkloadsAndDurablePermissionRevocationDenyDelegation() {
    var issued = grant("state.read");
    registry.getByName("external").orElseThrow().setStatus(PluginStatus.INACTIVE);
    assertThrows(
        ResponseStatusException.class,
        () -> delegate(issued).list("personal", "external", null, 100));
    registry.getByName("external").orElseThrow().setStatus(PluginStatus.ACTIVE);
    registry.getPluginPermissions("external").forEach(permission -> permission.setGranted(false));
    assertThrows(
        ResponseStatusException.class,
        () -> delegate(issued).list("personal", "external", null, 100));
    assertThrows(ResponseStatusException.class, () -> grant("state.read"));
  }

  @Test
  void grantAndEventBudgetsCannotBeBypassedByAnotherNamespace() {
    jdbc.update(
        "INSERT INTO"
            + " plugin_state_grants(token_hash,owner_id,workspace_id,namespace,plugin_id,can_read,can_write,expires_at)"
            + " SELECT"
            + " lpad(i::text,64,'0'),1,'personal','external','external',true,false,CURRENT_TIMESTAMP+interval"
            + " '1 hour' FROM generate_series(1,100) i");
    var quota = assertThrows(ResponseStatusException.class, () -> grant("state.read"));
    assertEquals(429, quota.getRawStatusCode());
    when(users.requireUserId()).thenReturn(2L);
    assertNotNull(grant("state.read"));
    when(users.requireUserId()).thenReturn(1L);
    jdbc.update(
        "INSERT INTO"
            + " plugin_state_events(owner_id,workspace_id,namespace,state_key,operation,version)"
            + " SELECT 1,'personal','old','retained','update',i FROM generate_series(1,100000) i");
    var events =
        assertThrows(
            ResponseStatusException.class,
            () -> store.put("personal", "external", "record", 0, "test", 1, "{\"text\":\"a\"}"));
    assertEquals("STATE_EVENT_QUOTA_EXCEEDED", events.getReason());
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM plugin_state", Long.class));
  }
}
