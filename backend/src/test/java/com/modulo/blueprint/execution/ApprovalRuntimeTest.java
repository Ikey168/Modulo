package com.modulo.blueprint.execution;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.*;
import com.modulo.blueprint.approval.ApprovalService;
import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.entity.Note;
import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.security.AuthenticatedUserService;
import com.modulo.service.NoteService;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

@Testcontainers
class ApprovalRuntimeTest {
  @Container
  static final PostgreSQLContainer<?> database = new PostgreSQLContainer<>("postgres:16-alpine");

  static DriverManagerDataSource source;
  JdbcTemplate jdbc;
  WorkflowRunService runs;
  ApprovalService approvals;
  WorkflowCheckpointService checkpoints;
  NoteService notes;
  BlueprintEntry entry;
  ObjectMapper json = new ObjectMapper();

  @BeforeAll
  static void migrate() {
    source =
        new DriverManagerDataSource(
            database.getJdbcUrl(), database.getUsername(), database.getPassword());
    Flyway.configure().dataSource(source).locations("classpath:db/postgresql").load().migrate();
  }

  @BeforeEach
  void setup() {
    jdbc = new JdbcTemplate(source);
    jdbc.execute("TRUNCATE users,plugin_registry,approval_signing_keys CASCADE");
    jdbc.update("INSERT INTO users(id,username) VALUES(1,'owner'),(2,'reviewer'),(3,'other')");
    var users = mock(UserRepository.class);
    when(users.findById(anyLong()))
        .thenAnswer(
            call -> {
              var user = new User();
              user.setId(call.getArgument(0));
              user.setUsername("owner");
              return Optional.of(user);
            });
    var manager = new DataSourceTransactionManager(source);
    runs = new WorkflowRunService(jdbc, manager, users);
    notes = mock(NoteService.class);
    checkpoints = new WorkflowCheckpointService(jdbc, json, notes);
    approvals =
        new ApprovalService(
            jdbc,
            manager,
            json,
            new TracePolicy(""),
            runs,
            notes,
            new com.modulo.blueprint.approval.ApprovalSigningService(jdbc, json, "", "", false));
    var owner = mock(AuthenticatedUserService.class);
    when(owner.requireUserId()).thenReturn(1L);
    var repository = new BlueprintRepository();
    ReflectionTestUtils.setField(repository, "jdbc", jdbc);
    ReflectionTestUtils.setField(repository, "objectMapper", json);
    ReflectionTestUtils.setField(repository, "users", owner);
    var request = new BlueprintSaveRequest();
    request.setName("Approval sample");
    request.setIr(graph());
    entry = repository.create(request, "ignored");
    jdbc.update(
        "INSERT INTO plugin_permissions(plugin_id,permission,granted)"
            + " VALUES(?,'approval:request',true)",
        entry.getId());
    var note = new Note();
    note.setId(10L);
    note.setUserId(1L);
    when(notes.save(any())).thenReturn(note);
  }

  Map<String, Object> graph() {
    return Map.of(
        "irVersion",
        1,
        "nodes",
        List.of(
            Map.of(
                "id",
                "trigger",
                "type",
                "trigger.webhook",
                "config",
                Map.of("secret", "test-secret")),
            Map.of(
                "id",
                "request",
                "type",
                "action.approval.request",
                "config",
                Map.of("approverUserId", "2", "expirySeconds", 3600)),
            Map.of("id", "wait", "type", "logic.approval.wait"),
            Map.of("id", "result", "type", "logic.approval.result"),
            Map.of("id", "write", "type", "action.note.create")),
        "edges",
        List.of(
            edge("exec", "trigger", "then", "request", "in"),
            edge("exec", "request", "then", "wait", "in"),
            edge("exec", "wait", "then", "result", "in"),
            edge("exec", "result", "approved", "write", "in"),
            edge("data", "trigger", "payload", "request", "context"),
            edge("data", "request", "request", "wait", "request"),
            edge("data", "wait", "request", "result", "request")));
  }

  Map<String, String> edge(String kind, String from, String out, String to, String in) {
    return Map.of("kind", kind, "fromNode", from, "fromPin", out, "toNode", to, "toPin", in);
  }

  BlueprintInterpreterService interpreter() {
    var value = new BlueprintInterpreterService();
    ReflectionTestUtils.setField(value, "workflowRuns", runs);
    ReflectionTestUtils.setField(value, "checkpoints", checkpoints);
    ReflectionTestUtils.setField(value, "approvals", approvals);
    ReflectionTestUtils.setField(value, "objectMapper", json);
    ReflectionTestUtils.setField(
        value, "eventBus", mock(com.modulo.plugin.event.PluginEventBus.class));
    ReflectionTestUtils.setField(value, "noteService", notes);
    var capabilities = mock(BlueprintCapabilityService.class);
    when(capabilities.isGranted(anyLong(), anyString())).thenReturn(true);
    ReflectionTestUtils.setField(value, "capabilityService", capabilities);
    return value;
  }

  UUID pending() {
    var interpreter = interpreter();
    interpreter.registerBlueprint(entry);
    interpreter.fireWebhook(entry.getId(), "trigger", "test-secret", "PRIVATE_PAYLOAD", "event");
    assertEquals("WAITING", jdbc.queryForObject("SELECT state FROM workflow_runs", String.class));
    return jdbc.queryForObject("SELECT id FROM approval_requests", UUID.class);
  }

  ApprovalService.DecisionInput decision(String outcome) {
    return new ApprovalService.DecisionInput(1, UUID.randomUUID(), outcome, "Reviewed.");
  }

  UUID run() {
    return jdbc.queryForObject(
        "SELECT run_ref FROM approval_requests ORDER BY created_at LIMIT 1", UUID.class);
  }

  @org.junit.jupiter.api.io.TempDir java.nio.file.Path keyDirectory;

  private com.modulo.blueprint.approval.ApprovalSigningService configureSigning(String name)
      throws Exception {
    var pair = java.security.KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
    var secret = keyDirectory.resolve(name + ".pk8");
    var visible = keyDirectory.resolve(name + ".spki");
    java.nio.file.Files.write(secret, pair.getPrivate().getEncoded());
    java.nio.file.Files.write(visible, pair.getPublic().getEncoded());
    var signing =
        new com.modulo.blueprint.approval.ApprovalSigningService(
            jdbc, json, secret.toString(), visible.toString(), true);
    approvals =
        new ApprovalService(
            jdbc,
            new DataSourceTransactionManager(source),
            json,
            new TracePolicy(""),
            runs,
            notes,
            signing);
    return signing;
  }

  @Test
  void referenceWorkflowExportsDeterministicVerifiableBundle() throws Exception {
    var signing = configureSigning("bundle");
    UUID request = pending();
    var bundles =
        new com.modulo.blueprint.approval.EvidenceBundleService(
            jdbc, json, signing, new DataSourceTransactionManager(source));
    var options =
        new com.modulo.blueprint.approval.EvidenceBundleService.Options(false, false, false);
    assertThrows(ResponseStatusException.class, () -> bundles.export(run(), 1, options));
    approvals.decide(request, 2, decision("APPROVE"));
    int checkpoint =
        jdbc.queryForObject(
            "SELECT resume_checkpoint FROM workflow_runs WHERE id=?", Integer.class, run());
    interpreter().resumeWaiting(run(), 1, checkpoint);
    var first = bundles.export(run(), 1, options);
    var second = bundles.export(run(), 1, options);
    assertEquals(first.rootHash(), second.rootHash());
    assertArrayEquals(first.bytes(), second.bytes());
    assertThrows(ResponseStatusException.class, () -> bundles.export(run(), 2, options));
    var archive = keyDirectory.resolve("audit.zip");
    java.nio.file.Files.write(archive, first.bytes());
    var process =
        new ProcessBuilder(
                "python3",
                "../scripts/verify-evidence-bundle.py",
                archive.toString(),
                first.rootHash())
            .redirectErrorStream(true)
            .start();
    assertTrue(process.waitFor(30, TimeUnit.SECONDS));
    String output =
        new String(
            process.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
    assertEquals(0, process.exitValue(), output);
    var result = json.readTree(output);
    assertEquals("VALID", result.path("integrity").asText());
    assertEquals("INCOMPLETE_REDACTED", result.path("status").asText());
    assertEquals("VALID", result.path("signatures").get(0).path("status").asText());
    var redacted =
        bundles.export(
            run(),
            1,
            new com.modulo.blueprint.approval.EvidenceBundleService.Options(true, true, true));
    assertNotEquals(first.rootHash(), redacted.rootHash());
    try (var zip =
        new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(redacted.bytes()))) {
      java.util.zip.ZipEntry file;
      while ((file = zip.getNextEntry()) != null) {
        assertFalse(file.getName().startsWith("signatures/"));
        assertFalse(
            new String(zip.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)
                .contains("Reviewed."));
      }
    }
  }

  @Test
  void signingFailureRollsBackDecisionAndResume() {
    UUID request = pending();
    var failed = mock(com.modulo.blueprint.approval.ApprovalSigningService.class);
    when(failed.signDecision(any()))
        .thenThrow(
            new com.modulo.blueprint.approval.ApprovalFailure(
                org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                "APPROVAL_SIGNING_FAILED"));
    approvals =
        new ApprovalService(
            jdbc,
            new DataSourceTransactionManager(source),
            json,
            new TracePolicy(""),
            runs,
            notes,
            failed);
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM approval_decisions", Long.class));
    assertEquals(
        "PENDING", jdbc.queryForObject("SELECT state FROM approval_requests", String.class));
    assertNull(
        jdbc.queryForObject("SELECT resume_at FROM workflow_runs", java.sql.Timestamp.class));
  }

  @Test
  void signedDecisionsSurviveRotationAndDetectEveryCoveredFieldChange() throws Exception {
    var first = configureSigning("first");
    UUID request = pending();
    var input = decision("APPROVE");
    var receipt = approvals.decide(request, 2, input);
    assertEquals("SERVER_SIGNED", receipt.get("signatureState"));
    assertEquals(receipt, approvals.decide(request, 2, input));
    UUID decision = (UUID) receipt.get("id");
    var envelope = approvals.signature(request, decision, 2);
    String statement = envelope.get("statement").toString();
    byte[] signature = Base64.getDecoder().decode(envelope.get("signature").toString());
    var key =
        java.security.KeyFactory.getInstance("Ed25519")
            .generatePublic(
                new java.security.spec.X509EncodedKeySpec(
                    Base64.getDecoder().decode(envelope.get("publicKey").toString())));
    assertTrue(
        com.modulo.blueprint.approval.ApprovalSigningService.verify(
            key, statement.getBytes(java.nio.charset.StandardCharsets.UTF_8), signature));
    var fields = json.readValue(statement, String[].class);
    for (int i = 0; i < fields.length; i++) {
      var changed = fields.clone();
      changed[i] += "changed";
      assertFalse(
          com.modulo.blueprint.approval.ApprovalSigningService.verify(
              key, json.writeValueAsBytes(changed), signature));
    }
    assertThrows(ResponseStatusException.class, () -> approvals.signature(request, decision, 3));
    configureSigning("second");
    var nextInterpreter = interpreter();
    nextInterpreter.registerBlueprint(entry);
    nextInterpreter.fireWebhook(entry.getId(), "trigger", "test-secret", "payload", "second-event");
    UUID secondRequest =
        jdbc.queryForObject("SELECT id FROM approval_requests WHERE id<>?", UUID.class, request);
    approvals.decide(secondRequest, 2, decision("REJECT"));
    assertEquals(2L, jdbc.queryForObject("SELECT count(*) FROM approval_signing_keys", Long.class));
    assertEquals(envelope, first.envelope(decision));
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () ->
            jdbc.update(
                "UPDATE approval_signatures SET signature='changed' WHERE decision_id=?",
                decision));
  }

  @Test
  void pauseRestartApproveAndResumeContainsOnlyDecisionReferences() {
    UUID request = pending();
    assertThrows(ResponseStatusException.class, () -> approvals.view(request, 3));
    assertFalse(approvals.view(request, 2).toString().contains("PRIVATE_PAYLOAD"));
    var receipt = approvals.decide(request, 2, decision("APPROVE"));
    assertEquals("APPROVED", receipt.get("state"));
    int checkpoint =
        jdbc.queryForObject(
            "SELECT resume_checkpoint FROM workflow_runs WHERE id=?", Integer.class, run());
    interpreter().resumeWaiting(run(), 1, checkpoint);
    interpreter().resumeWaiting(run(), 1, checkpoint);
    verify(notes, times(1)).save(any());
    assertEquals("SUCCEEDED", jdbc.queryForObject("SELECT state FROM workflow_runs", String.class));
    String trace =
        jdbc.queryForObject(
            "SELECT output_metadata::text FROM workflow_steps WHERE node_id='result'",
            String.class);
    assertTrue(trace.contains(receipt.get("id").toString()));
    assertFalse(trace.contains("PRIVATE_PAYLOAD"));
  }

  @Test
  void duplicateStaleUnauthorizedAndSelfDecisionsCannotAddVotes() {
    UUID request = pending();
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 1, decision("APPROVE")));
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 3, decision("APPROVE")));
    var input = decision("REJECT");
    assertEquals(approvals.decide(request, 2, input), approvals.decide(request, 2, input));
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    assertThrows(
        ResponseStatusException.class,
        () ->
            approvals.decide(
                request,
                2,
                new ApprovalService.DecisionInput(
                    1, input.idempotencyKey(), "APPROVE", "Changed")));
    assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM approval_decisions", Long.class));
    assertThrows(
        org.springframework.dao.DataAccessException.class,
        () -> jdbc.update("UPDATE approval_decisions SET outcome='APPROVE'"));
  }

  @Test
  void grantRevocationAndBlueprintChangesInvalidatePendingRequests() {
    UUID request = pending();
    approvals.grant(1, entry.getId(), 2, false);
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    approvals.sweep();
    assertEquals(
        "SUPERSEDED", jdbc.queryForObject("SELECT state FROM approval_requests", String.class));
    assertEquals(
        "DEAD_LETTER", jdbc.queryForObject("SELECT state FROM workflow_runs", String.class));
  }

  @Test
  void changedBlueprintCannotReceiveAStaleDecision() {
    UUID request = pending();
    jdbc.update(
        "UPDATE plugin_registry SET"
            + " config=jsonb_set(config,'{irVersion}','2'),updated_at=CURRENT_TIMESTAMP WHERE id=?",
        entry.getId());
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    approvals.sweep();
    assertEquals(
        "SUPERSEDED", jdbc.queryForObject("SELECT state FROM approval_requests", String.class));
  }

  @Test
  void expiryResumesDistinctExpiredPathAndCannotApprove() {
    UUID request = pending();
    jdbc.update(
        "UPDATE approval_requests SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE id=?",
        request);
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    approvals.sweep();
    int checkpoint =
        jdbc.queryForObject("SELECT resume_checkpoint FROM workflow_runs", Integer.class);
    interpreter().resumeWaiting(run(), 1, checkpoint);
    verify(notes, never()).save(any());
    assertEquals(
        "EXPIRED", jdbc.queryForObject("SELECT state FROM approval_requests", String.class));
    assertEquals("SUCCEEDED", jdbc.queryForObject("SELECT state FROM workflow_runs", String.class));
  }

  @Test
  void cancelledRetryReissuesApprovalAndRejectsLaterCheckpoints() {
    UUID request = pending();
    UUID original = run();
    approvals.cancel(request, 1);
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    assertThrows(
        ResponseStatusException.class,
        () -> interpreter().retryRun(original, 1, UUID.randomUUID(), 2, true));
    UUID retry = interpreter().retryRun(original, 1, UUID.randomUUID(), 0, true);
    assertNotEquals(original, retry);
    assertEquals(2L, jdbc.queryForObject("SELECT count(*) FROM approval_requests", Long.class));
    assertEquals(
        "WAITING",
        jdbc.queryForObject("SELECT state FROM workflow_runs WHERE id=?", String.class, retry));
  }

  @Test
  void noteEvidenceIsRecheckedAndNeverDisclosed() throws Exception {
    var note = new Note();
    note.setId(10L);
    note.setUserId(1L);
    note.setVersion(1L);
    note.setContent("PRIVATE_ORIGINAL");
    when(notes.findByIdForApproval(10L)).thenReturn(Optional.of(note));
    String digest =
        ApprovalService.hash(
            json.copy()
                .enable(
                    com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .writeValueAsString(entry.getIr()));
    var lease =
        runs.create(entry.getId(), 1, "1", digest, "trigger", "trigger.webhook", "note-evidence");
    runs.begin(lease);
    var step = runs.startStep(lease, 1, "request", "action.approval.request", Map.of());
    UUID request =
        approvals.request(
            lease, step, "request", Map.of("approverUserId", "2"), Map.of("nested", List.of(note)));
    runs.finishStep(lease, step, "SUCCEEDED", Map.of(), null);
    var graph =
        json.convertValue(entry.getIr(), com.modulo.blueprint.interpreter.BlueprintIRGraph.class);
    checkpoints.save(lease, 2, graph, "wait", "then", Map.of("wait:request", request.toString()));
    UUID wait = runs.startStep(lease, 2, "wait", "logic.approval.wait", Map.of());
    approvals.waitFor(lease, wait, request, 2, 0);
    assertFalse(approvals.view(request, 2).toString().contains("PRIVATE_ORIGINAL"));
    note.setContent("CHANGED");
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM approval_decisions", Long.class));
    note.setContent("PRIVATE_ORIGINAL");
    approvals.decide(request, 2, decision("APPROVE"));
    verify(notes, times(2)).findByIdForApproval(10L);
  }

  @Test
  void approvalCapabilityRevocationBlocksCommit() {
    UUID request = pending();
    jdbc.update("UPDATE plugin_permissions SET granted=false WHERE plugin_id=?", entry.getId());
    assertThrows(
        ResponseStatusException.class, () -> approvals.decide(request, 2, decision("APPROVE")));
    approvals.sweep();
    assertEquals(
        "SUPERSEDED", jdbc.queryForObject("SELECT state FROM approval_requests", String.class));
  }

  @Test
  void competingDecisionsResolveOnce() throws Exception {
    UUID request = pending();
    var pool = Executors.newFixedThreadPool(2);
    try {
      var tasks =
          List.of(
              pool.submit(
                  () -> {
                    try {
                      approvals.decide(request, 2, decision("APPROVE"));
                      return true;
                    } catch (ResponseStatusException conflict) {
                      return false;
                    }
                  }),
              pool.submit(
                  () -> {
                    try {
                      approvals.decide(request, 2, decision("REJECT"));
                      return true;
                    } catch (ResponseStatusException conflict) {
                      return false;
                    }
                  }));
      assertEquals(1, (tasks.get(0).get() ? 1 : 0) + (tasks.get(1).get() ? 1 : 0));
      assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM approval_decisions", Long.class));
    } finally {
      pool.shutdownNow();
    }
  }
}
