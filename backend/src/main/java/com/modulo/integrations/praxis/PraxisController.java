package com.modulo.integrations.praxis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import javax.annotation.PreDestroy;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Praxis tasks for the signed-in user (#525). Every call is made for the user with the
 * identity from {@link PraxisIdentity}; request input never chooses who Modulo acts for.
 * Responses keep Praxis' own fields and add {@code summary} (executor outcome separate
 * from verification) and {@code controls} (what the executor and state allow).
 */
@RestController
@RequestMapping("/api/praxis")
public class PraxisController {
  static final Set<String> OPERATIONS = Set.of("cancel", "suspend", "resume", "signal", "retry");
  private static final Pattern EXECUTOR = Pattern.compile("[a-z0-9][a-z0-9_-]{0,63}");
  private static final Pattern SIGNAL = Pattern.compile("[a-z][a-z0-9_.-]{0,63}");
  private static final int MAX_OBJECTIVE = 2000;
  private static final int MAX_INPUTS = 256 * 1024;
  private static final int MAX_STREAMS = 64;

  private final ObjectProvider<PraxisClient> clients;
  private final PraxisIdentity identity;
  private final PraxisSubmissions submissions;
  private final PraxisProperties properties;
  private final ObjectMapper json;
  private final PraxisApprovals approvals;
  private final ThreadPoolExecutor streams = new ThreadPoolExecutor(0, MAX_STREAMS, 30, TimeUnit.SECONDS,
      new SynchronousQueue<>(), runnable -> {
        Thread thread = new Thread(runnable, "praxis-events");
        thread.setDaemon(true);
        return thread;
      });

  public PraxisController(ObjectProvider<PraxisClient> clients, PraxisIdentity identity, PraxisSubmissions submissions,
      PraxisProperties properties, ObjectMapper json, PraxisApprovals approvals) {
    this.clients = clients;
    this.identity = identity;
    this.submissions = submissions;
    this.properties = properties;
    this.json = json;
    this.approvals = approvals;
  }

  @PreDestroy
  void shutdown() {
    streams.shutdownNow();
  }

  private PraxisClient client() {
    PraxisClient client = clients.getIfAvailable();
    if (client == null) throw new PraxisException(503, "praxis_not_configured", null, null);
    return client;
  }

  @GetMapping("/status")
  public Map<String, Object> status() {
    Map<String, Object> status = new LinkedHashMap<>();
    status.put("configured", clients.getIfAvailable() != null);
    status.put("executors", properties.getExecutorFeatures());
    return status;
  }

  @GetMapping("/processes")
  public Map<String, Object> list() {
    PraxisIdentity.Principal user = identity.current();
    return Map.of("processes", submissions.list(user.ownerId()));
  }

  /**
   * Submits a task. The UI sends an {@code Idempotency-Key} per task form, so a retried
   * request after a lost response resolves to the same process instead of a second one.
   * Capabilities and environment are deliberately not accepted from the browser: they
   * grant authority and belong to server-side task templates.
   */
  @PostMapping("/processes")
  public JsonNode submit(@RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
      @RequestBody JsonNode body) {
    PraxisClient client = client();
    PraxisIdentity.Principal user = identity.current();
    if (idempotencyKey == null || !PraxisClient.IDEMPOTENCY_KEY.matcher(idempotencyKey).matches()) {
      throw new IllegalArgumentException("idempotency_key_required");
    }
    String objective = text(body, "objective", MAX_OBJECTIVE);
    String executor = text(body, "executor", 64);
    if (!EXECUTOR.matcher(executor).matches() || !properties.getExecutorFeatures().containsKey(executor)) {
      throw new IllegalArgumentException("unknown_executor");
    }
    boolean publish = body.path("publish").asBoolean(false);

    ObjectNode spec = json.createObjectNode().put("objective", objective).put("executor", executor);
    JsonNode inputs = body.path("inputs");
    if (!inputs.isMissingNode() && !inputs.isNull()) {
      if (!inputs.isObject() || inputs.toString().length() > MAX_INPUTS) throw new IllegalArgumentException("invalid_inputs");
      spec.set("inputs", inputs);
    }
    JsonNode context = body.path("context");
    if (!context.isMissingNode() && !context.isNull()) {
      if (!context.isArray()) throw new IllegalArgumentException("invalid_context");
      for (JsonNode item : context) if (!item.isObject()) throw new IllegalArgumentException("invalid_context");
      spec.set("context", context);
    }
    ObjectNode metadata = spec.putObject("metadata");
    metadata.putObject("modulo").put("source", "modulo");
    // Only intent: Praxis grants publication because Modulo's client holds the publish role.
    if (publish) metadata.putObject("praxis_host").put("publish", true);

    JsonNode receipt = client.submit(spec, idempotencyKey, user.onBehalfOf());
    String processId = receipt.path("process_id").asText("");
    if (!PraxisClient.PROCESS_ID.matcher(processId).matches()) throw new PraxisException(502, "praxis_invalid_response", null, null);
    submissions.record(user.ownerId(), processId, idempotencyKey, objective, executor, publish);
    return receipt;
  }

  @GetMapping("/processes/{id}")
  public JsonNode inspect(@PathVariable String id) {
    JsonNode process = client().inspect(id, identity.current().onBehalfOf());
    return describe((ObjectNode) process);
  }

  @GetMapping("/processes/{id}/tree")
  public JsonNode tree(@PathVariable String id) {
    ObjectNode tree = (ObjectNode) client().tree(id, identity.current().onBehalfOf());
    for (JsonNode process : tree.path("processes")) if (process.isObject()) describe((ObjectNode) process);
    return tree;
  }

  /**
   * Live progress as server-sent events. Each event keeps Praxis' cursor as its id, so
   * the UI resumes with {@code Last-Event-ID} (or {@code after}) after it has handled
   * the event. The stream ends with an {@code end} event when the process finishes.
   */
  @GetMapping(value = "/processes/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter events(@PathVariable String id, @RequestParam(value = "after", required = false) Long after,
      @RequestHeader(value = "Last-Event-ID", required = false) String lastEventId,
      @RequestParam(value = "tree", defaultValue = "false") boolean tree) {
    PraxisClient client = client();
    String onBehalfOf = identity.current().onBehalfOf();
    long cursor = after != null ? after : parseCursor(lastEventId);
    // Opened here so a refusal (429 stream_limited, 404, 403) is an ordinary HTTP error.
    PraxisClient.EventStream upstream = client.events(id, cursor, tree, onBehalfOf);
    SseEmitter emitter = new SseEmitter(properties.getStreamTimeout().toMillis());
    AtomicBoolean closed = new AtomicBoolean();
    Runnable close = () -> {
      if (closed.compareAndSet(false, true)) {
        try { upstream.close(); } catch (IOException ignored) { /* already closed */ }
      }
    };
    emitter.onCompletion(close);
    emitter.onTimeout(close);
    emitter.onError(error -> close.run());
    try {
      streams.execute(() -> relay(upstream, emitter, closed, close));
    } catch (RejectedExecutionException busy) {
      close.run();
      throw new PraxisException(503, "praxis_streams_busy", null, "5");
    }
    return emitter;
  }

  private void relay(PraxisClient.EventStream upstream, SseEmitter emitter, AtomicBoolean closed, Runnable close) {
    try {
      Optional<PraxisClient.Event> next;
      while (!closed.get() && (next = upstream.next()).isPresent()) {
        PraxisClient.Event event = next.get();
        emitter.send(SseEmitter.event().id(Long.toString(event.cursor())).name("praxis")
            .data(json.writeValueAsString(Map.of("cursor", event.cursor(), "event", event.event())), MediaType.APPLICATION_JSON));
      }
      if (!closed.get()) emitter.send(SseEmitter.event().name("end").data("{}", MediaType.APPLICATION_JSON));
      emitter.complete();
    } catch (IOException error) {
      if (!closed.get()) {
        try {
          emitter.send(SseEmitter.event().name("error").data("{\"code\":\"praxis_stream_interrupted\"}", MediaType.APPLICATION_JSON));
          emitter.complete();
        } catch (IOException | IllegalStateException ignored) {
          emitter.completeWithError(error);
        }
      }
    } catch (IllegalStateException alreadyCompleted) {
      // The browser went away; the completion callback closes Praxis' stream.
    } finally {
      close.run();
    }
  }

  @PostMapping("/processes/{id}/control")
  public JsonNode control(@PathVariable String id, @RequestBody JsonNode body) {
    String operation = text(body, "operation", 16);
    if (!OPERATIONS.contains(operation)) throw new IllegalArgumentException("unknown_control_operation");
    String attemptId = text(body, "attemptId", 128);
    String signal = null;
    if ("signal".equals(operation)) {
      signal = text(body, "signal", 64);
      if (!SIGNAL.matcher(signal).matches()) throw new IllegalArgumentException("invalid_signal");
    }
    String policy = body.path("policy").asText("self");
    if (!"self".equals(policy) && !"tree".equals(policy)) throw new IllegalArgumentException("invalid_policy");
    PraxisClient client = client();
    String onBehalfOf = identity.current().onBehalfOf();
    // Refuse before calling Praxis when the executor cannot perform the operation.
    ObjectNode current = (ObjectNode) client.inspect(id, onBehalfOf);
    Map<String, Object> allowed = PraxisControls.of(current.path("spec").path("executor").asText(""),
        current.path("state").asText(""), properties.getExecutorFeatures()).get(operation);
    if (!Boolean.TRUE.equals(allowed.get("supported"))) {
      throw new PraxisException(409, "control_unsupported_by_executor", null, null);
    }
    return client.control(id, attemptId, operation, signal, policy, onBehalfOf);
  }

  /**
   * Pending approvals across the processes the user submitted, for the Approvals inbox.
   * Not configured is an empty list, not an error, so the inbox still shows workflow approvals.
   */
  @GetMapping("/approvals")
  public Map<String, Object> pendingApprovals() {
    return approvals.pending();
  }

  @GetMapping("/processes/{id}/approvals")
  public JsonNode approvals(@PathVariable String id) {
    return client().approvals(id, identity.current().onBehalfOf());
  }

  @PostMapping("/processes/{id}/approvals")
  public JsonNode decide(@PathVariable String id, @RequestBody JsonNode body) {
    String effectId = text(body, "effectId", 128);
    String attemptId = text(body, "attemptId", 128);
    String reason = text(body, "reason", 2000);
    if (!body.path("version").canConvertToLong() || !body.path("version").isIntegralNumber()) {
      throw new IllegalArgumentException("version_required");
    }
    if (!body.path("approved").isBoolean()) throw new IllegalArgumentException("approved_required");
    return client().decide(id, effectId, body.path("version").asLong(), attemptId, body.path("approved").asBoolean(),
        reason, identity.current().onBehalfOf());
  }

  @PostMapping("/processes/{id}/publication")
  public JsonNode publish(@PathVariable String id) {
    return client().publish(id, identity.current().onBehalfOf());
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Adds {@code summary} and {@code controls}. The executor's outcome ("the agent
   * finished") and verification ("the result was checked and approved") are reported
   * separately: a completed executor run can still be unverified.
   */
  ObjectNode describe(ObjectNode process) {
    String state = process.path("state").asText("");
    String executor = process.path("spec").path("executor").asText("");
    JsonNode outcome = process.path("result").path("outcome");
    JsonNode verification = process.path("verification");
    ObjectNode summary = process.putObject("summary");
    summary.put("state", state);
    summary.put("executor", executor);
    summary.put("finished", PraxisControls.TERMINAL.contains(state));
    ObjectNode execution = summary.putObject("execution");
    if (outcome.isObject()) {
      execution.put("status", outcome.path("status").asText(null));
      execution.put("reason", outcome.path("reason").asText(null));
    } else {
      execution.putNull("status");
      execution.putNull("reason");
    }
    ObjectNode verified = summary.putObject("verification");
    if (verification.isObject()) {
      verified.put("available", true);
      verified.put("approved", verification.path("approved").asBoolean(false));
      verified.set("requiredFailures", verification.path("required_failures").isArray()
          ? verification.get("required_failures") : json.createArrayNode());
      verified.set("missingOutputs", verification.path("missing_outputs").isArray()
          ? verification.get("missing_outputs") : json.createArrayNode());
    } else {
      verified.put("available", false);
      verified.putNull("approved");
    }
    summary.put("publishable", "completed".equals(state) && verification.path("approved").asBoolean(false));
    process.set("controls", json.valueToTree(PraxisControls.of(executor, state, properties.getExecutorFeatures())));
    return process;
  }

  private static String text(JsonNode body, String field, int max) {
    JsonNode value = body == null ? null : body.get(field);
    if (value == null || !value.isTextual() || value.asText().isBlank() || value.asText().length() > max) {
      throw new IllegalArgumentException(field + "_required");
    }
    return value.asText().strip();
  }

  private static long parseCursor(String lastEventId) {
    if (lastEventId == null || lastEventId.isBlank()) return 0;
    try {
      long cursor = Long.parseLong(lastEventId.strip());
      if (cursor < 0) throw new IllegalArgumentException("invalid_event_cursor");
      return cursor;
    } catch (NumberFormatException error) {
      throw new IllegalArgumentException("invalid_event_cursor");
    }
  }

}
