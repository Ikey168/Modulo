package com.modulo.integrations.praxis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PraxisControllerTest {
  private final ObjectMapper json = new ObjectMapper();
  private final PraxisClient client = mock(PraxisClient.class);
  private final PraxisIdentity identity = mock(PraxisIdentity.class);
  private final PraxisSubmissions submissions = mock(PraxisSubmissions.class);
  private PraxisController controller;
  private MockMvc mvc;

  @BeforeEach
  @SuppressWarnings("unchecked")
  void setUp() {
    ObjectProvider<PraxisClient> clients = mock(ObjectProvider.class);
    when(clients.getIfAvailable()).thenReturn(client);
    when(identity.current()).thenReturn(new PraxisIdentity.Principal(42, "user-42"));
    controller = new PraxisController(clients, identity, submissions, new PraxisProperties(), json,
        new PraxisApprovals(clients, identity, submissions));
    mvc = MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new PraxisErrors())
        .defaultRequest(get("/").accept(MediaType.APPLICATION_JSON)).build();
  }

  private ObjectNode process(String executor, String state, boolean verified, String outcome) {
    ObjectNode process = json.createObjectNode().put("process_id", "p-1").put("attempt_id", "a-1").put("state", state);
    process.putObject("spec").put("executor", executor);
    if (outcome != null) process.putObject("result").putObject("outcome").put("status", outcome).put("reason", "fake.completed");
    else process.putNull("result");
    process.putObject("verification").put("approved", verified).putArray("required_failures").add("tests");
    return process;
  }

  @Test
  void theDelegatedIdentityComesFromTheSessionNeverFromTheRequest() throws Exception {
    when(client.submit(any(), anyString(), anyString())).thenReturn(
        json.createObjectNode().put("process_id", "p-1").put("state", "pending").put("duplicate", false));

    mvc.perform(post("/api/praxis/processes").contentType(MediaType.APPLICATION_JSON)
            .header("Idempotency-Key", "form-1").header("X-Praxis-On-Behalf-Of", "admin")
            .content("{\"objective\":\"Summarize\",\"executor\":\"fake\",\"onBehalfOf\":\"admin\","
                + "\"capabilities\":[{\"resource\":\"*\"}],\"environment\":{\"X\":\"1\"},\"publish\":true}"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.process_id").value("p-1"));

    ArgumentCaptor<ObjectNode> spec = ArgumentCaptor.forClass(ObjectNode.class);
    verify(client).submit(spec.capture(), eq("form-1"), eq("user-42"));
    assertThat(spec.getValue().has("capabilities")).isFalse();
    assertThat(spec.getValue().has("environment")).isFalse();
    assertThat(spec.getValue().path("metadata").path("praxis_host").path("publish").asBoolean()).isTrue();
    verify(submissions).record(42, "p-1", "form-1", "Summarize", "fake", true);
  }

  @Test
  void submissionsNeedAnIdempotencyKeyAndAConfiguredExecutor() throws Exception {
    mvc.perform(post("/api/praxis/processes").contentType(MediaType.APPLICATION_JSON)
            .content("{\"objective\":\"x\",\"executor\":\"fake\"}"))
        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("idempotency_key_required"));
    mvc.perform(post("/api/praxis/processes").contentType(MediaType.APPLICATION_JSON).header("Idempotency-Key", "k")
            .content("{\"objective\":\"x\",\"executor\":\"rogue\"}"))
        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("unknown_executor"));
    verify(client, never()).submit(any(), anyString(), anyString());
  }

  @Test
  void executorOutcomeIsReportedSeparatelyFromVerification() throws Exception {
    when(client.inspect("p-1", "user-42")).thenReturn(process("fake", "completed", false, "completed"));

    mvc.perform(get("/api/praxis/processes/p-1"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.summary.finished").value(true))
        .andExpect(jsonPath("$.summary.execution.status").value("completed"))
        .andExpect(jsonPath("$.summary.verification.available").value(true))
        .andExpect(jsonPath("$.summary.verification.approved").value(false))
        .andExpect(jsonPath("$.summary.verification.requiredFailures[0]").value("tests"))
        .andExpect(jsonPath("$.summary.publishable").value(false))
        .andExpect(jsonPath("$.controls.cancel.supported").value(true))
        .andExpect(jsonPath("$.controls.cancel.available").value(false));
  }

  @Test
  void controlsTheExecutorDoesNotSupportAreRefusedWithoutCallingPraxis() throws Exception {
    when(client.inspect("p-1", "user-42")).thenReturn(process("claude", "running", false, null));

    mvc.perform(get("/api/praxis/processes/p-1"))
        .andExpect(jsonPath("$.controls.cancel.supported").value(false))
        .andExpect(jsonPath("$.controls.cancel.reason").value("executor_unsupported"));
    mvc.perform(post("/api/praxis/processes/p-1/control").contentType(MediaType.APPLICATION_JSON)
            .content("{\"operation\":\"cancel\",\"attemptId\":\"a-1\"}"))
        .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("control_unsupported_by_executor"));
    verify(client, never()).control(anyString(), anyString(), anyString(), any(), any(), anyString());
  }

  @Test
  void praxisConflictsPassThroughAndItsAuthenticationFailuresDoNotLookLikeASessionProblem() throws Exception {
    when(client.inspect("p-1", "user-42")).thenReturn(process("fake", "running", false, null));
    when(client.control(eq("p-1"), eq("stale"), eq("cancel"), any(), eq("self"), eq("user-42")))
        .thenThrow(new PraxisException(409, "stale_process_attempt", null, null));
    when(client.approvals("p-1", "user-42")).thenThrow(new PraxisException(401, "authentication_required", null, null));
    when(client.publish("p-1", "user-42")).thenThrow(new PraxisException(429, "rate_limited", null, "12"));

    mvc.perform(post("/api/praxis/processes/p-1/control").contentType(MediaType.APPLICATION_JSON)
            .content("{\"operation\":\"cancel\",\"attemptId\":\"stale\"}"))
        .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("stale_process_attempt"));
    mvc.perform(get("/api/praxis/processes/p-1/approvals"))
        .andExpect(status().isBadGateway()).andExpect(jsonPath("$.code").value("praxis_authentication_failed"));
    mvc.perform(post("/api/praxis/processes/p-1/publication"))
        .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "12"));
  }

  @Test
  void approvalDecisionsCarryVersionAttemptAndReason() throws Exception {
    when(client.decide(anyString(), anyString(), any(Long.class), anyString(), anyBoolean(), anyString(), anyString()))
        .thenReturn(json.createObjectNode());
    mvc.perform(post("/api/praxis/processes/p-1/approvals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"effectId\":\"e-1\",\"version\":2,\"attemptId\":\"a-1\",\"approved\":false,\"reason\":\"Wrong target\"}"))
        .andExpect(status().isOk());
    verify(client).decide("p-1", "e-1", 2, "a-1", false, "Wrong target", "user-42");

    mvc.perform(post("/api/praxis/processes/p-1/approvals").contentType(MediaType.APPLICATION_JSON)
            .content("{\"effectId\":\"e-1\",\"version\":2,\"attemptId\":\"a-1\",\"approved\":true}"))
        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("reason_required"));
  }

  @Test
  void liveEventsAreRelayedWithPraxisCursorsAndEndWhenTheProcessFinishes() throws Exception {
    String upstream = "id: 3\nevent: praxis\ndata: {\"cursor\": 3, \"event\": {\"process_id\": \"p-1\", \"type\": \"process.created\"}}\n\n"
        + "id: 8\nevent: praxis\ndata: {\"cursor\": 8, \"event\": {\"process_id\": \"p-1\", \"type\": \"process.completed\"}}\n\n";
    when(client.events("p-1", 2, false, "user-42")).thenReturn(new PraxisClient.EventStream(
        new ByteArrayInputStream(upstream.getBytes(StandardCharsets.UTF_8)), "p-1", 2, false, json));

    var started = mvc.perform(get("/api/praxis/processes/p-1/events").header("Last-Event-ID", "2")
            .accept(MediaType.TEXT_EVENT_STREAM))
        .andExpect(request().asyncStarted()).andReturn();
    Thread.sleep(200);
    String body = mvc.perform(asyncDispatch(started)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertThat(body).contains("id:3", "id:8", "event:praxis", "process.completed", "event:end");
    assertThat(body.indexOf("id:3")).isLessThan(body.indexOf("id:8"));
  }

  @Test
  void aStreamRefusedByPraxisIsAnOrdinaryHttpError() throws Exception {
    when(client.events("p-1", 0, false, "user-42")).thenThrow(new PraxisException(429, "stream_limited", null, "3"));
    mvc.perform(get("/api/praxis/processes/p-1/events").accept(MediaType.TEXT_EVENT_STREAM, MediaType.APPLICATION_JSON))
        .andExpect(status().isTooManyRequests()).andExpect(header().string("Retry-After", "3"))
        .andExpect(jsonPath("$.code").value("stream_limited"));
  }

  @Test
  void aDisabledIntegrationSaysSo() throws Exception {
    @SuppressWarnings("unchecked")
    ObjectProvider<PraxisClient> none = mock(ObjectProvider.class);
    MockMvc disabled = MockMvcBuilders.standaloneSetup(
        new PraxisController(none, identity, submissions, new PraxisProperties(), json,
            new PraxisApprovals(none, identity, submissions)))
        .setControllerAdvice(new PraxisErrors())
        .defaultRequest(get("/").accept(MediaType.APPLICATION_JSON)).build();
    disabled.perform(get("/api/praxis/status")).andExpect(jsonPath("$.configured").value(false))
        .andExpect(jsonPath("$.executors.claude").isEmpty());
    disabled.perform(get("/api/praxis/processes/p-1"))
        .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("praxis_not_configured"));
    disabled.perform(get("/api/praxis/approvals"))
        .andExpect(status().isOk()).andExpect(jsonPath("$.configured").value(false))
        .andExpect(jsonPath("$.approvals").isEmpty());
    verify(submissions, never()).list(any(Long.class));
  }
}
