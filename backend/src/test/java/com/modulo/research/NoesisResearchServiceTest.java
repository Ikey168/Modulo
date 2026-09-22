package com.modulo.research;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.modulo.security.AuthenticatedUserService;
import com.modulo.service.NoteService;
import com.modulo.state.PluginStateStore;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Testcontainers
class NoesisResearchServiceTest {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>(org.testcontainers.utility.DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
  static DriverManagerDataSource ds;
  final ObjectMapper json = new ObjectMapper();
  final ThreadLocal<Long> owner = ThreadLocal.withInitial(() -> 1L);
  PluginStateStore store; NoesisGateway gateway; NoesisResearchService service; NoteService notes; TransactionTemplate tx;
  @BeforeAll static void schema() throws Exception {
    ds = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    try (var c = ds.getConnection()) {
      c.createStatement().execute("CREATE TABLE users(id BIGINT PRIMARY KEY)");
      ScriptUtils.executeSqlScript(c, new ClassPathResource("db/postgresql/V3__Versioned_plugin_state.sql"));
      ScriptUtils.executeSqlScript(c, new ClassPathResource("db/postgresql/V5__Plugin_state_grants_and_delivery.sql"));
    }
  }
  @BeforeEach void setup() {
    var jdbc = new JdbcTemplate(ds); jdbc.execute("TRUNCATE plugin_state_events,plugin_state,users RESTART IDENTITY CASCADE"); jdbc.update("INSERT INTO users(id) VALUES (1),(2)");
    var users = mock(AuthenticatedUserService.class); when(users.requireUserId()).thenAnswer(i -> owner.get());
    var manager = new DataSourceTransactionManager(ds); tx = new TransactionTemplate(manager);
    store = new PluginStateStore(jdbc, manager, users, json, PluginStateStore.Limits.defaults());
    gateway = mock(NoesisGateway.class); notes = mock(NoteService.class);
    when(gateway.answer(anyString(), anyString())).thenAnswer(i -> ResearchEvidenceTest.envelope("A supported finding", "https://official.test/source"));
    service = new NoesisResearchService(store, gateway, users, notes, json);
    store.put("personal", "workspace-para", "data", 0, "modulo.workspace.para", 1,
      "{\"version\":1,\"projects\":[],\"areas\":[],\"tasks\":[],\"resources\":[],\"customField\":\"preserved\"}");
  }
  @AfterEach void cleanup() { owner.remove(); }
  ObjectNode request() {
    var r = json.createObjectNode(); r.put("question", "What evidence supports the release?"); r.put("domain", "technology"); r.put("publicQuestionConfirmed", true); return r;
  }
  ObjectNode refresh(long version, String id) { return json.createObjectNode().put("expectedVersion", version).put("requestId", id); }
  ObjectNode output(PluginStateStore.StateRecord record, String kind) {
    return json.createObjectNode().put("expectedVersion", record.version()).put("runId", record.value().path("runId").asText())
      .put("kind", kind).put("findingId", "finding-1").put("title", "Investigate release").put("rationale", "Relevant to the active project");
  }
  @Test void instrumentedMissingRecordIsHandledWithoutMaskingOtherFailures() {
    var wrapped = spy(store);
    doAnswer(call -> { try { return call.callRealMethod(); } catch (ResponseStatusException e) { throw new RuntimeException(new RuntimeException(e)); } }).when(wrapped).get(anyString(), anyString(), anyString());
    var instrumented = new NoesisResearchService(wrapped, gateway, mock(AuthenticatedUserService.class), notes, json);
    assertEquals(1, instrumented.create("wrapped-123", request()).version());
    doThrow(new RuntimeException("Database unavailable")).when(wrapped).get(anyString(), anyString(), anyString());
    assertThrows(RuntimeException.class, () -> instrumented.create("wrapped-456", request()));
  }
  @Test void requestReplayIsIdempotentAndPayloadReuseConflicts() {
    var first = service.create("research-123", request()); var replay = service.create("research-123", request());
    assertEquals(first.version(), replay.version()); verify(gateway, times(1)).answer(anyString(), anyString());
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () -> service.create("research-123", request().put("question", "Different"))).getStatus());
    assertThrows(ResponseStatusException.class, () -> service.create("research-456", request().put("publicQuestionConfirmed", false)));
  }
  @Test void ownerIsolationAndStaleRefreshAreEnforced() {
    var first = service.create("research-123", request());
    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class, () -> service.refresh(first.key(), refresh(0, "refresh-123"))).getStatus());
    owner.set(2L); assertEquals(HttpStatus.NOT_FOUND, assertThrows(ResponseStatusException.class, () -> service.get(first.key())).getStatus());
    assertTrue(service.list(null).records().isEmpty());
  }
  @Test void refreshFailurePreservesPreviousResultAndRetrySucceeds() {
    var first = service.create("research-123", request());
    when(gateway.answer(anyString(), anyString())).thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE));
    assertThrows(ResponseStatusException.class, () -> service.refresh(first.key(), refresh(first.version(), "refresh-123")));
    assertEquals(first.value(), service.get(first.key()).value());
    doReturn(ResearchEvidenceTest.envelope("Changed finding", "https://official.test/source")).when(gateway).answer(anyString(), anyString());
    var next = service.refresh(first.key(), refresh(first.version(), "refresh-123"));
    assertTrue(next.value().path("delta").path("material").asBoolean()); assertEquals(1, next.value().path("history").size());
    assertEquals(next.version(), service.refresh(first.key(), refresh(first.version(), "refresh-123")).version());
  }
  @Test void outputAndUnchangedRefreshCannotDuplicateTasksOrResetUserEdits() {
    var first = service.create("research-123", request());
    var saved = tx.execute(s -> service.output(first.key(), output(first, "task")));
    assertEquals(saved.version(), tx.execute(s -> service.output(first.key(), output(first, "task"))).version());
    var para = store.get("personal", "workspace-para", "data"); assertEquals(1, para.value().path("tasks").size()); assertEquals("preserved", para.value().path("customField").asText());
    assertTrue(para.value().path("tasks").get(0).path("context").asText().contains("official.test/source"));
    var refreshed = service.refresh(first.key(), refresh(saved.version(), "refresh-123"));
    assertEquals("unchanged", refreshed.value().path("delta").path("kind").asText());
    tx.execute(s -> service.output(first.key(), output(refreshed, "task")));
    assertEquals(1, store.get("personal", "workspace-para", "data").value().path("tasks").size());
  }
  @Test void transactionRollsBackWorkIfReceiptCannotCommit() {
    var first = service.create("research-123", request()); var paraBefore = store.get("personal", "workspace-para", "data");
    assertThrows(IllegalStateException.class, () -> tx.execute(s -> { service.output(first.key(), output(first, "task")); throw new IllegalStateException("simulate interrupted transaction"); }));
    assertEquals(paraBefore.version(), store.get("personal", "workspace-para", "data").version());
    assertEquals(first.version(), service.get(first.key()).version());
  }
  @Test void refusedResultsCannotProduceWorkButCanBeReviewed() {
    var envelope = ResearchEvidenceTest.envelope("No relevant evidence", "https://official.test/source");
    ((ObjectNode) envelope.path("data")).put("answer_status", "refused");
    when(gateway.answer(anyString(), anyString())).thenReturn(envelope);
    var first = service.create("research-123", request());
    assertThrows(ResponseStatusException.class, () -> tx.execute(s -> service.output(first.key(), output(first, "task"))));
    var ignored = tx.execute(s -> service.output(first.key(), output(first, "ignore")));
    assertEquals("ignore", ignored.value().path("outputs").get(0).path("kind").asText());
  }
}
