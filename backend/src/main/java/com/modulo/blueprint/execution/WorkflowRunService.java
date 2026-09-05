package com.modulo.blueprint.execution;

import com.modulo.observability.ExecutionTraceContext;
import com.modulo.repository.jpa.UserRepository;
import java.util.*;
import java.util.function.Supplier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Durable runtime records. Stored owners and pinned Blueprint hashes supply authority and
 * provenance.
 */
@Service
public class WorkflowRunService {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final UserRepository users;

  private final TracePolicy tracePolicy;

  public WorkflowRunService(
      JdbcTemplate jdbc, PlatformTransactionManager manager, UserRepository users) {
    this(jdbc, manager, users, new TracePolicy(""));
  }

  @org.springframework.beans.factory.annotation.Autowired
  public WorkflowRunService(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      UserRepository users,
      TracePolicy tracePolicy) {
    this.tracePolicy = tracePolicy;
    this.jdbc = jdbc;
    this.transactions = new TransactionTemplate(manager);
    this.transactions.setPropagationBehavior(
        org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    this.users = users;
  }

  public record Lease(UUID id, long owner, boolean created) {}

  public Lease create(
      long blueprintId,
      long expectedOwner,
      String version,
      String digest,
      String triggerNode,
      String triggerType,
      String triggerKey) {
    if (version == null
        || version.length() > 50
        || digest == null
        || !digest.matches("[a-f0-9]{64}")) throw invalid();
    segment(triggerNode, 128);
    segment(triggerType, 128);
    segment(triggerKey, 255);
    return transactions.execute(
        status -> {
          if (jdbc.queryForList(
                  "SELECT id FROM users WHERE id=? FOR UPDATE", Long.class, expectedOwner)
              .isEmpty()) throw denied();
          var owners =
              jdbc.queryForList(
                  "SELECT owner_id FROM plugin_registry WHERE id=? AND runtime='BLUEPRINT' AND"
                      + " status='ACTIVE' AND owner_id=? FOR SHARE",
                  Long.class,
                  blueprintId,
                  expectedOwner);
          if (owners.size() != 1) throw denied();
          var previous =
              jdbc.queryForList(
                  "SELECT id FROM workflow_runs WHERE owner_id=? AND blueprint_id=? AND"
                      + " trigger_node_id=? AND trigger_key=?",
                  UUID.class,
                  expectedOwner,
                  blueprintId,
                  tracePolicy.identifier(triggerNode),
                  tracePolicy.identifier(triggerKey));
          if (!previous.isEmpty()) return new Lease(previous.get(0), expectedOwner, false);
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM workflow_runs WHERE owner_id=?", Long.class, expectedOwner)
              >= 10000)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "WORKFLOW_RUN_QUOTA");
          UUID id = UUID.randomUUID();
          jdbc.update(
              "INSERT INTO"
                  + " workflow_runs(id,owner_id,blueprint_id,blueprint_version,blueprint_digest,trigger_node_id,trigger_type,trigger_key,state)"
                  + " VALUES (?,?,?,?,?,?,?,?,'QUEUED')",
              id,
              expectedOwner,
              blueprintId,
              tracePolicy.identifier(version),
              digest,
              tracePolicy.identifier(triggerNode),
              tracePolicy.identifier(triggerType),
              tracePolicy.identifier(triggerKey));
          return new Lease(id, expectedOwner, true);
        });
  }

  public void begin(Lease lease) {
    transition(lease, "QUEUED", "RUNNING", null);
  }

  public void transition(Lease lease, String expected, String next, String errorClass) {
    state(expected);
    state(next);
    classification(errorClass);
    int changed =
        transactions.execute(
            status ->
                jdbc.update(
                    "UPDATE workflow_runs SET attempt=CASE WHEN state='RETRY_WAIT' AND ?='RUNNING'"
                        + " THEN attempt+1 ELSE attempt END,state=?,error_class=?,started_at=CASE"
                        + " WHEN ?='RUNNING' THEN COALESCE(started_at,CURRENT_TIMESTAMP) ELSE"
                        + " started_at END,finished_at=CASE WHEN ? IN"
                        + " ('SUCCEEDED','FAILED','CANCELLED') THEN CURRENT_TIMESTAMP ELSE NULL END"
                        + " WHERE id=? AND owner_id=? AND state=?",
                    next,
                    next,
                    errorClass,
                    next,
                    next,
                    lease.id(),
                    lease.owner(),
                    expected));
    if (changed != 1)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "WORKFLOW_STATE_CONFLICT");
  }

  public UUID startStep(
      Lease lease, int sequence, String nodeId, String nodeType, Map<String, ?> inputs) {
    segment(nodeId, 128);
    segment(nodeType, 128);
    return transactions.execute(
        status -> {
          var state =
              jdbc.queryForList(
                  "SELECT state FROM workflow_runs WHERE id=? AND owner_id=? FOR UPDATE",
                  String.class,
                  lease.id(),
                  lease.owner());
          if (state.size() != 1 || !state.get(0).equals("RUNNING"))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "WORKFLOW_NOT_RUNNING");
          var trace = ExecutionTraceContext.current();
          UUID id =
              trace != null && trace.runId().equals(lease.id())
                  ? trace.stepId()
                  : UUID.randomUUID();
          int attempt =
              jdbc.queryForObject(
                  "SELECT attempt FROM workflow_runs WHERE id=?", Integer.class, lease.id());
          jdbc.update(
              "INSERT INTO"
                  + " workflow_steps(id,run_id,sequence,attempt,node_id,node_type,state,input_metadata)"
                  + " VALUES (?,?,?,?,?,?,'RUNNING',CAST(? AS jsonb))",
              id,
              lease.id(),
              sequence,
              attempt,
              tracePolicy.identifier(nodeId),
              tracePolicy.identifier(nodeType),
              metadata(lease.owner(), inputs));
          return id;
        });
  }

  public void finishStep(
      Lease lease, UUID step, String next, Map<String, ?> outputs, String errorClass) {
    finishStep(lease, step, next, outputs, errorClass, null);
  }

  public void finishStep(
      Lease lease,
      UUID step,
      String next,
      Map<String, ?> outputs,
      String errorClass,
      Long durationMs) {
    if (durationMs != null && durationMs < 0) throw invalid();
    if (!Set.of("SUCCEEDED", "FAILED", "SKIPPED", "WAITING", "RETRY_WAIT", "CANCELLED")
        .contains(next)) throw invalid();
    classification(errorClass);
    if (transactions.execute(
            status ->
                jdbc.update(
                    "UPDATE workflow_steps SET state=?,finished_at=CASE WHEN ? IN"
                        + " ('WAITING','RETRY_WAIT') THEN NULL ELSE CURRENT_TIMESTAMP"
                        + " END,output_metadata=CAST(? AS jsonb),error_class=?,duration_ms=? WHERE"
                        + " id=? AND state='RUNNING' AND run_id IN (SELECT id FROM workflow_runs"
                        + " WHERE id=? AND owner_id=?)",
                    next,
                    next,
                    metadata(lease.owner(), outputs),
                    errorClass,
                    durationMs,
                    step,
                    lease.id(),
                    lease.owner()))
        != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "WORKFLOW_STEP_CONFLICT");
  }

  /** Establish only the persisted user's identity; capabilities are still checked by each node. */
  public <T> T asOwner(Lease lease, Supplier<T> action) {
    var user = users.findById(lease.owner()).orElseThrow(WorkflowRunService::denied);
    if (user.getUsername() == null) throw denied();
    var previous = SecurityContextHolder.getContext();
    var context = SecurityContextHolder.createEmptyContext();
    var principal =
        new org.springframework.security.core.userdetails.User(user.getUsername(), "", List.of());
    context.setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    try {
      SecurityContextHolder.setContext(context);
      return action.get();
    } finally {
      SecurityContextHolder.setContext(previous);
    }
  }

  /**
   * Type/count metadata only. Arbitrary values, names, note contents and exception messages are
   * excluded.
   */
  private String metadata(long owner, Map<String, ?> values) {
    var trace = ExecutionTraceContext.current();
    return tracePolicy.summarize(owner, values, trace != null && trace.noteReferencesAllowed());
  }

  public int pruneExpired() {
    return jdbc.update(
        "DELETE FROM workflow_runs WHERE retain_until<CURRENT_TIMESTAMP AND state IN"
            + " ('SUCCEEDED','FAILED','CANCELLED')");
  }

  private static void segment(String value, int limit) {
    if (value == null
        || value.isBlank()
        || value.length() > limit
        || value.chars().anyMatch(Character::isISOControl)) throw invalid();
  }

  private static void classification(String value) {
    if (value != null && !value.matches("[A-Z_]{1,64}")) throw invalid();
  }

  private static void state(String value) {
    if (!Set.of("QUEUED", "RUNNING", "WAITING", "RETRY_WAIT", "SUCCEEDED", "FAILED", "CANCELLED")
        .contains(value)) throw invalid();
  }

  private static ResponseStatusException invalid() {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "WORKFLOW_INVALID_INPUT");
  }

  private static ResponseStatusException denied() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, "WORKFLOW_NOT_AVAILABLE");
  }
}
