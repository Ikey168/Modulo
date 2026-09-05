package com.modulo.state;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Testcontainers
class PluginStateStoreTest {
    @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
    private static DriverManagerDataSource dataSource;
    private JdbcTemplate jdbc;
    private AuthenticatedUserService users;
    private PluginStateStore store;
    private final ThreadLocal<Long> owner = ThreadLocal.withInitial(() -> 1L);

    @BeforeAll static void schema() throws Exception {
        dataSource = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
        try (var connection = dataSource.getConnection()) {
            connection.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
            ScriptUtils.executeSqlScript(connection,
                    new ClassPathResource("db/postgresql/V3__Versioned_plugin_state.sql"));
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/postgresql/V5__Plugin_state_grants_and_delivery.sql"));
            ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/postgresql/V6__State_storage_generation.sql"));
        }
    }
    @BeforeEach void setup() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("TRUNCATE plugin_state_events,plugin_state,users RESTART IDENTITY CASCADE");
        jdbc.update("INSERT INTO users(id) VALUES (1),(2)");
        users = mock(AuthenticatedUserService.class);
        when(users.requireUserId()).thenAnswer(call -> owner.get());
        store = store(PluginStateStore.Limits.defaults());
        for(long id:List.of(1L,2L)) {
            owner.set(id);
            store.registerSchema("personal","canvas","test",1,"{}");
            store.registerSchema("personal","other","test",1,"{}");
        }
        owner.set(1L);
    }
    @AfterEach void cleanup() { owner.remove(); }
    private PluginStateStore store(PluginStateStore.Limits limits) {
        return new PluginStateStore(jdbc, new DataSourceTransactionManager(dataSource), users,
                new ObjectMapper(), limits);
    }
    private PluginStateStore.StateRecord put(String key, long version, String value) {
        return store.put("personal", "canvas", key, version, "test", 1, value);
    }

    @Test void roundTripCreateUpdateDeleteAndRecreatePreservesMonotonicVersion() {
        assertEquals(1, put("a", 0, "{\"cards\":[]}").version());
        assertEquals(2, put("a", 1, "{\"cards\":[1]}").version());
        assertEquals(1, store.get("personal", "canvas", "a").value().get("cards").size());
        assertEquals(3, store.delete("personal", "canvas", "a", 2).version());
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "canvas", "a"));
        assertThrows(PluginStateStore.VersionConflict.class, () -> put("a", 0, "{}"));
        assertEquals(4, put("a", 3, "{}").version());
        assertEquals(List.of("create", "update", "delete", "update"),
                store.changes("personal", "canvas", 0, 100).stream().map(PluginStateStore.Change::operation).toList());
    }
    @Test void jsonNullIsDifferentFromTombstoneAndMissing() {
        assertTrue(put("null", 0, "null").value().isNull());
        assertFalse(store.get("personal", "canvas", "null").deleted());
        assertNull(store.delete("personal", "canvas", "null", 1).value());
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "canvas", "absent"));
    }
    @Test void secondOwnerCannotReadListUpdateDeleteOrObserveFirstOwner() {
        put("private", 0, "{\"secret\":true}");
        owner.set(2L);
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "canvas", "private"));
        assertTrue(store.list("personal", "canvas", null, 100).records().isEmpty());
        assertTrue(store.changes("personal", "canvas", 0, 100).isEmpty());
        var conflict = assertThrows(PluginStateStore.VersionConflict.class, () -> put("private", 1, "{}"));
        assertEquals(0, conflict.actualVersion);
        assertNull(conflict.current);
        assertThrows(PluginStateStore.VersionConflict.class,
                () -> store.delete("personal", "canvas", "private", 1));
        assertEquals(1, put("private", 0, "{\"mine\":true}").version());
        owner.set(1L);
        assertTrue(store.get("personal", "canvas", "private").value().get("secret").asBoolean());
    }
    @Test void staleWritesReturnCurrentAuthorizedVersionWithoutMutation() {
        put("a", 0, "1");
        put("a", 1, "2");
        var failure = assertThrows(PluginStateStore.VersionConflict.class, () -> put("a", 1, "3"));
        assertEquals(1, failure.expectedVersion);
        assertEquals(2, failure.actualVersion);
        assertEquals(2, failure.current.value().asInt());
        assertEquals(2, store.changes("personal", "canvas", 0, 100).size());
    }
    @Test void simultaneousCreatesHaveExactlyOneWinner() throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> write = () -> {
                try { put("race", 0, "{}"); return true; }
                catch (PluginStateStore.VersionConflict expected) { return false; }
            };
            var results = executor.invokeAll(List.of(write, write));
            assertNotEquals(results.get(0).get(), results.get(1).get());
            assertEquals(1, store.get("personal", "canvas", "race").version());
            assertEquals(1, store.changes("personal", "canvas", 0, 100).size());
        } finally { executor.shutdownNow(); }
    }
    @Test void quotasCannotBeBypassedByConcurrentCreatesOrTombstoneChurn() throws Exception {
        store = store(new PluginStateStore.Limits(100, 1, 100, 100));
        var executor = Executors.newFixedThreadPool(2);
        try {
            var results = executor.invokeAll(List.<Callable<Boolean>>of(
                    () -> tryQuotaWrite("a"), () -> tryQuotaWrite("b")));
            assertNotEquals(results.get(0).get(), results.get(1).get());
            String key = store.list("personal", "canvas", null, 10).records().get(0).key();
            store.delete("personal", "canvas", key, 1);
            assertStatus(HttpStatus.TOO_MANY_REQUESTS, () -> put("new", 0, "{}"));
            assertEquals(3, put(key, 2, "{}").version());
        } finally { executor.shutdownNow(); }
    }
    private boolean tryQuotaWrite(String key) {
        try { put(key, 0, "{}"); return true; }
        catch (ResponseStatusException e) { assertEquals(HttpStatus.TOO_MANY_REQUESTS, e.getStatus()); return false; }
    }
    @Test void byteQuotaAppliesAcrossNamespacesAndReclaimsReplacedPayloads() {
        store = store(new PluginStateStore.Limits(100, 10, 100, 8));
        put("a", 0, "\"1234\""); // six UTF-8 bytes
        assertStatus(HttpStatus.TOO_MANY_REQUESTS, () -> store.put(
                "personal", "other", "b", 0, "test", 1, "\"12\""));
        put("a", 1, "0");
        store.put("personal", "other", "b", 0, "test", 1, "\"12\"");
        assertEquals(1, store.list("personal", "other", null, 100).records().size());
    }
    @Test void malformedDuplicateTrailingAndDeepJsonCannotMutate() {
        for (String value : List.of("", "{", "{} {}", "{\"x\":1,\"x\":2}", "[".repeat(65) + "0" + "]".repeat(65))) {
            assertStatus(HttpStatus.BAD_REQUEST, () -> put("a", 0, value));
        }
        assertTrue(store.list("personal", "canvas", null, 100).records().isEmpty());
        assertTrue(store.changes("personal", "canvas", 0, 100).isEmpty());
    }
    @Test void payloadLimitCountsUtf8BytesAndRejectsBeforeMutation() {
        store = store(new PluginStateStore.Limits(7, 10, 100, 100));
        assertStatus(HttpStatus.PAYLOAD_TOO_LARGE, () -> put("a", 0, "\"ééé\""));
        assertTrue(store.list("personal", "canvas", null, 100).records().isEmpty());
    }
    @Test void namespaceTraversalReservedNamespaceAndUnknownWorkspaceAreDenied() {
        for (String namespace : List.of("..", "../canvas", "a/b", "%2F", "", ".", "a\\b")) {
            assertStatus(HttpStatus.BAD_REQUEST, () -> store.get("personal", namespace, "a"));
        }
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("other-workspace", "canvas", "a"));
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "core.plugins", "a"));
        assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "core", "a"));
    }
    @Test void paginationAndChangeCursorStayWithinNamespaceAndOwner() {
        put("a", 0, "1"); put("b", 0, "2"); put("c", 0, "3");
        var page = store.list("personal", "canvas", null, 2);
        assertEquals(List.of("a", "b"), page.records().stream().map(PluginStateStore.StateRecord::key).toList());
        assertEquals("b", page.nextCursor());
        var next = store.list("personal", "canvas", page.nextCursor(), 2);
        assertEquals(List.of("c"), next.records().stream().map(PluginStateStore.StateRecord::key).toList());
        assertNull(next.nextCursor());
        long cursor = store.changes("personal", "canvas", 0, 1).get(0).id();
        assertEquals(2, store.changes("personal", "canvas", cursor, 100).size());
        assertTrue(store.changes("personal", "other", cursor, 100).isEmpty());
        owner.set(2L);
        assertTrue(store.list("personal", "canvas", "b", 2).records().isEmpty());
    }
    @Test void failedAuditInsertRollsBackTheStateMutation() {
        jdbc.execute("ALTER TABLE plugin_state_events ADD CONSTRAINT reject_event CHECK (operation <> 'create')");
        try {
            assertThrows(Exception.class, () -> put("a", 0, "{}"));
            assertStatus(HttpStatus.NOT_FOUND, () -> store.get("personal", "canvas", "a"));
        } finally { jdbc.execute("ALTER TABLE plugin_state_events DROP CONSTRAINT reject_event"); }
    }
    @Test void httpCrudReturnsEtagsAndMachineReadableConflicts() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new PluginStateController(store))
                .defaultRequest(get("/").header("X-Modulo-State-Generation", jdbc.queryForObject("SELECT generation::text FROM plugin_state_storage", String.class))).build();
        String endpoint = "/api/workspaces/personal/plugin-state/canvas/http";
        String body = "{\"expectedVersion\":0,\"schemaId\":\"test\",\"schemaVersion\":1,\"value\":{\"x\":1}}";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(endpoint)
                .contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(header().string("ETag", "\"1\""))
                .andExpect(jsonPath("$.value.x").value(1));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(endpoint)
                .contentType("application/json").content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STATE_VERSION_CONFLICT"))
                .andExpect(jsonPath("$.actualVersion").value(1));
        mvc.perform(get(endpoint)).andExpect(status().isOk());
        mvc.perform(delete(endpoint).param("expectedVersion", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.deleted").value(true));
        mvc.perform(get(endpoint)).andExpect(status().isNotFound());
    }
    @Test void httpRejectsMissingVersionDuplicatesInvalidUtf8AndOversizedBody() throws Exception {
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new PluginStateController(store))
                .defaultRequest(get("/").header("X-Modulo-State-Generation", jdbc.queryForObject("SELECT generation::text FROM plugin_state_storage", String.class))).build();
        String endpoint = "/api/workspaces/personal/plugin-state/canvas/http";
        for (String body : List.of("{}", "{\"expectedVersion\":0,\"schemaId\":\"s\",\"schemaVersion\":1,\"value\":{\"a\":1,\"a\":2}}")) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(endpoint)
                    .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(endpoint)
                .contentType("application/json").content(new byte[]{(byte) 0xc3, 0x28}))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("STATE_INVALID_UTF8"));
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(endpoint)
                .contentType("application/json").content(" ".repeat(1_048_576 + 4097)))
                .andExpect(status().isPayloadTooLarge());
        assertTrue(store.changes("personal", "canvas", 0, 100).isEmpty());
    }
    @Test void httpUnknownAccountCannotReadState() throws Exception {
        put("private", 0, "1");
        when(users.requireUserId()).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "unprovisioned"));
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new PluginStateController(store))
                .defaultRequest(get("/").header("X-Modulo-State-Generation", jdbc.queryForObject("SELECT generation::text FROM plugin_state_storage", String.class))).build();
        mvc.perform(get("/api/workspaces/personal/plugin-state/canvas/private"))
                .andExpect(status().isForbidden());
    }
    private void assertStatus(HttpStatus expected, Runnable action) {
        assertEquals(expected, assertThrows(ResponseStatusException.class, action::run).getStatus());
    }
}
