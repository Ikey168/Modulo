package com.modulo.state;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Committed metadata only, delivered to private owner queues; the authorized change feed provides
 * recovery.
 */
@Component
@org.springframework.context.annotation.Profile("!test")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "modulo.state.delivery.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class PluginStateOutbox {
  private final JdbcTemplate jdbc;
  private final TransactionTemplate transactions;
  private final SimpMessagingTemplate messaging;

  public PluginStateOutbox(
      JdbcTemplate jdbc, PlatformTransactionManager manager, SimpMessagingTemplate messaging) {
    this.jdbc = jdbc;
    this.transactions = new TransactionTemplate(manager);
    this.messaging = messaging;
  }

  public record StateEvent(
      long eventId,
      long ownerId,
      String workspace,
      String namespace,
      String key,
      String operation,
      long version,
      String schemaId,
      int schemaVersion,
      String plugin,
      String requestId) {}

  @Scheduled(fixedDelayString = "${modulo.state.delivery-delay-ms:1000}")
  public void deliver() {
    transactions.executeWithoutResult(
        status -> {
          var events =
              jdbc.query(
                  "SELECT * FROM plugin_state_events WHERE delivered_at IS NULL AND"
                      + " next_attempt_at<=CURRENT_TIMESTAMP ORDER BY id LIMIT 100 FOR UPDATE SKIP"
                      + " LOCKED",
                  (rs, row) ->
                      new StateEvent(
                          rs.getLong("id"),
                          rs.getLong("owner_id"),
                          rs.getString("workspace_id"),
                          rs.getString("namespace"),
                          rs.getString("state_key"),
                          rs.getString("operation"),
                          rs.getLong("version"),
                          rs.getString("schema_id"),
                          rs.getInt("schema_version"),
                          rs.getString("actor_plugin"),
                          rs.getString("request_id")));
          for (var event : events) {
            try {
              messaging.convertAndSendToUser(Long.toString(event.ownerId()), "/queue/state", event);
              jdbc.update(
                  "UPDATE plugin_state_events SET delivered_at=CURRENT_TIMESTAMP WHERE id=?",
                  event.eventId());
            } catch (RuntimeException unavailable) {
              // Values and credentials never enter retry logs or delivery records.
              jdbc.update(
                  "UPDATE plugin_state_events SET"
                      + " delivery_attempts=delivery_attempts+1,next_attempt_at=CURRENT_TIMESTAMP +"
                      + " LEAST(300, power(2,LEAST(8,delivery_attempts))) * interval '1 second'"
                      + " WHERE id=?",
                  event.eventId());
            }
          }
        });
  }
}
