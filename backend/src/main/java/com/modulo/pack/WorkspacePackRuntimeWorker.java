package com.modulo.pack;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintEntry;
import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import java.util.Map;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Profile("!test")
public class WorkspacePackRuntimeWorker {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final BlueprintInterpreterService interpreter;
  private final TransactionTemplate tx;

  public WorkspacePackRuntimeWorker(
      JdbcTemplate jdbc,
      ObjectMapper json,
      BlueprintInterpreterService interpreter,
      PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json;
    this.interpreter = interpreter;
    tx = new TransactionTemplate(manager);
  }

  private long cursor;
  private final java.util.Map<Long, java.sql.Timestamp> seen = new java.util.HashMap<>();

  @Scheduled(fixedDelay = 2000)
  public void refresh() {
    var processed = new java.util.HashMap<Long, java.sql.Timestamp>();
    tx.executeWithoutResult(
        status -> {
          var jobs =
              jdbc.queryForList(
                  "SELECT registry_id,requested_at FROM workspace_pack_runtime_refresh WHERE"
                      + " registry_id>? AND attempts<10 ORDER BY registry_id LIMIT 20 FOR UPDATE"
                      + " SKIP LOCKED",
                  cursor);
          if (jobs.isEmpty()) cursor = 0;
          for (var job : jobs) {
            long id = ((Number) job.get("registry_id")).longValue();
            cursor = id;
            var requested = (java.sql.Timestamp) job.get("requested_at");
            if (requested.equals(seen.get(id))) continue;
            try {
              interpreter.unregisterBlueprint(Long.toString(id));
              var rows =
                  jdbc.queryForList(
                      "SELECT * FROM plugin_registry WHERE id=? AND runtime='BLUEPRINT' AND"
                          + " status='ACTIVE'",
                      id);
              if (!rows.isEmpty()) {
                var row = rows.get(0);
                var entry = new BlueprintEntry();
                entry.setId(id);
                entry.setOwnerId(((Number) row.get("owner_id")).longValue());
                entry.setName(row.get("blueprint_name").toString());
                entry.setVersion(row.get("version").toString());
                entry.setUpdatedAt(row.get("updated_at").toString());
                @SuppressWarnings("unchecked")
                Map<String, Object> ir = json.readValue(row.get("config").toString(), Map.class);
                entry.setIr(ir);
                interpreter.registerBlueprint(entry);
              }
              jdbc.update(
                  "UPDATE workspace_pack_runtime_refresh SET"
                      + " completed_at=clock_timestamp(),last_error=NULL WHERE registry_id=?",
                  id);
              processed.put(id, requested);
            } catch (Exception failure) {
              jdbc.update(
                  "UPDATE workspace_pack_runtime_refresh SET"
                      + " attempts=attempts+1,last_error='RUNTIME_REFRESH_FAILED' WHERE"
                      + " registry_id=?",
                  id);
            }
          }
        });
    seen.putAll(processed);
  }
}
