package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalCodec.hash;
import static com.modulo.blueprint.approval.ApprovalErrors.conflict;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Reviewer decisions: validates the decision input, authorizes the reviewer, re-verifies the
 * bound evidence, records the decision with its binding (request, run attempt, node, Blueprint,
 * evidence, policy and nonce digests), signs it through {@link ApprovalSigningService} and wakes
 * the waiting run. A repeated idempotency key returns the recorded decision.
 */
final class ApprovalDecisions {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final ApprovalCodec codec;
  private final ApprovalRecords records;
  private final ApprovalReviewers reviewers;
  private final ApprovalEvidence evidence;
  private final ApprovalSigningService signing;

  ApprovalDecisions(
      JdbcTemplate jdbc,
      TransactionTemplate tx,
      ApprovalCodec codec,
      ApprovalRecords records,
      ApprovalReviewers reviewers,
      ApprovalEvidence evidence,
      ApprovalSigningService signing) {
    this.jdbc = jdbc;
    this.tx = tx;
    this.codec = codec;
    this.records = records;
    this.reviewers = reviewers;
    this.evidence = evidence;
    this.signing = signing;
  }

  Map<String, Object> decide(UUID request, long actor, ApprovalService.DecisionInput input) {
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
        hash(codec.encode(Arrays.asList(input.expectedRevision(), input.outcome(), comment)));
    return tx.execute(
        status -> {
          var approval = records.one("SELECT * FROM approval_requests WHERE id=? FOR UPDATE", request);
          long owner = ((Number) approval.get("owner_id")).longValue();
          reviewers.authorizeDecision(approval, owner, actor);
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
              records.one(
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
          evidence.verifyEvidence(approval);
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
              codec.encode(binding));
          String signatureState = signing.signDecision(decision);
          String state = "APPROVE".equals(input.outcome()) ? "APPROVED" : "REJECTED";
          jdbc.update(
              "UPDATE approval_requests SET state=?,revision=revision+1,resolved_at=? WHERE id=?",
              state,
              Timestamp.from(now),
              request);
          records.event(request, state, Long.toString(actor));
          jdbc.update(
              "UPDATE workflow_runs SET resume_at=clock_timestamp() WHERE id=? AND state='WAITING'"
                  + " AND resume_approval_id=?",
              approval.get("run_ref"),
              request);
          return Map.of("id", decision, "state", state, "signatureState", signatureState);
        });
  }
}
