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
    var preferences = json.readTree("{\"namespace\":\"research\",\"pendingExploreKey\":\"explore-1\","
        + "\"pendingCaptureKey\":\"capture-1\"}");
    assertDoesNotThrow(() -> new StateSchemaRegistry(null, json).validate(1,
        "information-intake", "modulo.intake.preferences", 1, preferences));
    assertNotNull(OperationalSchemas.definition("information-intake", "modulo.intake.research-start"));
    var researchStart = json.readTree("""
        {"namespace":"research","request":{"namespace":"research","request_key":"research-1",
        "questions":["Why?"],"success_criteria":["Explain uncertainty"],
        "scope":{"namespaces":["research"],"domains":[]},
        "budget":{"requests":5,"tokens":10000,"usd_micros":0},
        "origin":{"session_id":"intake:one","reason":"Saved source"},
        "references":[{"kind":"exploration_source","id":"explore:one","namespace":"research","version":1}]}}
        """);
    assertDoesNotThrow(() -> new StateSchemaRegistry(null, json).validate(1,
        "information-intake", "modulo.intake.research-start", 1, researchStart));
    ((com.fasterxml.jackson.databind.node.ObjectNode) researchStart.path("request")).remove("questions");
    assertThrows(ResponseStatusException.class, () -> new StateSchemaRegistry(null, json).validate(1,
        "information-intake", "modulo.intake.research-start", 1, researchStart));
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
