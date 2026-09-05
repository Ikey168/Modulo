package com.modulo.blueprint.execution;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowOperationsService {
  private static final List<String> STATES =
      List.of(
          "QUEUED",
          "RUNNING",
          "WAITING",
          "RETRY_WAIT",
          "SUCCEEDED",
          "FAILED",
          "CANCELLED",
          "DEAD_LETTER");
  private final JdbcTemplate jdbc;
  private final TransactionTemplate tx;
  private final Map<String, AtomicReference<Double>> values = new HashMap<>();

  public WorkflowOperationsService(
      JdbcTemplate jdbc, PlatformTransactionManager manager, MeterRegistry registry) {
    this.jdbc = jdbc;
    this.tx = new TransactionTemplate(manager);
    for (String state : STATES) {
      register(registry, "modulo.workflow.runs", "runs:" + state, "state", state);
      register(registry, "modulo.workflow.run.rate", "rate:" + state, "state", state);
    }
    for (String quantile : List.of("0.5", "0.95", "0.99"))
      register(
          registry,
          "modulo.workflow.run.latency.seconds",
          "latency:" + quantile,
          "quantile",
          quantile);
    for (String metric : List.of("retries", "queue.depth", "schedule.lag.seconds", "alerts.unread"))
      register(registry, "modulo.workflow." + metric, metric, null, null);
  }

  private void register(MeterRegistry registry, String name, String key, String tag, String label) {
    var value = new AtomicReference<>(0.0);
    values.put(key, value);
    var gauge = Gauge.builder(name, value, AtomicReference::get);
    if (tag != null) gauge.tag(tag, label);
    gauge.register(registry);
  }

  public void refreshMetrics() {
    jdbc.update(
        "UPDATE workflow_alerts a SET read_at=CURRENT_TIMESTAMP WHERE a.route='INBOX' AND a.read_at"
            + " IS NULL AND NOT EXISTS (SELECT 1 FROM notifications n WHERE"
            + " n.workflow_alert_id=a.id AND NOT n.is_read)");
    for (String state : STATES) {
      values.get("runs:" + state).set(0.0);
      values.get("rate:" + state).set(0.0);
    }
    for (var row :
        jdbc.queryForList(
            "SELECT state,count(*) AS count,count(*) FILTER(WHERE"
                + " COALESCE(finished_at,created_at)>CURRENT_TIMESTAMP-INTERVAL '5 minutes')/300.0"
                + " AS rate FROM workflow_runs GROUP BY state")) {
      String state = (String) row.get("state");
      if (!STATES.contains(state)) continue;
      values.get("runs:" + state).set(((Number) row.get("count")).doubleValue());
      values.get("rate:" + state).set(((Number) row.get("rate")).doubleValue());
    }
    for (String quantile : List.of("0.5", "0.95", "0.99"))
      values
          .get("latency:" + quantile)
          .set(
              jdbc.queryForObject(
                  "SELECT COALESCE(percentile_cont(?) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM"
                      + " (finished_at-COALESCE(started_at,created_at)))),0) FROM workflow_runs"
                      + " WHERE finished_at>CURRENT_TIMESTAMP-INTERVAL '5 minutes'",
                  Double.class,
                  Double.parseDouble(quantile)));
    values
        .get("retries")
        .set(
            jdbc.queryForObject(
                "SELECT count(*)::float8 FROM workflow_runs WHERE parent_run_ref IS NOT NULL",
                Double.class));
    values
        .get("queue.depth")
        .set(
            jdbc.queryForObject(
                "SELECT count(*)::float8 FROM workflow_schedule_jobs WHERE state IN"
                    + " ('PENDING','RUNNING')",
                Double.class));
    values
        .get("schedule.lag.seconds")
        .set(
            jdbc.queryForObject(
                "SELECT COALESCE(MAX(GREATEST(0,EXTRACT(EPOCH FROM"
                    + " (CURRENT_TIMESTAMP-next_fire)))),0)::float8 FROM workflow_schedules s JOIN"
                    + " plugin_registry p ON p.id=s.blueprint_id AND p.owner_id=s.owner_id WHERE"
                    + " s.enabled AND p.status='ACTIVE' AND p.runtime='BLUEPRINT'",
                Double.class));
    values
        .get("alerts.unread")
        .set(
            jdbc.queryForObject(
                "SELECT count(*)::float8 FROM workflow_alerts WHERE read_at IS NULL",
                Double.class));
  }

  public record Policy(
      int retentionDays, int payloadHours, int failureThreshold, int windowMinutes, String route) {}

  public void policy(long owner, long blueprint, Policy policy) {
    if (policy.retentionDays() < 7
        || policy.retentionDays() > 365
        || policy.payloadHours() < 1
        || policy.payloadHours() > policy.retentionDays() * 24
        || policy.failureThreshold() < 1
        || policy.failureThreshold() > 1000
        || policy.windowMinutes() < 1
        || policy.windowMinutes() > 1440
        || policy.route() == null
        || !Set.of("NONE", "EXECUTION_CENTER", "INBOX").contains(policy.route()))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_WORKFLOW_POLICY");
    if (jdbc.update(
            "INSERT INTO"
                + " workflow_ops_policies(blueprint_id,owner_id,retention_days,payload_hours,failure_threshold,window_minutes,route)"
                + " SELECT id,owner_id,?,?,?,?,? FROM plugin_registry WHERE id=? AND owner_id=? AND"
                + " runtime='BLUEPRINT' ON CONFLICT(blueprint_id) DO UPDATE SET"
                + " retention_days=EXCLUDED.retention_days,payload_hours=EXCLUDED.payload_hours,failure_threshold=EXCLUDED.failure_threshold,window_minutes=EXCLUDED.window_minutes,route=EXCLUDED.route",
            policy.retentionDays(),
            policy.payloadHours(),
            policy.failureThreshold(),
            policy.windowMinutes(),
            policy.route(),
            blueprint,
            owner)
        != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "WORKFLOW_NOT_AVAILABLE");
  }

  public Map<String, Object> policy(long owner, long blueprint) {
    if (jdbc.queryForList(
            "SELECT id FROM plugin_registry WHERE id=? AND owner_id=? AND runtime='BLUEPRINT'",
            Long.class,
            blueprint,
            owner)
        .isEmpty())
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "WORKFLOW_NOT_AVAILABLE");
    var policies =
        jdbc.queryForList(
            "SELECT * FROM workflow_ops_policies WHERE blueprint_id=? AND owner_id=?",
            blueprint,
            owner);
    return policies.isEmpty()
        ? Map.of(
            "retention_days",
            90,
            "payload_hours",
            2160,
            "failure_threshold",
            3,
            "window_minutes",
            15,
            "route",
            "NONE")
        : policies.get(0);
  }

  public int evaluateAlerts() {
    return tx.execute(
        status -> {
          int created = 0;
          var policies =
              jdbc.queryForList(
                  "SELECT p.*,floor(EXTRACT(EPOCH FROM"
                      + " CURRENT_TIMESTAMP)/(p.window_minutes*60))::bigint AS bucket,count(r.id)"
                      + " AS failures FROM workflow_ops_policies p JOIN workflow_runs r ON"
                      + " r.blueprint_id=p.blueprint_id AND r.owner_id=p.owner_id WHERE"
                      + " p.route<>'NONE' AND NOT EXISTS (SELECT 1 FROM workflow_alerts a WHERE"
                      + " a.blueprint_id=p.blueprint_id AND a.bucket=floor(EXTRACT(EPOCH FROM"
                      + " CURRENT_TIMESTAMP)/(p.window_minutes*60))::bigint) AND r.state IN"
                      + " ('FAILED','DEAD_LETTER') AND"
                      + " r.finished_at>CURRENT_TIMESTAMP-(p.window_minutes*INTERVAL '1 minute')"
                      + " GROUP BY p.blueprint_id HAVING count(r.id)>=p.failure_threshold LIMIT"
                      + " 1000");
          for (var policy : policies) {
            UUID id = UUID.randomUUID();
            String message =
                "Workflow "
                    + policy.get("blueprint_id")
                    + ": "
                    + policy.get("failures")
                    + " failed runs in "
                    + policy.get("window_minutes")
                    + " minutes.";
            int inserted =
                jdbc.update(
                    "INSERT INTO"
                        + " workflow_alerts(id,owner_id,blueprint_id,bucket,failure_count,route,message)"
                        + " VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
                    id,
                    policy.get("owner_id"),
                    policy.get("blueprint_id"),
                    policy.get("bucket"),
                    policy.get("failures"),
                    policy.get("route"),
                    message);
            if (inserted == 1 && "INBOX".equals(policy.get("route")))
              jdbc.update(
                  "INSERT INTO"
                      + " notifications(user_id,type,message,is_read,created_at,workflow_alert_id)"
                      + " VALUES (?,'WORKFLOW',?,false,CURRENT_TIMESTAMP,?)",
                  policy.get("owner_id").toString(),
                  message,
                  id);
            created += inserted;
          }
          return created;
        });
  }

  public Map<String, Integer> prune() {
    return tx.execute(
        status -> {
          // Active/waiting checkpoints are never removed by payload retention.
          int payloads =
              jdbc.update(
                  "DELETE FROM workflow_checkpoints c USING workflow_runs r WHERE c.run_id=r.id AND"
                      + " r.state IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER') AND"
                      + " r.finished_at<CURRENT_TIMESTAMP-(COALESCE((SELECT payload_hours FROM"
                      + " workflow_ops_policies p WHERE p.blueprint_id=r.blueprint_id AND"
                      + " p.owner_id=r.owner_id),2160)*INTERVAL '1 hour')");
          jdbc.update(
              "UPDATE workflow_steps s SET"
                  + " input_metadata=s.input_metadata-'references',output_metadata=s.output_metadata-'references'"
                  + " FROM workflow_runs r WHERE s.run_id=r.id AND r.state IN"
                  + " ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER') AND"
                  + " r.finished_at<CURRENT_TIMESTAMP-(COALESCE((SELECT payload_hours FROM"
                  + " workflow_ops_policies p WHERE p.blueprint_id=r.blueprint_id AND"
                  + " p.owner_id=r.owner_id),2160)*INTERVAL '1 hour') AND (s.input_metadata ?"
                  + " 'references' OR s.output_metadata ? 'references')");
          // Preserve the immutable parent UUID even when the parent row expires.
          jdbc.update(
              "UPDATE workflow_runs r SET"
                  + " retain_until=COALESCE(finished_at,created_at)+(COALESCE((SELECT"
                  + " retention_days FROM workflow_ops_policies p WHERE"
                  + " p.blueprint_id=r.blueprint_id AND p.owner_id=r.owner_id),90)*INTERVAL '1"
                  + " day') WHERE state IN ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')");
          int runs =
              jdbc.update(
                  "DELETE FROM workflow_runs WHERE retain_until<CURRENT_TIMESTAMP AND state IN"
                      + " ('SUCCEEDED','FAILED','CANCELLED','DEAD_LETTER')");
          jdbc.update(
              "DELETE FROM workflow_alerts WHERE created_at<CURRENT_TIMESTAMP-INTERVAL '90 days'");
          return Map.of("payloads", payloads, "runs", runs);
        });
  }
}
