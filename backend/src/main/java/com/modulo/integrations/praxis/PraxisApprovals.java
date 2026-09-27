package com.modulo.integrations.praxis;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * The signed-in user's pending Praxis approvals, for the unified Approvals inbox (#553).
 *
 * <p>Praxis has no cross-process approval listing, so this asks Praxis for the pending
 * approvals of each process the user submitted through Modulo ({@link PraxisSubmissions}).
 * Every call carries the delegated identity from {@link PraxisIdentity}, so Praxis
 * applies its own ownership check as well. Processes the user did not submit through
 * Modulo are never asked about.
 */
@Service
public class PraxisApprovals {
  private static final Logger log = LoggerFactory.getLogger(PraxisApprovals.class);
  static final String SOURCE = "praxis";

  private final ObjectProvider<PraxisClient> clients;
  private final PraxisIdentity identity;
  private final PraxisSubmissions submissions;

  public PraxisApprovals(ObjectProvider<PraxisClient> clients, PraxisIdentity identity, PraxisSubmissions submissions) {
    this.clients = clients;
    this.identity = identity;
    this.submissions = submissions;
  }

  /**
   * {@code configured} is false and the list empty when Praxis is not set up.
   * {@code complete} is false when Praxis could not answer for some processes; the
   * approvals it did return are still listed.
   */
  public Map<String, Object> pending() {
    Map<String, Object> result = new LinkedHashMap<>();
    List<Map<String, Object>> approvals = new ArrayList<>();
    PraxisClient client = clients.getIfAvailable();
    result.put("configured", client != null);
    result.put("approvals", approvals);
    if (client == null) {
      result.put("complete", true);
      return result;
    }
    PraxisIdentity.Principal user = identity.current();
    boolean complete = true;
    for (Map<String, Object> submission : submissions.list(user.ownerId())) {
      String processId = String.valueOf(submission.get("processId"));
      JsonNode pending;
      try {
        pending = client.approvals(processId, user.onBehalfOf());
      } catch (PraxisException error) {
        // The process is gone or no longer this user's: nothing to decide there.
        if (error.status() == 403 || error.status() == 404) continue;
        complete = false;
        log.warn("Praxis approvals for {} unavailable: {}", processId, error.code());
        // Unreachable Praxis would fail the same way for every process; stop asking.
        if (error.status() == 0 || error.status() == 401) break;
        continue;
      }
      for (JsonNode approval : pending.path("approvals")) {
        if (approval.isObject()) approvals.add(normalize(processId, submission, approval));
      }
    }
    result.put("complete", complete);
    return result;
  }

  /** The fields the inbox shows and needs to decide; Praxis' names become camelCase. */
  static Map<String, Object> normalize(String processId, Map<String, Object> submission, JsonNode approval) {
    Map<String, Object> item = new LinkedHashMap<>();
    String kind = approval.path("kind").asText("");
    String target = approval.path("target").asText("");
    item.put("source", SOURCE);
    item.put("processId", processId);
    item.put("effectProcessId", approval.path("process_id").asText(processId));
    item.put("effectId", approval.path("effect_id").asText(""));
    item.put("version", approval.path("version").asLong());
    item.put("attemptId", approval.path("attempt_id").asText(""));
    item.put("kind", kind);
    item.put("target", target);
    item.put("reversible", approval.path("reversible").asBoolean(false));
    item.put("title", (kind.isEmpty() ? "Effect" : kind.replace('_', ' ')) + (target.isEmpty() ? "" : " → " + target));
    item.put("summary", submission.get("objective"));
    item.put("requestedAt", requestedAt(approval));
    item.put("submittedAt", submission.get("createdAt"));
    return item;
  }

  /** When Praxis proposed the effect, if it says; null otherwise ({@code submittedAt} is the task's time). */
  private static String requestedAt(JsonNode approval) {
    for (String field : new String[] {"requested_at", "created_at"}) {
      if (approval.path(field).isTextual()) return approval.path(field).asText();
    }
    return null;
  }
}
