package com.modulo.integrations.noesis;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.security.AuthenticatedUserService;
import java.util.Map;
import org.junit.jupiter.api.Test;

class NoesisIntakeControllerTest {
  private final ObjectMapper json = new ObjectMapper();
  private final AuthenticatedUserService users = mock(AuthenticatedUserService.class);
  private final NoesisIntakeBridge bridge = mock(NoesisIntakeBridge.class);
  private final NoesisIntakeController controller = new NoesisIntakeController(users, bridge, json);

  @Test
  void preflightRequiresScopedReadinessAndKeepsPartialModesVisible() throws Exception {
    when(bridge.configured()).thenReturn(true);
    when(users.requireUserId()).thenReturn(7L);
    JsonNode readiness = json.readTree("{\"contract\":\"noesis-intake-readiness-v1\","
        + "\"source_mode\":\"unknown_live_or_fixture\","
        + "\"enabled_feed_subscription_count\":0,"
        + "\"modes\":[{\"mode\":\"Maintenance\",\"native_start_possible\":true,"
        + "\"complete_journey_ready\":false,\"blockers\":[\"Impact pending\"]}]}");
    JsonNode discovery = json.readTree("{\"contract\":\"noesis-intake-modes-v1\"}");
    when(bridge.call(eq(7L), eq("preflight_intake_mode"), any(JsonNode.class)))
        .thenReturn(readiness);
    when(bridge.call(eq(7L), eq("discover_intake_modes"), any(JsonNode.class)))
        .thenReturn(discovery);

    var result = controller.preflight("research");
    @SuppressWarnings("unchecked")
    var body = (Map<String, Object>) result.getBody();
    assertTrue((Boolean) body.get("available"));
    assertEquals(readiness, body.get("readiness"));
    verify(bridge).call(eq(7L), eq("preflight_intake_mode"),
        eq(json.createObjectNode().put("namespace", "research")));
  }

  @Test
  void preflightDoesNotCallPublicDiscoveryAfterDeniedNamespace() throws Exception {
    when(bridge.configured()).thenReturn(true);
    when(users.requireUserId()).thenReturn(7L);
    when(bridge.call(eq(7L), eq("preflight_intake_mode"), any(JsonNode.class)))
        .thenReturn(json.readTree("{\"ok\":false,\"error\":{\"code\":\"unauthorized\"}}"));

    var result = controller.preflight("private");
    @SuppressWarnings("unchecked")
    var body = (Map<String, Object>) result.getBody();
    assertEquals(false, body.get("available"));
    assertEquals("unauthorized", body.get("reason"));
  }
}
