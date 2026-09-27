package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalErrors.conflict;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.execution.*;
import com.modulo.note.NoteService;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Human approvals for workflow runs. This class is the approval API and owns the request state
 * machine (request, wait, decide, result, resume). The other responsibilities live in
 * package-private collaborators it builds:
 *
 * <ul>
 *   <li>{@link ApprovalReviewers}: reviewer authorization and delegation grants;
 *   <li>{@link ApprovalEvidence}: evidence capture and verification;
 *   <li>{@link ApprovalDecisions}: recording reviewer decisions, signed through {@link
 *       ApprovalSigningService};
 *   <li>{@link ApprovalExpiry}: expiry, supersession, reminders and system resolution;
 *   <li>{@link ApprovalInbox}: the visible, redacted read model.
 * </ul>
 *
 * <p>Every write runs in a {@link TransactionTemplate} transaction opened here, in {@link
 * ApprovalDecisions} or in {@link ApprovalExpiry}; the other collaborators run inside the
 * caller's transaction.
 */
@Service
public class ApprovalService {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final TracePolicy traces;
  private final WorkflowRunService runs;

  private final ApprovalCodec codec;
  private final ApprovalRecords records;
  private final ApprovalReviewers reviewers;
  private final ApprovalEvidence evidence;
  private final ApprovalExpiry expiry;
  private final ApprovalInbox inbox;
  private final ApprovalDecisions decisions;

  public ApprovalService(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      ObjectMapper json,
      TracePolicy traces,
      WorkflowRunService runs,
      NoteService notes,
      ApprovalSigningService signing) {
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(manager);
    this.traces = traces;
    this.runs = runs;
    this.codec = new ApprovalCodec(json);
    this.records = new ApprovalRecords(jdbc);
    this.reviewers = new ApprovalReviewers(jdbc);
    this.evidence = new ApprovalEvidence(codec, records, reviewers, traces, runs, notes);
    this.expiry = new ApprovalExpiry(jdbc, tx, records);
    this.inbox = new ApprovalInbox(jdbc, codec, traces, signing);
    this.decisions =
        new ApprovalDecisions(jdbc, tx, codec, records, reviewers, evidence, signing);
  }

  public UUID request(
      WorkflowRunService.Lease lease,
      UUID step,
      String node,
      Map<String, Object> config,
      Map<String, Object> inputs) {
    if (config.containsKey("approverRole")
        || config.containsKey("approverGroup")
        || config.containsKey("quorum") && bounded(config.get("quorum"), 1, 100) != 1
        || Boolean.TRUE.equals(config.get("delegation")))
      throw conflict("UNSUPPORTED_APPROVAL_POLICY");
    long reviewer = positiveId(config.get("approverUserId"));
    int ttl = bounded(config.getOrDefault("expirySeconds", 86400), 60, 604800);
    int reminders = bounded(config.getOrDefault("reminders", 0), 0, 3);
    if (reviewer == lease.owner()) throw conflict("SEPARATION_OF_DUTY");
    return tx.execute(
        status -> {
          var run =
              records.one(
                  "SELECT * FROM workflow_runs WHERE id=? AND owner_id=? AND state='RUNNING' FOR"
                      + " UPDATE",
                  lease.id(),
                  lease.owner());
          var blueprint =
              records.one(
                  "SELECT id,owner_id,version,config::text,updated_at FROM plugin_registry WHERE"
                      + " id=? AND owner_id=? AND status='ACTIVE' AND runtime='BLUEPRINT' FOR"
                      + " SHARE",
                  run.get("blueprint_id"),
                  lease.owner());
          reviewers.requireCapability(run.get("blueprint_id"));
          if (!codec.digestJson((String) blueprint.get("config")).equals(run.get("blueprint_digest")))
            throw conflict("BLUEPRINT_CHANGED");
          // The owned, persisted node configuration is the initial explicit reviewer selection.
          reviewers.selectReviewer(run.get("blueprint_id"), lease.owner(), reviewer);
          var existing =
              jdbc.queryForList(
                  "SELECT id FROM approval_requests WHERE run_ref=? AND request_step_id=?",
                  UUID.class,
                  lease.id(),
                  step);
          if (!existing.isEmpty()) return existing.get(0);
          if (jdbc.queryForObject(
                      "SELECT count(*) FROM approval_requests WHERE owner_id=?",
                      Long.class,
                      lease.owner())
                  >= 10000
              || jdbc.queryForObject(
                      "SELECT count(*) FROM approval_requests WHERE approver_id=? AND"
                          + " state='PENDING'",
                      Long.class,
                      reviewer)
                  >= 100)
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "APPROVAL_QUOTA");
          Map<String, Object> checks = evidence.capture(inputs, lease.owner());
          String encoded = codec.encode(checks);
          if (encoded.getBytes(StandardCharsets.UTF_8).length > 65536)
            throw conflict("EVIDENCE_TOO_LARGE");
          var summary = new LinkedHashMap<String, Object>();
          summary.put("typed", codec.parse(traces.summarize(lease.owner(), inputs, false)));
          summary.put(
              "message",
              traces.identifier(
                  String.valueOf(config.getOrDefault("message", "Review this workflow request."))));
          summary.put("omissions", List.of("Raw input values", "Note contents"));
          UUID id = UUID.randomUUID();
          byte[] nonce = new byte[32];
          new SecureRandom().nextBytes(nonce);
          String policy =
              hash(
                  codec.encode(
                      Map.of(
                          "version",
                          1,
                          "reviewer",
                          Long.toString(reviewer),
                          "quorum",
                          1,
                          "separationOfDuty",
                          true,
                          "rejectComment",
                          true,
                          "expirySeconds",
                          ttl)));
          jdbc.update(
              "INSERT INTO"
                  + " approval_requests(id,owner_id,requester_ref,approver_id,approver_ref,run_id,run_ref,run_attempt,blueprint_id,blueprint_digest,blueprint_version,blueprint_updated_at,node_id,request_step_id,resume_nonce,evidence_digest,evidence_checks,safe_summary,policy_digest,state,expires_at,reminders_requested,next_reminder_at)"
                  + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,CAST(? AS jsonb),CAST(? AS"
                  + " jsonb),?,'REQUESTED',clock_timestamp()+(?*INTERVAL '1"
                  + " second'),?,clock_timestamp()+INTERVAL '1 hour')",
              id,
              lease.owner(),
              Long.toString(lease.owner()),
              reviewer,
              Long.toString(reviewer),
              lease.id(),
              lease.id(),
              run.get("attempt"),
              run.get("blueprint_id"),
              run.get("blueprint_digest"),
              run.get("blueprint_version"),
              blueprint.get("updated_at"),
              traces.identifier(node),
              step,
              nonce,
              hash(encoded),
              encoded,
              codec.encode(summary),
              policy,
              ttl,
              reminders);
          records.event(id, "REQUESTED", Long.toString(lease.owner()));
          jdbc.update("UPDATE approval_requests SET state='PENDING' WHERE id=?", id);
          records.event(id, "PENDING", null);
          records.notifyReviewer(id, reviewer, 0);
          return id;
        });
  }

  public void waitFor(
      WorkflowRunService.Lease lease, UUID step, UUID request, int checkpoint, long duration) {
    tx.executeWithoutResult(
        status -> {
          var approval =
              records.one(
                  "SELECT * FROM approval_requests WHERE id=? AND run_ref=? AND owner_id=? FOR"
                      + " UPDATE",
                  request,
                  lease.id(),
                  lease.owner());
          records.one(
              "SELECT id FROM workflow_runs WHERE id=? AND owner_id=? AND state='RUNNING' FOR"
                  + " UPDATE",
              lease.id(),
              lease.owner());
          runs.checkCancellation(lease);
          if (!"PENDING".equals(approval.get("state")) || approval.get("wait_step_id") != null)
            throw conflict("APPROVAL_NOT_PENDING");
          if (jdbc.queryForObject(
                  "SELECT count(*) FROM workflow_checkpoints WHERE run_id=? AND sequence=?",
                  Long.class,
                  lease.id(),
                  checkpoint)
              != 1) throw conflict("CHECKPOINT_UNAVAILABLE");
          jdbc.update(
              "UPDATE approval_requests SET wait_step_id=?,checkpoint=? WHERE id=?",
              step,
              checkpoint,
              request);
          jdbc.update(
              "UPDATE workflow_steps SET state='WAITING',duration_ms=? WHERE id=? AND run_id=? AND"
                  + " state='RUNNING'",
              duration,
              step,
              lease.id());
          jdbc.update(
              "UPDATE workflow_runs SET"
                  + " state='WAITING',resume_checkpoint=?,resume_approval_id=?,resume_at=NULL WHERE"
                  + " id=?",
              checkpoint,
              request,
              lease.id());
        });
  }

  public record DecisionInput(
      int expectedRevision, UUID idempotencyKey, String outcome, String comment) {}

  public Map<String, Object> decide(UUID request, long actor, DecisionInput input) {
    return decisions.decide(request, actor, input);
  }

  public Map<String, Object> result(WorkflowRunService.Lease lease, UUID request) {
    var approval =
        records.one(
            "SELECT * FROM approval_requests WHERE id=? AND run_ref=? AND owner_id=?",
            request,
            lease.id(),
            lease.owner());
    if (!Set.of("APPROVED", "REJECTED", "EXPIRED").contains(approval.get("state")))
      throw conflict("APPROVAL_NOT_RESOLVED");
    if ("EXPIRED".equals(approval.get("state"))) evidence.verifyBlueprint(approval);
    else evidence.verifyEvidence(approval);
    var decision =
        jdbc.queryForList(
            "SELECT id FROM approval_decisions WHERE request_id=?", UUID.class, request);
    var result = new LinkedHashMap<String, Object>();
    result.put("request", request.toString());
    result.put("outcome", approval.get("state"));
    result.put("approved", "APPROVED".equals(approval.get("state")));
    if (!decision.isEmpty()) result.put("decision", decision.get(0).toString());
    return result;
  }

  public void verifyResume(WorkflowRunService.Lease lease) {
    var ids =
        jdbc.queryForList(
            "SELECT resume_approval_id FROM workflow_runs WHERE id=? AND owner_id=? AND"
                + " resume_approval_id IS NOT NULL",
            UUID.class,
            lease.id(),
            lease.owner());
    if (!ids.isEmpty()) {
      result(lease, ids.get(0));
      jdbc.update(
          "UPDATE workflow_runs SET resume_approval_id=NULL WHERE id=? AND owner_id=? AND"
              + " resume_approval_id=?",
          lease.id(),
          lease.owner(),
          ids.get(0));
    }
  }

  public Map<String, Object> traceOutputs(
      WorkflowRunService.Lease lease, Map<String, Object> outputs) {
    var result = new LinkedHashMap<>(outputs);
    for (String kind : List.of("request", "decision"))
      if (outputs.get(kind) instanceof String id)
        result.put(
            kind,
            new TracePolicy.SafeReference(
                lease.owner(), "approval-" + kind, UUID.fromString(id).toString()));
    return result;
  }

  public Map<String, Object> view(UUID id, long actor) {
    return inbox.view(id, actor);
  }

  public List<Map<String, Object>> list(long actor, String state, int page, int size) {
    return inbox.list(actor, state, page, size);
  }

  public Map<String, Object> signature(UUID request, UUID decision, long actor) {
    return inbox.signature(request, decision, actor);
  }

  public void cancel(UUID id, long owner) {
    tx.executeWithoutResult(
        status -> {
          var request =
              records.one(
                  "SELECT * FROM approval_requests WHERE id=? AND owner_id=? FOR UPDATE",
                  id,
                  owner);
          if (!"PENDING".equals(request.get("state"))) throw conflict("APPROVAL_RESOLVED_OR_STALE");
          expiry.resolveSystem(request, "CANCELLED", Long.toString(owner));
        });
  }

  public int sweep() {
    return expiry.sweep();
  }

  public void grant(long owner, long blueprint, long reviewer, boolean enabled) {
    reviewers.grant(owner, blueprint, reviewer, enabled);
  }

  public static String hash(String value) {
    return ApprovalCodec.hash(value);
  }

  public static String hash(byte[] value) {
    return ApprovalCodec.hash(value);
  }

  private static long positiveId(Object value) {
    try {
      long id = Long.parseLong(String.valueOf(value));
      if (id > 0) return id;
    } catch (Exception ignored) {
    }
    throw conflict("INVALID_REVIEWER");
  }

  private static int bounded(Object value, int min, int max) {
    try {
      int number = Integer.parseInt(String.valueOf(value));
      if (number >= min && number <= max) return number;
    } catch (Exception ignored) {
    }
    throw conflict("INVALID_APPROVAL_POLICY");
  }
}
