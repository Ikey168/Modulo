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

  @Test
  void constrainsLegacyMigrationRecordAndReportKeys() throws Exception {
    assertNotNull(OperationalSchemas.definition("information-intake", "modulo.intake.legacy-record"));
    assertNotNull(OperationalSchemas.definition("information-intake", "modulo.intake.import-report"));
    assertNull(OperationalSchemas.definition("other-plugin", "modulo.intake.legacy-record"));
    var record = json.readTree("{\"collection\":\"items\",\"legacyId\":\"intake-1\","
        + "\"payload\":{\"id\":\"intake-1\"},\"sourceDigest\":\"" + "a".repeat(64)
        + "\",\"importedAt\":\"2026-09-13T00:00:00Z\"}");
    assertDoesNotThrow(() -> OperationalSchemas.validate("modulo.intake.legacy-record",
        "legacy.items." + "b".repeat(32), record));
    var schemas = new StateSchemaRegistry(null, json);
    assertDoesNotThrow(() -> schemas.validate(1, "information-intake",
        "modulo.intake.legacy-record", 1, record));
    assertThrows(ResponseStatusException.class, () -> OperationalSchemas.validate(
        "modulo.intake.legacy-record", "legacy.projects." + "b".repeat(32), record));
    var report = json.readTree("{\"sourceKey\":\"modulo-information-intake-v1\","
        + "\"sourceDigest\":\"" + "c".repeat(64) + "\",\"recordKeys\":[\"legacy.items."
        + "b".repeat(32) + "\"],\"counts\":{\"items\":1},\"importedAt\":\"2026-09-13T00:00:00Z\"}");
    assertDoesNotThrow(() -> OperationalSchemas.validate("modulo.intake.import-report",
        "migration." + "c".repeat(32), report));
    assertDoesNotThrow(() -> schemas.validate(1, "information-intake",
        "modulo.intake.import-report", 1, report));
    assertThrows(ResponseStatusException.class, () -> OperationalSchemas.validate(
        "modulo.intake.import-report", "migration." + "d".repeat(32), report));
  }
}
