package com.modulo.blueprint.execution;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.*;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class WorkflowRunServiceTest {
  @Container
  static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  WorkflowRunService runs;
  BlueprintRepository blueprints;
  AuthenticatedUserService owner;

  @BeforeAll
  static void schema() throws Exception {
    source = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var c = source.getConnection()) {
      c.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
      c.createStatement()
          .execute(
              "CREATE TABLE plugin_registry(id BIGSERIAL PRIMARY KEY,name TEXT UNIQUE,version"
                  + " TEXT,description TEXT,author TEXT,type TEXT,runtime TEXT,status TEXT,config"
                  + " JSONB,created_at TIMESTAMP DEFAULT NOW(),updated_at TIMESTAMP DEFAULT"
                  + " NOW())");
      c.createStatement()
          .execute(
              "CREATE TABLE plugin_execution_logs(id BIGSERIAL PRIMARY KEY,plugin_id"
                  + " BIGINT,execution_type TEXT,status TEXT,message TEXT,execution_time_ms"
                  + " BIGINT,created_at TIMESTAMP DEFAULT NOW())");
      c.createStatement()
          .execute(
              new String(
                  new ClassPathResource("db/postgresql/V7__Structured_workflow_runs.sql")
                      .getInputStream()
                      .readAllBytes(),
                  java.nio.charset.StandardCharsets.UTF_8));
      c.createStatement().execute("ALTER TABLE workflow_steps ADD COLUMN duration_ms BIGINT CHECK(duration_ms>=0)");
    }
  }

  @BeforeEach
  void setup() {
    jdbc = new JdbcTemplate(source);
    jdbc.execute("TRUNCATE users,plugin_registry,plugin_execution_logs CASCADE");
    jdbc.update("INSERT INTO users VALUES (1),(2)");
    var users = mock(UserRepository.class);
    var user = new User();
    user.setId(1L);
    user.setUsername("alice");
    when(users.findById(1L)).thenReturn(Optional.of(user));
    runs = new WorkflowRunService(jdbc, new DataSourceTransactionManager(source), users);
    owner = mock(AuthenticatedUserService.class);
    when(owner.requireUserId()).thenReturn(1L);
    blueprints = new BlueprintRepository();
    ReflectionTestUtils.setField(blueprints, "jdbc", jdbc);
    ReflectionTestUtils.setField(blueprints, "objectMapper", new ObjectMapper());
    ReflectionTestUtils.setField(blueprints, "users", owner);
  }

  BlueprintEntry blueprint(String name) {
    var request = new BlueprintSaveRequest();
    request.setName(name);
    request.setIr(Map.of("irVersion", 1, "nodes", List.of(), "edges", List.of()));
    return blueprints.create(request, "forged-actor");
  }

  WorkflowRunService.Lease create(long id, String event) {
    return runs.create(id, 1, "1", "a".repeat(64), "trigger", "trigger.note.saved", event);
  }

  @Test
  void duplicateTriggerCreatesExactlyOneRunUnderConcurrency() throws Exception {
    long id = blueprint("same").getId();
    var pool = Executors.newFixedThreadPool(4);
    try {
      var jobs = new ArrayList<Future<WorkflowRunService.Lease>>();
      for (int i = 0; i < 8; i++) jobs.add(pool.submit(() -> create(id, "event")));
      var leases = new ArrayList<WorkflowRunService.Lease>();
      for (var job : jobs) leases.add(job.get(10, TimeUnit.SECONDS));
      assertEquals(1, leases.stream().filter(WorkflowRunService.Lease::created).count());
      assertEquals(1, leases.stream().map(WorkflowRunService.Lease::id).distinct().count());
      assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM workflow_runs", Long.class));
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  void orderedStepsHaveBoundedMetadataAndTerminalStatesCannotRegress() {
    var lease = create(blueprint("ordered").getId(), "event");
    runs.begin(lease);
    var first =
        runs.startStep(
            lease,
            1,
            "trigger",
            "trigger.note.saved",
            Map.of("token", "NEVER-STORE-THIS", "note", Map.of("content", "PRIVATE-CONTENT")));
    runs.finishStep(lease, first, "SUCCEEDED", Map.of("output", "PRIVATE-OUTPUT"), null);
    var second = runs.startStep(lease, 2, "action", "logic.branch", Map.of());
    runs.finishStep(lease, second, "FAILED", Map.of(), "NODE_FAILURE");
    runs.transition(lease, "RUNNING", "FAILED", "NODE_FAILURE");
    assertEquals(
        List.of(1, 2),
        jdbc.queryForList("SELECT sequence FROM workflow_steps ORDER BY sequence", Integer.class));
    String metadata =
        jdbc.queryForObject(
            "SELECT input_metadata::text || output_metadata::text FROM workflow_steps WHERE id=?",
            String.class,
            first);
    assertFalse(metadata.contains("NEVER"));
    assertFalse(metadata.contains("PRIVATE"));
    assertTrue(metadata.contains("fields"));
    assertThrows(Exception.class, () -> runs.transition(lease, "FAILED", "RUNNING", null));
    assertEquals(
        "FAILED",
        jdbc.queryForObject(
            "SELECT state FROM workflow_runs WHERE id=?", String.class, lease.id()));
    assertThrows(
        Exception.class,
        () ->
            jdbc.update(
                "UPDATE workflow_steps SET input_metadata=CAST(? AS jsonb) WHERE id=?",
                "{\"huge\":\"" + "x".repeat(5000) + "\"}",
                first));
  }

  @Test
  void waitingAndRetryAttemptsPreserveOrderedStepHistory() {
    var lease = create(blueprint("retry").getId(), "event");
    runs.begin(lease);
    var first = runs.startStep(lease, 1, "node", "action.external", Map.of());
    runs.finishStep(lease, first, "RETRY_WAIT", Map.of(), "TRANSIENT");
    runs.transition(lease, "RUNNING", "RETRY_WAIT", "TRANSIENT");
    runs.transition(lease, "RETRY_WAIT", "RUNNING", null);
    var retry = runs.startStep(lease, 1, "node", "action.external", Map.of());
    runs.finishStep(lease, retry, "SUCCEEDED", Map.of(), null);
    runs.transition(lease, "RUNNING", "WAITING", null);
    runs.transition(lease, "WAITING", "RUNNING", null);
    runs.transition(lease, "RUNNING", "SUCCEEDED", null);
    assertEquals(
        List.of(1, 2),
        jdbc.queryForList("SELECT attempt FROM workflow_steps ORDER BY attempt", Integer.class));
    assertEquals(2, jdbc.queryForObject("SELECT attempt FROM workflow_runs", Integer.class));
  }

  @Test
  void ownerIsolationAllowsSameDisplayNameAndPreservesLegacyLogs() {
    var alice = blueprint("shared-name");
    when(owner.requireUserId()).thenReturn(2L);
    assertTrue(blueprints.findAll().isEmpty());
    assertTrue(blueprints.findByName("shared-name").isEmpty());
    var bob = blueprint("shared-name");
    assertNotEquals(alice.getId(), bob.getId());
    assertEquals(bob.getId(), blueprints.findByName("shared-name").orElseThrow().getId());
    jdbc.update(
        "INSERT INTO plugin_execution_logs(plugin_id,execution_type,status,message) VALUES"
            + " (?,'event_handle','success','legacy [nodes=one,two]')",
        alice.getId());
    assertTrue(blueprints.findExecutions(alice.getId(), 20).isEmpty());
    when(owner.requireUserId()).thenReturn(1L);
    assertEquals(
        List.of("one", "two"),
        blueprints.findExecutions(alice.getId(), 20).get(0).getExecutedNodes());
    assertThrows(
        ResponseStatusException.class,
        () ->
            runs.create(
                alice.getId(), 2, "1", "a".repeat(64), "trigger", "trigger.note.saved", "forged"));
  }

  @Test
  void retentionCascadesStepsButKeepsWaitingRunsAndLegacyLogs() {
    var bp = blueprint("retention");
    var lease = create(bp.getId(), "done");
    runs.begin(lease);
    var step = runs.startStep(lease, 1, "node", "logic.branch", Map.of());
    runs.finishStep(lease, step, "SUCCEEDED", Map.of(), null);
    runs.transition(lease, "RUNNING", "SUCCEEDED", null);
    var waiting = create(bp.getId(), "wait");
    runs.begin(waiting);
    runs.transition(waiting, "RUNNING", "WAITING", null);
    jdbc.update("UPDATE workflow_runs SET retain_until=CURRENT_TIMESTAMP - interval '1 day'");
    jdbc.update(
        "INSERT INTO plugin_execution_logs(plugin_id,message) VALUES (?,'legacy')", bp.getId());
    assertEquals(1, runs.pruneExpired());
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM workflow_steps", Long.class));
    assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM workflow_runs", Long.class));
    assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM plugin_execution_logs", Long.class));
    jdbc.update("DELETE FROM plugin_registry WHERE id=?", bp.getId());
    assertNull(jdbc.queryForObject("SELECT blueprint_id FROM workflow_runs", Long.class));
    jdbc.update("DELETE FROM users WHERE id=1");
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM workflow_runs", Long.class));
  }

  @Test
  void executionIdentityIsRestoredEvenWhenAnActionFails() {
    var lease = create(blueprint("identity").getId(), "event");
    var original = SecurityContextHolder.getContext();
    assertThrows(
        IllegalStateException.class,
        () ->
            runs.asOwner(
                lease,
                () -> {
                  assertEquals(
                      "alice", SecurityContextHolder.getContext().getAuthentication().getName());
                  throw new IllegalStateException();
                }));
    assertSame(original, SecurityContextHolder.getContext());
  }

  @Test
  void actualTriggerCreatesOrderedStepsOnceAndRejectsAnotherOwnersEvent() throws Exception {
    var request = new BlueprintSaveRequest();
    request.setName("triggered");
    request.setIr(
        Map.of(
            "irVersion",
            1,
            "nodes",
            List.of(
                Map.of("id", "trigger", "type", "trigger.note.saved", "nodeVersion", 1),
                Map.of("id", "branch", "type", "logic.branch", "nodeVersion", 1)),
            "edges",
            List.of(
                Map.of(
                    "id",
                    "edge",
                    "kind",
                    "exec",
                    "fromNode",
                    "trigger",
                    "fromPin",
                    "then",
                    "toNode",
                    "branch",
                    "toPin",
                    "in"))));
    var blueprint = blueprints.create(request, "ignored");
    var interpreter = new com.modulo.blueprint.interpreter.BlueprintInterpreterService();
    var bus = mock(com.modulo.plugin.event.PluginEventBus.class);
    var listeners =
        new HashMap<
            String,
            com.modulo.plugin.event.PluginEventListener<com.modulo.plugin.event.NoteEvent>>();
    doAnswer(
            call -> {
              listeners.put(call.getArgument(0), call.getArgument(1));
              return null;
            })
        .when(bus)
        .subscribe(anyString(), any(com.modulo.plugin.event.PluginEventListener.class));
    ReflectionTestUtils.setField(interpreter, "workflowRuns", runs);
    ReflectionTestUtils.setField(interpreter, "eventBus", bus);
    ReflectionTestUtils.setField(interpreter, "objectMapper", new ObjectMapper());
    interpreter.registerBlueprint(blueprint);
    var note = new com.modulo.entity.Note();
    note.setUserId(2L);
    note.setId(22L);
    listeners
        .get("note.created")
        .handleEvent(new com.modulo.plugin.event.NoteEvent.NoteCreated(note));
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM workflow_runs", Long.class));
    note.setUserId(1L);
    var event = new com.modulo.plugin.event.NoteEvent.NoteCreated(note);
    listeners.get("note.created").handleEvent(event);
    listeners.get("note.created").handleEvent(event);
    assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM workflow_runs", Long.class));
    assertEquals("SUCCEEDED", jdbc.queryForObject("SELECT state FROM workflow_runs", String.class));
    assertEquals(
        List.of("trigger", "branch"),
        jdbc.queryForList("SELECT node_id FROM workflow_steps ORDER BY sequence", String.class));
    assertEquals(
        event.getId(), jdbc.queryForObject("SELECT trigger_key FROM workflow_runs", String.class));
    var history = blueprints.findExecutions(blueprint.getId(), 10);
    assertEquals(1, history.size());
    assertNotNull(history.get(0).getRunId());
    assertEquals(List.of("trigger", "branch"), history.get(0).getExecutedNodes());
    interpreter.unregisterBlueprint(Long.toString(blueprint.getId()));
  }
}
