package com.modulo.blueprint.approval;

import static com.modulo.blueprint.approval.ApprovalErrors.conflict;
import static com.modulo.blueprint.approval.ApprovalErrors.unavailable;

import com.modulo.blueprint.execution.TracePolicy;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Read side of approvals: the requests visible to an actor (as owner, or as a still-granted
 * reviewer), their redacted projection, and decision signature envelopes.
 */
final class ApprovalInbox {
  private final JdbcTemplate jdbc;
  private final ApprovalCodec codec;
  private final TracePolicy traces;
  private final ApprovalSigningService signing;

  ApprovalInbox(
      JdbcTemplate jdbc, ApprovalCodec codec, TracePolicy traces, ApprovalSigningService signing) {
    this.jdbc = jdbc;
    this.codec = codec;
    this.traces = traces;
    this.signing = signing;
  }

  Map<String, Object> view(UUID id, long actor) {
    var rows = jdbc.queryForList(visibleSelect() + " AND a.id=?", actor, actor, id);
    if (rows.isEmpty()) throw unavailable();
    return project(rows.get(0), actor);
  }

  List<Map<String, Object>> list(long actor, String state, int page, int size) {
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

  Map<String, Object> signature(UUID request, UUID decision, long actor) {
    view(request, actor);
    if (jdbc.queryForObject(
            "SELECT count(*) FROM approval_decisions WHERE id=? AND request_id=?",
            Long.class,
            decision,
            request)
        != 1) throw unavailable();
    return signing.envelope(decision);
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
    result.put("summary", codec.parse(row.get("safe_summary").toString()));
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
}
