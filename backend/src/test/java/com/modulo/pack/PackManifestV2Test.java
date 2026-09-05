package com.modulo.pack;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class PackManifestV2Test {
  private final ObjectMapper json = new ObjectMapper();

  private PackManifest sample(String name) throws Exception {
    return json.readValue(
        Files.readString(Path.of("../shared/packs/" + name + ".v2.json")), PackManifest.class);
  }

  @Test
  void examplesValidateAndDependenciesPrecedeConsumers() throws Exception {
    for (String name : List.of("knowledge-base", "security-audit")) {
      var manifest = sample(name);
      var result = PackManifestValidator.validate(manifest);
      assertTrue(result.ok(), result.reason());
      assertEquals(manifest.getResources().size(), result.order().size());
      assertTrue(
          result.order().indexOf("record-schema") < result.order().indexOf("record-template"));
    }
  }

  @Test
  void invalidReferencesCapabilitiesCyclesAndVersionsFail() throws Exception {
    var manifest = sample("knowledge-base");
    manifest.getResources().get(1).put("requires", List.of("missing"));
    assertFalse(PackManifestValidator.validate(manifest).ok());
    manifest = sample("knowledge-base");
    manifest.setCapabilities(List.of());
    assertEquals("UNDECLARED_CAPABILITY", PackManifestValidator.validate(manifest).reason());
    manifest = sample("knowledge-base");
    manifest.getResources().get(0).put("requires", List.of("record-template"));
    assertFalse(PackManifestValidator.validate(manifest).ok());
    manifest = sample("knowledge-base");
    manifest.setManifestVersion(99);
    assertFalse(PackManifestValidator.validate(manifest).ok());
    manifest = sample("knowledge-base");
    manifest.setMinCatalogVersion("2.0.0");
    assertFalse(PackManifestValidator.validate(manifest).ok());
    manifest = sample("knowledge-base");
    manifest.unknown("silentExtension", true);
    assertFalse(PackManifestValidator.validate(manifest).ok());
  }

  @Test
  void rejectsUnknownPropertiesAndUnsafeLifecyclePolicy() throws Exception {
    var manifest = sample("knowledge-base");
    manifest.getResources().get(0).put("ownerId", 999);
    assertFalse(PackManifestValidator.validate(manifest).ok());
    manifest = sample("knowledge-base");
    manifest.setPolicies(
        Map.of(
            "upgrade",
            "overwrite-user-content",
            "removal",
            "preserve-user-content",
            "demoData",
            "opt-in"));
    assertFalse(PackManifestValidator.validate(manifest).ok());
  }

  @Test
  void deserializationCannotDiscardUnknownOrMalformedV2Fields() throws Exception {
    var manifest = sample("knowledge-base");
    manifest.getContributes().unknown("plugins", List.of("ignored"));
    assertFalse(PackManifestValidator.validate(manifest).ok());
    var raw =
        (com.fasterxml.jackson.databind.node.ObjectNode)
            json.readTree(Files.readString(Path.of("../shared/packs/knowledge-base.v2.json")));
    raw.putNull("dependencies");
    assertFalse(PackManifestValidator.validate(json.treeToValue(raw, PackManifest.class)).ok());
  }

  @Test
  void v1RemainsValidAndVersionOverflowIsRejected() {
    var manifest = new PackManifest();
    manifest.setId("test.pack");
    manifest.setName("Legacy");
    manifest.setVersion("1.0.0");
    assertTrue(PackManifestValidator.validate(manifest).ok());
    assertNull(SemVer.parse("999999999999999999.0.0"));
  }
}
