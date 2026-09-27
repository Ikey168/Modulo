package com.modulo.blueprint.approval;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Expiry handling: the periodic sweep that expires, cancels or supersedes pending requests and
 * sends reviewer reminders, and the system resolution that also settles the waiting run.
 */
final class ApprovalExpiry {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final ApprovalRecords records;

  ApprovalExpiry(JdbcTemplate jdbc, TransactionTemplate tx, ApprovalRecords records) {
    this.jdbc = jdbc;
    this.tx = tx;
    this.records = records;
  }

  int sweep() {
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
            records.notifyReviewer(
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

  /**
   * Resolve a pending request without a reviewer decision. An expired request lets the run
   * resume (to its expired branch); any other state cancels or dead-letters the waiting run. A
   * non-null actor is the owner cancelling, which also requests run cancellation.
   */
  void resolveSystem(Map<String, Object> request, String state, String actor) {
    UUID id = (UUID) request.get("id");
    jdbc.update(
        "UPDATE approval_requests SET state=?,revision=revision+1,resolved_at=clock_timestamp()"
            + " WHERE id=? AND state='PENDING'",
        state,
        id);
    records.event(id, state, actor);
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
}
