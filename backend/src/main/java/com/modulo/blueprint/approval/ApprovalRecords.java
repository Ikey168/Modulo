package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalErrors.unavailable;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Row access shared by the approval classes: single-row lookups, the approval event log and
 * reviewer notifications. Callers run these inside their own transaction.
 */
final class ApprovalRecords {
  private final JdbcTemplate jdbc;

  ApprovalRecords(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  Map<String, Object> one(String sql, Object... args) {
    var rows = jdbc.queryForList(sql, args);
    if (rows.isEmpty()) throw unavailable();
    return rows.get(0);
  }

  void event(UUID id, String state, String actor) {
    jdbc.update(
        "INSERT INTO approval_events(request_id,state,actor_ref) VALUES (?,?,?)", id, state, actor);
  }

  void notifyReviewer(UUID id, long reviewer, int reminder) {
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
}
