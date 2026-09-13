package com.modulo.state;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class IntakePluginStateSchemaTest {
  private final ObjectMapper json = new ObjectMapper();

  @Test
  void bindsIntakeSchemasToPluginNamespaceAndStableItemKey() throws Exception {
    assertNotNull(OperationalSchemas.definition("information-intake", "modulo.intake.preferences"));
    assertNotNull(OperationalSchemas.definition("information-intake", "modulo.intake.item-link"));
    assertNull(OperationalSchemas.definition("other-plugin", "modulo.intake.item-link"));
    String id = "feed:" + "a".repeat(32);
    var value = json.readTree("{\"id\":\"item." + "a".repeat(32)
        + "\",\"noesisItemId\":\"" + id + "\",\"sourceVersion\":2,\"objectVersion\":1,\"createdAt\":\"2026-09-13T00:00:00Z\"}");
    assertDoesNotThrow(() -> OperationalSchemas.validate("modulo.intake.item-link",
        "item." + "a".repeat(32), value));
    assertThrows(ResponseStatusException.class, () -> OperationalSchemas.validate(
        "modulo.intake.item-link", "item." + "b".repeat(32), value));
  }
}
