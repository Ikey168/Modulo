package com.modulo.integrations.praxis;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Which Praxis processes each Modulo user submitted; see V28__Praxis_submissions.sql. */
@Repository
public class PraxisSubmissions {
  static final int LIST_LIMIT = 200;
  private final JdbcTemplate jdbc;

  public PraxisSubmissions(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  /** Idempotent: a duplicate submission (same key, same process) records nothing new. */
  public void record(long ownerId, String processId, String idempotencyKey, String objective, String executor,
      boolean publishRequested) {
    jdbc.update("INSERT INTO praxis_submissions(owner_id, process_id, idempotency_key, objective, executor, publish_requested) "
        + "VALUES (?,?,?,?,?,?) ON CONFLICT (owner_id, process_id) DO NOTHING",
        ownerId, processId, idempotencyKey, objective, executor, publishRequested);
  }

  public List<Map<String, Object>> list(long ownerId) {
    return jdbc.query("SELECT process_id, objective, executor, publish_requested, created_at FROM praxis_submissions "
        + "WHERE owner_id=? ORDER BY created_at DESC, process_id LIMIT " + LIST_LIMIT, (row, index) -> {
          Map<String, Object> item = new LinkedHashMap<>();
          item.put("processId", row.getString("process_id"));
          item.put("objective", row.getString("objective"));
          item.put("executor", row.getString("executor"));
          item.put("publishRequested", row.getBoolean("publish_requested"));
          Timestamp created = row.getTimestamp("created_at");
          item.put("createdAt", created == null ? null : created.toInstant().toString());
          return item;
        }, ownerId);
  }
}
