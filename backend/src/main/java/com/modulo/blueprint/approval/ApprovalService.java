package com.modulo.blueprint.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.execution.*;
import com.modulo.entity.Note;
import com.modulo.service.NoteService;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ApprovalService {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final ObjectMapper json;
  private final TracePolicy traces;
  private final WorkflowRunService runs;
  private final NoteService notes;

  private final ApprovalSigningService signing;

  public ApprovalService(
      JdbcTemplate jdbc,
      PlatformTransactionManager manager,
      ObjectMapper json,
      TracePolicy traces,
      WorkflowRunService runs,
      NoteService notes,
      ApprovalSigningService signing) {
    this.signing = signing;
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(manager);
    this.json =
        json.copy()
            .enable(com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
    this.traces = traces;
    this.runs = runs;
    this.notes = notes;
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
              one(
                  "SELECT * FROM workflow_runs WHERE id=? AND owner_id=? AND state='RUNNING' FOR"
                      + " UPDATE",
                  lease.id(),
                  lease.owner());
          var blueprint =
              one(
                  "SELECT id,owner_id,version,config::text,updated_at FROM plugin_registry WHERE"
                      + " id=? AND owner_id=? AND status='ACTIVE' AND runtime='BLUEPRINT' FOR"
                      + " SHARE",
                  run.get("blueprint_id"),
                  lease.owner());
          requireCapability(run.get("blueprint_id"));
          if (!digestJson((String) blueprint.get("config")).equals(run.get("blueprint_digest")))
            throw conflict("BLUEPRINT_CHANGED");
          if (jdbc.queryForList("SELECT id FROM users WHERE id=?", Long.class, reviewer).isEmpty())
            throw unavailable();
          // The owned, persisted node configuration is the initial explicit reviewer selection.
          // An existing revocation is never overwritten by execution.
          jdbc.update(
              "INSERT INTO approval_grants(blueprint_id,owner_id,approver_id) VALUES (?,?,?) ON"
                  + " CONFLICT DO NOTHING",
              run.get("blueprint_id"),
              lease.owner(),
              reviewer);
          if (!granted(run.get("blueprint_id"), lease.owner(), reviewer)) throw unavailable();
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
          Map<String, Object> checks = evidence(inputs, lease.owner());
          String encoded = encode(checks);
          if (encoded.getBytes(StandardCharsets.UTF_8).length > 65536)
            throw conflict("EVIDENCE_TOO_LARGE");
          var summary = new LinkedHashMap<String, Object>();
          summary.put("typed", parse(traces.summarize(lease.owner(), inputs, false)));
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
                  encode(
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
              encode(summary),
              policy,
              ttl,
              reminders);
          event(id, "REQUESTED", Long.toString(lease.owner()));
          jdbc.update("UPDATE approval_requests SET state='PENDING' WHERE id=?", id);
          event(id, "PENDING", null);
          notifyReviewer(id, reviewer, 0);
          return id;
        });
  }

  public void waitFor(
      WorkflowRunService.Lease lease, UUID step, UUID request, int checkpoint, long duration) {
    tx.executeWithoutResult(
        status -> {
          var approval =
              one(
                  "SELECT * FROM approval_requests WHERE id=? AND run_ref=? AND owner_id=? FOR"
                      + " UPDATE",
                  request,
                  lease.id(),
                  lease.owner());
          one(
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
    if (input.idempotencyKey() == null
        || input.expectedRevision() < 1
        || !Set.of("APPROVE", "REJECT").contains(input.outcome() == null ? "" : input.outcome()))
      throw conflict("INVALID_DECISION");
    String comment =
        input.comment() == null ? null : Normalizer.normalize(input.comment(), Normalizer.Form.NFC);
    if (comment != null && comment.getBytes(StandardCharsets.UTF_8).length > 4096
        || "REJECT".equals(input.outcome()) && (comment == null || comment.isBlank()))
      throw conflict("COMMENT_REQUIRED_OR_TOO_LARGE");
    String payload =
        hash(encode(Arrays.asList(input.expectedRevision(), input.outcome(), comment)));
    return tx.execute(
        status -> {
          var approval = one("SELECT * FROM approval_requests WHERE id=? FOR UPDATE", request);
          long owner = ((Number) approval.get("owner_id")).longValue();
          if (!Objects.equals(approval.get("approver_ref"), Long.toString(actor))
              || actor == owner
              || !granted(approval.get("blueprint_id"), owner, actor)) throw unavailable();
          var duplicate =
              jdbc.queryForList(
                  "SELECT id,payload_digest FROM approval_decisions WHERE request_id=? AND"
                      + " idempotency_key=?",
                  request,
                  input.idempotencyKey());
          if (!duplicate.isEmpty()) {
            if (!payload.equals(duplicate.get(0).get("payload_digest")))
              throw conflict("DECISION_KEY_REUSED");
            return Map.of(
                "id",
                duplicate.get(0).get("id"),
                "state",
                approval.get("state"),
                "signatureState",
                signing.state((UUID) duplicate.get(0).get("id")));
          }
          if (!"PENDING".equals(approval.get("state"))
              || ((Number) approval.get("revision")).intValue() != input.expectedRevision())
            throw conflict("APPROVAL_RESOLVED_OR_STALE");
          var run =
              one(
                  "SELECT * FROM workflow_runs WHERE id=? AND owner_id=? FOR UPDATE",
                  approval.get("run_ref"),
                  owner);
          if (!"WAITING".equals(run.get("state"))
              || !request.equals(run.get("resume_approval_id"))
              || !Objects.equals(approval.get("checkpoint"), run.get("resume_checkpoint"))
              || !Objects.equals(approval.get("run_attempt"), run.get("attempt")))
            throw conflict("APPROVAL_WAIT_CHANGED");
          if (!jdbc.queryForObject(
              "SELECT expires_at>clock_timestamp() FROM approval_requests WHERE id=?",
              Boolean.class,
              request)) throw conflict("APPROVAL_EXPIRED");
          verifyEvidence(approval);
          Instant now =
              jdbc.queryForObject("SELECT clock_timestamp()", Timestamp.class)
                  .toInstant()
                  .truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
          if (!now.isBefore(((Timestamp) approval.get("expires_at")).toInstant()))
            throw conflict("APPROVAL_EXPIRED");
          UUID decision = UUID.randomUUID();
          var binding = new LinkedHashMap<String, Object>();
          binding.put("version", "1");
          binding.put("requestId", request.toString());
          binding.put("runId", approval.get("run_ref").toString());
          binding.put("runAttempt", approval.get("run_attempt").toString());
          binding.put("nodeId", approval.get("node_id"));
          binding.put("blueprintDigest", approval.get("blueprint_digest"));
          binding.put("evidenceDigest", approval.get("evidence_digest"));
          binding.put("policyDigest", approval.get("policy_digest"));
          binding.put("nonceDigest", hash((byte[]) approval.get("resume_nonce")));
          binding.put("checkpoint", approval.get("checkpoint").toString());
          jdbc.update(
              "INSERT INTO"
                  + " approval_decisions(id,request_id,request_revision,actor_ref,outcome,comment_text,comment_digest,idempotency_key,payload_digest,decided_at,binding)"
                  + " VALUES (?,?,?,?,?,?,?,?,?,?,CAST(? AS jsonb))",
              decision,
              request,
              input.expectedRevision(),
              Long.toString(actor),
              input.outcome(),
              comment,
              hash(comment == null ? "" : comment),
              input.idempotencyKey(),
              payload,
              Timestamp.from(now),
              encode(binding));
          String signatureState = signing.signDecision(decision);
          String state = "APPROVE".equals(input.outcome()) ? "APPROVED" : "REJECTED";
          jdbc.update(
              "UPDATE approval_requests SET state=?,revision=revision+1,resolved_at=? WHERE id=?",
              state,
              Timestamp.from(now),
              request);
          event(request, state, Long.toString(actor));
          jdbc.update(
              "UPDATE workflow_runs SET resume_at=clock_timestamp() WHERE id=? AND state='WAITING'"
                  + " AND resume_approval_id=?",
              approval.get("run_ref"),
              request);
          return Map.of("id", decision, "state", state, "signatureState", signatureState);
        });
  }

  public Map<String, Object> result(WorkflowRunService.Lease lease, UUID request) {
    var approval =
        one(
            "SELECT * FROM approval_requests WHERE id=? AND run_ref=? AND owner_id=?",
            request,
            lease.id(),
            lease.owner());
    if (!Set.of("APPROVED", "REJECTED", "EXPIRED").contains(approval.get("state")))
      throw conflict("APPROVAL_NOT_RESOLVED");
    if ("EXPIRED".equals(approval.get("state"))) verifyBlueprint(approval);
    else verifyEvidence(approval);
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

  public Map<String, Object> view(UUID id, long actor) {
    var rows = jdbc.queryForList(visibleSelect() + " AND a.id=?", actor, actor, id);
    if (rows.isEmpty()) throw unavailable();
    return project(rows.get(0), actor);
  }

  public List<Map<String, Object>> list(long actor, String state, int page, int size) {
    if (page < 0
        || page > 10000
        || size < 1
        || size > 100
        || !state.isEmpty()
            && !Set.of(
                    "REQUESTED",
                    "PENDING",
                    "APPROVED",
                    "REJECTED",
                    "EXPIRED",
                    "CANCELLED",
                    "SUPERSEDED")
                .contains(state)) throw conflict("INVALID_APPROVAL_FILTER");
    String sql = visibleSelect();
    var args = new ArrayList<Object>(List.of(actor, actor));
    if (!state.isEmpty()) {
      sql += " AND a.state=?";
      args.add(state);
    }
    args.add(size);
    args.add(page * size);
    return jdbc
        .queryForList(
            sql + " ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?", args.toArray())
        .stream()
        .map(row -> project(row, actor))
        .toList();
  }

  private String visibleSelect() {
    return "SELECT a.*,p.blueprint_name,r.state AS run_state,r.resume_approval_id FROM"
        + " approval_requests a LEFT JOIN plugin_registry p ON p.id=a.blueprint_id AND"
        + " p.owner_id=a.owner_id LEFT JOIN workflow_runs r ON r.id=a.run_id AND"
        + " r.owner_id=a.owner_id WHERE (a.owner_id=? OR (a.approver_id=? AND EXISTS(SELECT"
        + " 1 FROM approval_grants g WHERE g.blueprint_id=a.blueprint_id AND"
        + " g.owner_id=a.owner_id AND g.approver_id=a.approver_id AND g.enabled)))";
  }

  private Map<String, Object> project(Map<String, Object> row, long actor) {
    var result = new LinkedHashMap<String, Object>();
    result.put("id", row.get("id"));
    result.put("revision", row.get("revision"));
    result.put("state", row.get("state"));
    result.put("runState", row.get("run_state"));
    result.put("requester", row.get("requester_ref"));
    result.put("reviewer", row.get("approver_ref"));
    result.put("blueprintId", row.get("blueprint_id"));
    result.put("blueprintName", traces.identifier((String) row.get("blueprint_name")));
    result.put("expiresAt", ((Timestamp) row.get("expires_at")).toInstant().toString());
    result.put("createdAt", ((Timestamp) row.get("created_at")).toInstant().toString());
    result.put("summary", parse(row.get("safe_summary").toString()));
    result.put("evidenceDigest", row.get("evidence_digest"));
    result.put("redacted", true);
    result.put("hasReport",!jdbc.queryForList("SELECT request_id FROM approval_report_artifacts WHERE request_id=?",row.get("id")).isEmpty());
    result.put("commentRequiredOnReject", true);
    boolean reviewer = Long.toString(actor).equals(row.get("approver_ref"));
    result.put(
        "canDecide",
        reviewer
            && "PENDING".equals(row.get("state"))
            && "WAITING".equals(row.get("run_state"))
            && row.get("id").equals(row.get("resume_approval_id"))
            && ((Timestamp) row.get("expires_at")).toInstant().isAfter(Instant.now()));
    if (((Number) row.get("owner_id")).longValue() == actor) {
      result.put("runId", row.get("run_ref"));
      result.put("canCancel", "PENDING".equals(row.get("state")));
    }
    result.put(
        "decisions",
        jdbc.queryForList(
            "SELECT"
                + " d.id,request_revision,actor_ref,outcome,comment_text,comment_digest,decided_at,CASE"
                + " WHEN s.decision_id IS NULL THEN 'UNSIGNED' ELSE 'SERVER_SIGNED' END AS"
                + " signature_state FROM approval_decisions d LEFT JOIN approval_signatures s ON"
                + " s.decision_id=d.id WHERE request_id=? ORDER BY decided_at,d.id",
            row.get("id")));
    result.put(
        "events",
        jdbc.queryForList(
            "SELECT state,actor_ref,created_at FROM approval_events WHERE request_id=? ORDER BY id",
            row.get("id")));
    return result;
  }

  public Map<String, Object> signature(UUID request, UUID decision, long actor) {
    view(request, actor);
    if (jdbc.queryForObject(
            "SELECT count(*) FROM approval_decisions WHERE id=? AND request_id=?",
            Long.class,
            decision,
            request)
        != 1) throw unavailable();
    return signing.envelope(decision);
  }

  public void cancel(UUID id, long owner) {
    tx.executeWithoutResult(
        status -> {
          var request =
              one(
                  "SELECT * FROM approval_requests WHERE id=? AND owner_id=? FOR UPDATE",
                  id,
                  owner);
          if (!"PENDING".equals(request.get("state"))) throw conflict("APPROVAL_RESOLVED_OR_STALE");
          resolveSystem(request, "CANCELLED", Long.toString(owner));
        });
  }

  public int sweep() {
    return tx.execute(
        status -> {
          var due =
              jdbc.queryForList(
                  "SELECT a.*,a.expires_at<=clock_timestamp() AS expiry_due FROM approval_requests"
                      + " a LEFT JOIN workflow_runs r ON r.id=a.run_id LEFT JOIN plugin_registry p"
                      + " ON p.id=a.blueprint_id WHERE a.state='PENDING' AND"
                      + " (a.expires_at<=clock_timestamp() OR r.id IS NULL OR r.state IN"
                      + " ('CANCELLED','FAILED','DEAD_LETTER','SUCCEEDED') OR p.id IS NULL OR"
                      + " p.updated_at IS DISTINCT FROM a.blueprint_updated_at OR NOT EXISTS(SELECT"
                      + " 1 FROM plugin_permissions permission WHERE"
                      + " permission.plugin_id=a.blueprint_id AND"
                      + " permission.permission='approval:request' AND permission.granted) OR NOT"
                      + " EXISTS(SELECT 1 FROM approval_grants g WHERE"
                      + " g.blueprint_id=a.blueprint_id AND g.owner_id=a.owner_id AND"
                      + " g.approver_id=a.approver_id AND g.enabled)) ORDER BY a.expires_at LIMIT"
                      + " 100 FOR UPDATE OF a SKIP LOCKED");
          for (var request : due) {
            var run =
                jdbc.queryForList(
                    "SELECT state FROM workflow_runs WHERE id=?",
                    String.class,
                    request.get("run_id"));
            String state =
                run.isEmpty()
                        || Set.of("CANCELLED", "FAILED", "DEAD_LETTER", "SUCCEEDED")
                            .contains(run.get(0))
                    ? "CANCELLED"
                    : Boolean.TRUE.equals(request.get("expiry_due")) ? "EXPIRED" : "SUPERSEDED";
            resolveSystem(request, state, null);
          }
          var reminders =
              jdbc.queryForList(
                  "SELECT * FROM approval_requests WHERE state='PENDING' AND"
                      + " expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM approval_grants g"
                      + " WHERE g.blueprint_id=approval_requests.blueprint_id AND"
                      + " g.approver_id=approval_requests.approver_id AND"
                      + " g.owner_id=approval_requests.owner_id AND g.enabled) AND"
                      + " next_reminder_at<=clock_timestamp() AND"
                      + " reminders_sent<reminders_requested AND approver_id IS NOT NULL ORDER BY"
                      + " next_reminder_at LIMIT 100 FOR UPDATE SKIP LOCKED");
          for (var request : reminders) {
            int count = ((Number) request.get("reminders_sent")).intValue() + 1;
            notifyReviewer(
                (UUID) request.get("id"), ((Number) request.get("approver_id")).longValue(), count);
            jdbc.update(
                "UPDATE approval_requests SET"
                    + " reminders_sent=?,next_reminder_at=clock_timestamp()+INTERVAL '1 hour' WHERE"
                    + " id=?",
                count,
                request.get("id"));
          }
          return due.size();
        });
  }

  private void resolveSystem(Map<String, Object> request, String state, String actor) {
    UUID id = (UUID) request.get("id");
    jdbc.update(
        "UPDATE approval_requests SET state=?,revision=revision+1,resolved_at=clock_timestamp()"
            + " WHERE id=? AND state='PENDING'",
        state,
        id);
    event(id, state, actor);
    if (actor != null)
      jdbc.update(
          "UPDATE workflow_runs SET cancel_requested_at=clock_timestamp(),cancelled_by=? WHERE id=?"
              + " AND state IN ('RUNNING','WAITING')",
          Long.parseLong(actor),
          request.get("run_id"));
    if ("EXPIRED".equals(state))
      jdbc.update(
          "UPDATE workflow_runs SET resume_at=clock_timestamp() WHERE id=? AND state='WAITING' AND"
              + " resume_approval_id=?",
          request.get("run_id"),
          id);
    else {
      jdbc.update(
          "UPDATE workflow_runs SET cancel_requested_at=clock_timestamp() WHERE id=? AND"
              + " state='RUNNING'",
          request.get("run_id"));
      jdbc.update(
          "UPDATE workflow_runs SET state=?,finished_at=clock_timestamp(),error_class=? WHERE id=?"
              + " AND state='WAITING' AND resume_approval_id=?",
          "CANCELLED".equals(state) ? "CANCELLED" : "DEAD_LETTER",
          "APPROVAL_" + state,
          request.get("run_id"),
          id);
      jdbc.update(
          "UPDATE workflow_steps SET state='CANCELLED',finished_at=clock_timestamp() WHERE id=? AND"
              + " state='WAITING'",
          request.get("wait_step_id"));
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

  private void verifyBlueprint(Map<String, Object> approval) {
    long owner = ((Number) approval.get("owner_id")).longValue();
    requireCapability(approval.get("blueprint_id"));
    var blueprint =
        one(
            "SELECT config::text FROM plugin_registry WHERE id=? AND owner_id=? AND status='ACTIVE'"
                + " FOR SHARE",
            approval.get("blueprint_id"),
            owner);
    if (!digestJson((String) blueprint.get("config")).equals(approval.get("blueprint_digest")))
      throw conflict("APPROVAL_SUPERSEDED");
  }

  private void verifyEvidence(Map<String, Object> approval) {
    long owner = ((Number) approval.get("owner_id")).longValue();
    verifyBlueprint(approval);
    var checks = parse(approval.get("evidence_checks").toString());
    if (!hash(encode(checks)).equals(approval.get("evidence_digest")))
      throw conflict("EVIDENCE_CHANGED");
    runs.asOwner(
        new WorkflowRunService.Lease((UUID) approval.get("run_ref"), owner, false),
        () -> {
          for (var check : (List<?>) checks.get("notes")) {
            var ref = (Map<?, ?>) check;
            var note =
                notes
                    .findByIdForApproval(Long.parseLong(ref.get("id").toString()))
                    .orElseThrow(() -> conflict("EVIDENCE_CHANGED"));
            if (!Objects.equals(note.getUserId(), owner)
                || !noteDigest(note).equals(ref.get("digest"))) throw conflict("EVIDENCE_CHANGED");
          }
          return null;
        });
  }

  private Map<String, Object> evidence(Map<String, Object> inputs, long owner) {
    var references = new ArrayList<Map<String, Object>>();
    collectNotes(inputs, owner, references, 0);
    return Map.of(
        "notes",
        references,
        "inputDigest",
        hash(encode(evidenceValue(inputs))),
        "summary",
        parse(traces.summarize(owner, inputs, false)));
  }

  private Object evidenceValue(Object value) {
    if (value instanceof Note note)
      return Map.of("noteId", note.getId().toString(), "noteDigest", noteDigest(note));
    if (value instanceof Map<?, ?> map) {
      var normalized = new TreeMap<String, Object>();
      map.forEach((key, item) -> normalized.put((String) key, evidenceValue(item)));
      return normalized;
    }
    if (value instanceof Collection<?> list) return list.stream().map(this::evidenceValue).toList();
    return value;
  }

  private void collectNotes(
      Object value, long owner, List<Map<String, Object>> references, int depth) {
    if (depth > 12) throw conflict("EVIDENCE_TOO_LARGE");
    if (value == null
        || value instanceof String
        || value instanceof Number
        || value instanceof Boolean) return;
    if (value instanceof Note note) {
      if (!Objects.equals(note.getUserId(), owner) || note.getId() == null) throw unavailable();
      if (references.size() >= 16) throw conflict("EVIDENCE_TOO_LARGE");
      references.add(Map.of("id", note.getId().toString(), "digest", noteDigest(note)));
      return;
    }
    if (value instanceof Map<?, ?> map && map.size() <= 1000) {
      for (var entry : map.entrySet()) {
        if (!(entry.getKey() instanceof String)) throw conflict("INVALID_EVIDENCE");
        collectNotes(entry.getValue(), owner, references, depth + 1);
      }
      return;
    }
    if (value instanceof Collection<?> list && list.size() <= 1000) {
      for (var item : list) collectNotes(item, owner, references, depth + 1);
      return;
    }
    throw conflict("INVALID_EVIDENCE");
  }

  private String noteDigest(Note note) {
    return hash(
        encode(
            Arrays.asList(
                note.getId(),
                note.getUserId(),
                note.getVersion(),
                note.getTitle(),
                note.getContent(),
                note.getMarkdownContent())));
  }

  private void requireCapability(Object blueprint) {
    var grants =
        jdbc.queryForList(
            "SELECT granted FROM plugin_permissions WHERE plugin_id=? AND"
                + " permission='approval:request' FOR SHARE",
            Boolean.class,
            blueprint);
    if (grants.isEmpty() || !Boolean.TRUE.equals(grants.get(0))) throw unavailable();
  }

  private boolean granted(Object blueprint, long owner, long reviewer) {
    return !jdbc.queryForList(
            "SELECT g.approver_id FROM approval_grants g JOIN users u ON u.id=g.approver_id WHERE"
                + " g.blueprint_id=? AND g.owner_id=? AND g.approver_id=? AND g.enabled FOR SHARE"
                + " OF g",
            Long.class,
            blueprint,
            owner,
            reviewer)
        .isEmpty();
  }

  public void grant(long owner, long blueprint, long reviewer, boolean enabled) {
    if (owner == reviewer || reviewer < 1) throw unavailable();
    if (jdbc.update(
            "INSERT INTO approval_grants(blueprint_id,owner_id,approver_id,enabled) SELECT"
                + " p.id,p.owner_id,u.id,? FROM plugin_registry p JOIN users u ON u.id=? WHERE"
                + " p.id=? AND p.owner_id=? AND p.runtime='BLUEPRINT' ON"
                + " CONFLICT(blueprint_id,approver_id) DO UPDATE SET enabled=EXCLUDED.enabled",
            enabled,
            reviewer,
            blueprint,
            owner)
        != 1) throw unavailable();
  }

  private Map<String, Object> one(String sql, Object... args) {
    var rows = jdbc.queryForList(sql, args);
    if (rows.isEmpty()) throw unavailable();
    return rows.get(0);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> parse(String value) {
    try {
      return json.readValue(value, Map.class);
    } catch (Exception invalid) {
      throw conflict("INVALID_EVIDENCE");
    }
  }

  private String digestJson(String value) {
    return hash(encode(parse(value)));
  }

  private String encode(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception invalid) {
      throw conflict("INVALID_EVIDENCE");
    }
  }

  public static String hash(String value) {
    return hash(value.getBytes(StandardCharsets.UTF_8));
  }

  public static String hash(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (Exception impossible) {
      throw new IllegalStateException(impossible);
    }
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

  private void event(UUID id, String state, String actor) {
    jdbc.update(
        "INSERT INTO approval_events(request_id,state,actor_ref) VALUES (?,?,?)", id, state, actor);
  }

  private void notifyReviewer(UUID id, long reviewer, int reminder) {
    jdbc.update(
        "INSERT INTO"
            + " notifications(user_id,type,message,is_read,created_at,approval_request_id,approval_notification_key)"
            + " VALUES (?,'APPROVAL',?,false,CURRENT_TIMESTAMP,?,?) ON"
            + " CONFLICT(approval_notification_key) DO NOTHING",
        Long.toString(reviewer),
        reminder == 0
            ? "Approval requested. Open your approval inbox."
            : "An approval request is awaiting your decision.",
        id,
        id + ":" + reminder);
  }

  private static ResponseStatusException conflict(String reason) {
    return new ApprovalFailure(HttpStatus.CONFLICT, reason);
  }

  private static ResponseStatusException unavailable() {
    return new ApprovalFailure(HttpStatus.NOT_FOUND, "APPROVAL_NOT_AVAILABLE");
  }
}
