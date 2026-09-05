package com.modulo.blueprint.execution;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import java.sql.*;
import java.time.*;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** One database-elected dispatcher; durable fire records survive loss of its process. */
@Component
@Profile("!test")
public class WorkflowScheduler {
  private static final long LEADER_LOCK = 428042804280L;
  private final JdbcTemplate jdbc;
  private final DataSource source;
  private final TransactionTemplate tx;
  private final ObjectMapper json;
  private final ObjectProvider<BlueprintInterpreterService> interpreter;

  public WorkflowScheduler(
      JdbcTemplate jdbc,
      DataSource source,
      PlatformTransactionManager manager,
      ObjectMapper json,
      ObjectProvider<BlueprintInterpreterService> interpreter) {
    this.jdbc = jdbc;
    this.source = source;
    this.tx = new TransactionTemplate(manager);
    this.json = json;
    this.interpreter = interpreter;
  }

  @Scheduled(fixedDelayString = "${modulo.workflow.scheduler.poll-ms:1000}")
  public void poll() {
    try {
      tick(Instant.now());
    } catch (Exception unavailable) {
      org.slf4j.LoggerFactory.getLogger(getClass()).warn("Workflow scheduler poll failed");
    }
  }

  @SuppressWarnings("unchecked")
  public BlueprintEntry entry(long id) {
    var rows =
        jdbc.queryForList(
            "SELECT id,owner_id,blueprint_name,version,config::text FROM plugin_registry WHERE id=?"
                + " AND runtime='BLUEPRINT' AND status='ACTIVE' AND owner_id IS NOT NULL",
            id);
    if (rows.isEmpty()) throw new IllegalArgumentException("SCHEDULE_REMOVED");
    var row = rows.get(0);
    var entry = new BlueprintEntry();
    entry.setId(id);
    entry.setOwnerId(((Number) row.get("owner_id")).longValue());
    entry.setName((String) row.get("blueprint_name"));
    entry.setVersion((String) row.get("version"));
    try {
      entry.setIr(json.readValue((String) row.get("config"), Map.class));
    } catch (Exception invalid) {
      throw new IllegalArgumentException("SCHEDULE_INVALID");
    }
    return entry;
  }

  public void sync(BlueprintEntry supplied, BlueprintIRGraph ignored) {
    syncAt(supplied.getId(), Instant.now());
  }

  public void syncAt(long blueprint, Instant now) {
    tx.executeWithoutResult(
        status -> {
          // Lock and reread the source so stale application instances cannot revert schedule
          // changes.
          jdbc.queryForList(
              "SELECT id FROM plugin_registry WHERE id=? FOR UPDATE", Long.class, blueprint);
          BlueprintEntry entry;
          try {
            entry = entry(blueprint);
          } catch (IllegalArgumentException missing) {
            jdbc.update(
                "UPDATE workflow_schedules SET enabled=false WHERE blueprint_id=?", blueprint);
            return;
          }
          var graph = json.convertValue(entry.getIr(), BlueprintIRGraph.class);
          jdbc.update(
              "UPDATE workflow_schedules SET enabled=false WHERE blueprint_id=?", blueprint);
          for (var node : graph.getNodes())
            if ("trigger.schedule".equals(node.getType())) {
              try {
                var config = node.getConfig() == null ? Map.<String, Object>of() : node.getConfig();
                String cron = (String) config.get("cron");
                String zone = (String) config.getOrDefault("zone", "UTC");
                if (cron == null || cron.length() > 128 || zone.length() > 64) continue;
                var next = CronExpression.parse(cron).next(now.atZone(ZoneId.of(zone)));
                if (next == null) continue;
                int attempts = bounded(config.getOrDefault("retryMaxAttempts", 1), 1, 5);
                int backoff = bounded(config.getOrDefault("retryBackoffSeconds", 30), 5, 3600);
                jdbc.update(
                    "INSERT INTO"
                        + " workflow_schedules(blueprint_id,owner_id,node_id,cron,zone,next_fire,max_attempts,backoff_seconds)"
                        + " VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(blueprint_id,node_id) DO UPDATE"
                        + " SET owner_id=EXCLUDED.owner_id,enabled=true,next_fire=CASE WHEN"
                        + " workflow_schedules.cron=EXCLUDED.cron AND"
                        + " workflow_schedules.zone=EXCLUDED.zone THEN workflow_schedules.next_fire"
                        + " ELSE EXCLUDED.next_fire"
                        + " END,cron=EXCLUDED.cron,zone=EXCLUDED.zone,max_attempts=EXCLUDED.max_attempts,backoff_seconds=EXCLUDED.backoff_seconds",
                    blueprint,
                    entry.getOwnerId(),
                    node.getId(),
                    cron,
                    zone,
                    Timestamp.from(next.toInstant()),
                    attempts,
                    backoff);
              } catch (RuntimeException invalid) {
                /* Invalid definitions remain disabled and never fire. */
              }
            }
        });
  }

  public void enqueueDue(Instant now) {
    tx.executeWithoutResult(
        status -> {
          var due =
              jdbc.queryForList(
                  "SELECT s.* FROM workflow_schedules s JOIN plugin_registry p ON"
                      + " p.id=s.blueprint_id WHERE s.enabled AND p.status='ACTIVE' AND"
                      + " p.runtime='BLUEPRINT' AND p.owner_id=s.owner_id AND s.next_fire<=? ORDER"
                      + " BY s.next_fire LIMIT 100 FOR UPDATE OF s SKIP LOCKED",
                  Timestamp.from(now));
          for (var schedule : due) {
            if (jdbc.queryForObject(
                    "SELECT count(*) FROM workflow_schedule_jobs WHERE owner_id=?",
                    Long.class,
                    schedule.get("owner_id"))
                >= 10000) {
              jdbc.update(
                  "UPDATE workflow_schedules SET enabled=false WHERE blueprint_id=? AND node_id=?",
                  schedule.get("blueprint_id"),
                  schedule.get("node_id"));
              continue;
            }
            jdbc.update(
                "INSERT INTO"
                    + " workflow_schedule_jobs(id,blueprint_id,owner_id,node_id,due_at,next_attempt,max_attempts,backoff_seconds)"
                    + " VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
                UUID.randomUUID(),
                schedule.get("blueprint_id"),
                schedule.get("owner_id"),
                schedule.get("node_id"),
                schedule.get("next_fire"),
                Timestamp.from(now),
                schedule.get("max_attempts"),
                schedule.get("backoff_seconds"));
            // Misfires coalesce to one retained delivery; compute the next future fire in its
            // explicit zone.
            var next =
                CronExpression.parse((String) schedule.get("cron"))
                    .next(now.atZone(ZoneId.of((String) schedule.get("zone"))));
            jdbc.update(
                "UPDATE workflow_schedules SET next_fire=?,enabled=? WHERE blueprint_id=? AND"
                    + " node_id=?",
                next == null ? schedule.get("next_fire") : Timestamp.from(next.toInstant()),
                next != null,
                schedule.get("blueprint_id"),
                schedule.get("node_id"));
          }
        });
  }

  public void tick(Instant now) throws SQLException {
    try (var connection = source.getConnection()) {
      boolean leader;
      try (var statement = connection.createStatement();
          var result = statement.executeQuery("SELECT pg_try_advisory_lock(" + LEADER_LOCK + ")")) {
        result.next();
        leader = result.getBoolean(1);
      }
      if (!leader) return;
      try (var scope = new WorkflowWorkerContext()) {
        // No other elected dispatcher can be executing these runs. Never silently replay uncertain
        // work.
        jdbc.update(
            "UPDATE workflow_runs SET"
                + " state='DEAD_LETTER',error_class='WORKER_LOST',finished_at=CURRENT_TIMESTAMP"
                + " WHERE execution_worker='scheduler' AND state IN ('QUEUED','RUNNING')");
        enqueueDue(now);
        var jobs =
            jdbc.queryForList(
                "SELECT * FROM workflow_schedule_jobs WHERE state='RUNNING' OR (state='PENDING' AND"
                    + " next_attempt<=?) ORDER BY next_attempt LIMIT 10",
                Timestamp.from(now));
        for (var job : jobs) dispatch(job, now);
        var waiting =
            jdbc.queryForList(
                "SELECT id,owner_id,resume_checkpoint FROM workflow_runs WHERE state='WAITING' AND"
                    + " resume_at<=? AND resume_checkpoint IS NOT NULL ORDER BY resume_at LIMIT 10",
                Timestamp.from(now));
        for (var run : waiting)
          interpreter
              .getObject()
              .resumeWaiting(
                  (UUID) run.get("id"),
                  ((Number) run.get("owner_id")).longValue(),
                  ((Number) run.get("resume_checkpoint")).intValue());
        jdbc.update(
            "DELETE FROM workflow_schedule_jobs WHERE state IN ('DELIVERED','DEAD_LETTER') AND"
                + " created_at<CURRENT_TIMESTAMP-INTERVAL '90 days'");
      } finally {
        try (var statement = connection.createStatement()) {
          statement.execute("SELECT pg_advisory_unlock(" + LEADER_LOCK + ")");
        } catch (SQLException lost) {
          connection.abort(Runnable::run);
          throw lost;
        }
      }
    }
  }

  private void dispatch(Map<String, Object> job, Instant now) {
    long started = System.nanoTime();
    UUID id = (UUID) job.get("id");
    long owner = ((Number) job.get("owner_id")).longValue();
    int attempt = ((Number) job.get("attempt")).intValue() + 1;
    jdbc.update(
        "UPDATE workflow_schedule_jobs SET state='RUNNING',attempt=? WHERE id=?", attempt, id);
    UUID run = (UUID) job.get("run_id");
    try {
      if (run == null) {
        var existing =
            jdbc.queryForList(
                "SELECT id FROM workflow_runs WHERE owner_id=? AND trigger_key=?",
                UUID.class,
                owner,
                "schedule:" + id);
        run =
            existing.isEmpty()
                ? interpreter
                    .getObject()
                    .fireScheduled(
                        entry(((Number) job.get("blueprint_id")).longValue()),
                        (String) job.get("node_id"),
                        "schedule:" + id,
                        ((Timestamp) job.get("due_at")).toInstant().toString())
                : existing.get(0);
      } else {
        var row =
            jdbc.queryForMap(
                "SELECT state FROM workflow_runs WHERE id=? AND owner_id=?", run, owner);
        if ("FAILED".equals(row.get("state")))
          run =
              interpreter
                  .getObject()
                  .retryRun(
                      run,
                      owner,
                      UUID.nameUUIDFromBytes(
                          (id + ":" + attempt).getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                      0,
                      false);
      }
      jdbc.update("UPDATE workflow_schedule_jobs SET run_id=? WHERE id=?", run, id);
      jdbc.update(
          "UPDATE workflow_runs SET max_auto_attempts=?,retry_backoff_seconds=? WHERE id=?",
          job.get("max_attempts"),
          job.get("backoff_seconds"),
          run);
      var result =
          jdbc.queryForMap(
              "SELECT state,error_class FROM workflow_runs WHERE id=? AND owner_id=?", run, owner);
      if (Set.of("SUCCEEDED", "CANCELLED", "WAITING").contains(result.get("state"))) {
        jdbc.update("UPDATE workflow_schedule_jobs SET state='DELIVERED' WHERE id=?", id);
        return;
      }
      boolean safe =
          "FAILED".equals(result.get("state"))
              && !"LOOP_GUARD".equals(result.get("error_class"))
              && jdbc.queryForObject(
                      "SELECT count(*) FROM workflow_steps WHERE run_id=? AND node_type NOT LIKE"
                          + " 'logic.%' AND node_type NOT LIKE 'trigger.%' AND state NOT IN"
                          + " ('SKIPPED','CANCELLED')",
                      Long.class, run)
                  == 0;
      if (safe && attempt < ((Number) job.get("max_attempts")).intValue()) {
        long backoff =
            Math.min(
                3600,
                ((Number) job.get("backoff_seconds")).longValue()
                    * (1L << Math.min(attempt - 1, 4)));
        jdbc.update(
            "UPDATE workflow_schedule_jobs SET"
                + " state='PENDING',next_attempt=?,error_class='RETRY_PENDING' WHERE id=?",
            Timestamp.from(
                now.plusSeconds(
                    backoff
                        + java.util.concurrent.TimeUnit.NANOSECONDS.toSeconds(
                            System.nanoTime() - started))),
            id);
        return;
      }
      jdbc.update(
          "UPDATE workflow_runs SET state='DEAD_LETTER',finished_at=CURRENT_TIMESTAMP WHERE id=?"
              + " AND state='FAILED'",
          run);
      jdbc.update(
          "UPDATE workflow_schedule_jobs SET state='DEAD_LETTER',error_class='RETRY_EXHAUSTED'"
              + " WHERE id=?",
          id);
    } catch (Exception invalid) {
      jdbc.update(
          "UPDATE workflow_schedule_jobs SET state='DEAD_LETTER',error_class='NON_RETRYABLE' WHERE"
              + " id=?",
          id);
      if (run != null)
        jdbc.update(
            "UPDATE workflow_runs SET"
                + " state='DEAD_LETTER',error_class='NON_RETRYABLE',finished_at=CURRENT_TIMESTAMP"
                + " WHERE id=? AND state IN ('FAILED','QUEUED')",
            run);
    }
  }

  private static int bounded(Object value, int min, int max) {
    if (!(value instanceof Number number)
        || number.doubleValue() != number.intValue()
        || number.intValue() < min
        || number.intValue() > max) throw new IllegalArgumentException("INVALID_RETRY_POLICY");
    return number.intValue();
  }
}
