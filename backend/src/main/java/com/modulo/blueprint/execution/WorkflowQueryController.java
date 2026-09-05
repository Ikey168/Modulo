package com.modulo.blueprint.execution;

import com.modulo.security.AuthenticatedUserService;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workflow-runs")
@PreAuthorize("isAuthenticated()")
public class WorkflowQueryController {
  private final JdbcTemplate jdbc;
  private final AuthenticatedUserService users;

  public WorkflowQueryController(JdbcTemplate jdbc, AuthenticatedUserService users) {
    this.jdbc = jdbc;
    this.users = users;
  }

  private static final String FROM =
      " FROM workflow_runs r LEFT JOIN plugin_registry p ON p.id=r.blueprint_id AND"
          + " p.owner_id=r.owner_id ";
  private static final String COLUMNS =
      "r.id,r.blueprint_id,p.blueprint_name,r.blueprint_version,r.trigger_type,r.state,r.attempt,r.created_at,r.started_at,r.finished_at,r.error_class,r.parent_run_id,r.cancel_requested_at,r.cancelled_by,r.retry_confirmed,r.retry_from_sequence,r.max_auto_attempts,r.retry_backoff_seconds,EXTRACT(EPOCH"
          + " FROM"
          + " (COALESCE(r.finished_at,CURRENT_TIMESTAMP)-COALESCE(r.started_at,r.created_at)))*1000"
          + " AS duration_ms";

  @GetMapping
  public Map<String, Object> list(
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String state,
      @RequestParam(required = false) Long blueprint,
      @RequestParam(defaultValue = "") String trigger,
      @RequestParam(required = false) Instant after,
      @RequestParam(required = false) Instant before,
      @RequestParam(defaultValue = "0") long minDuration,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "25") int size) {
    if (q.length() > 128
        || trigger.length() > 128
        || page < 0
        || page > 10000
        || size < 1
        || size > 100
        || minDuration < 0) throw invalid();
    if (!state.isEmpty()
        && !Set.of(
                "QUEUED",
                "RUNNING",
                "WAITING",
                "RETRY_WAIT",
                "SUCCEEDED",
                "FAILED",
                "CANCELLED",
                "DEAD_LETTER")
            .contains(state)) throw invalid();
    StringBuilder where = new StringBuilder(" WHERE r.owner_id=?");
    List<Object> args = new ArrayList<>();
    args.add(users.requireUserId());
    if (!state.isEmpty()) {
      where.append(" AND r.state=?");
      args.add(state);
    }
    if (blueprint != null) {
      where.append(" AND r.blueprint_id=?");
      args.add(blueprint);
    }
    if (!trigger.isEmpty()) {
      where.append(" AND r.trigger_type=?");
      args.add(trigger);
    }
    if (after != null) {
      where.append(" AND r.created_at>=?");
      args.add(java.sql.Timestamp.from(after));
    }
    if (before != null) {
      where.append(" AND r.created_at<?");
      args.add(java.sql.Timestamp.from(before));
    }
    if (minDuration > 0) {
      where.append(
          " AND EXTRACT(EPOCH FROM"
              + " (COALESCE(r.finished_at,CURRENT_TIMESTAMP)-COALESCE(r.started_at,r.created_at)))*1000>=?");
      args.add(minDuration);
    }
    if (!q.isBlank()) {
      where.append(
          " AND (POSITION(LOWER(?) IN LOWER(COALESCE(p.blueprint_name,'') || ' ' || r.id::text || '"
              + " ' || COALESCE(r.error_class,'')))>0)");
      args.add(q);
    }
    long total = jdbc.queryForObject("SELECT count(*)" + FROM + where, Long.class, args.toArray());
    args.add(size);
    args.add(page * size);
    var items =
        jdbc.queryForList(
            "SELECT "
                + COLUMNS
                + FROM
                + where
                + " ORDER BY r.created_at DESC,r.id DESC LIMIT ? OFFSET ?",
            args.toArray());
    return Map.of("items", items, "total", total, "page", page, "size", size);
  }

  @GetMapping("/summary")
  public Map<String, Object> summary() {
    var counts =
        jdbc.queryForList(
            "SELECT state,count(*) AS count FROM workflow_runs WHERE owner_id=? GROUP BY state",
            users.requireUserId());
    return Map.of("counts", counts);
  }

  @GetMapping("/{id}")
  public Map<String, Object> detail(
      @PathVariable UUID id, @RequestParam(defaultValue = "0") int stepPage) {
    if (stepPage < 0 || stepPage > 10000) throw invalid();
    long owner = users.requireUserId();
    var runs =
        jdbc.queryForList("SELECT " + COLUMNS + FROM + " WHERE r.owner_id=? AND r.id=?", owner, id);
    if (runs.isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "RUN_NOT_AVAILABLE");
    var steps =
        jdbc.queryForList(
            "SELECT"
                + " s.id,s.sequence,s.attempt,s.node_id,s.node_type,s.state,s.started_at,s.finished_at,s.duration_ms,s.error_class,s.input_metadata::text,s.output_metadata::text"
                + " FROM workflow_steps s JOIN workflow_runs r ON r.id=s.run_id WHERE r.owner_id=?"
                + " AND r.id=? ORDER BY s.attempt,s.sequence LIMIT 100 OFFSET ?",
            owner,
            id,
            stepPage * 100);
    var nodeIds =
        jdbc.queryForList(
            "SELECT DISTINCT s.node_id FROM workflow_steps s JOIN workflow_runs r ON r.id=s.run_id"
                + " WHERE r.owner_id=? AND r.id=? ORDER BY s.node_id LIMIT 1000",
            String.class,
            owner,
            id);
    long total =
        jdbc.queryForObject(
            "SELECT count(*) FROM workflow_steps s JOIN workflow_runs r ON r.id=s.run_id WHERE"
                + " r.owner_id=? AND r.id=?",
            Long.class,
            owner,
            id);
    return Map.of(
        "run",
        runs.get(0),
        "steps",
        steps,
        "nodeIds",
        nodeIds,
        "stepTotal",
        total,
        "stepPage",
        stepPage,
        "checkpoints",
        jdbc.queryForList(
            "SELECT c.sequence FROM workflow_checkpoints c JOIN workflow_runs r ON r.id=c.run_id"
                + " WHERE r.id=? AND r.owner_id=? ORDER BY c.sequence",
            Integer.class,
            id,
            owner));
  }

  private static ResponseStatusException invalid() {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_RUN_FILTER");
  }
}
