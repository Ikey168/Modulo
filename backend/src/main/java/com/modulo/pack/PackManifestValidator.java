package com.modulo.pack;

import com.fasterxml.jackson.databind.*;
import com.modulo.blueprint.BlueprintCapabilityService;
import java.util.*;

public final class PackManifestValidator {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final JsonNode SCHEMA;

  static {
    try (var input =
        PackManifestValidator.class.getResourceAsStream("/pack-manifest-v2.schema.json")) {
      SCHEMA = JSON.readTree(input);
    } catch (Exception failure) {
      throw new ExceptionInInitializerError(failure);
    }
  }

  public static final Map<String, String> CAPABILITIES =
      Map.of(
          "plugin",
          "plugins:install",
          "blueprint",
          "blueprints:write",
          "template",
          "templates:write",
          "propertySchema",
          "properties:schema",
          "savedQuery",
          "queries:write",
          "view",
          "workspace:configure",
          "dashboard",
          "dashboard:configure",
          "workspaceMode",
          "workspace:configure",
          "permissionPreset",
          "permissions:request",
          "demoData",
          "notes:write");

  public record Validation(boolean ok, String reason, List<String> order) {}

  public static Validation validate(PackManifest manifest) {
    try {
      if (manifest == null
          || manifest.getManifestVersion() == null
          || !Set.of(1, 2).contains(manifest.getManifestVersion()))
        return fail("UNSUPPORTED_MANIFEST_VERSION");
      if (manifest.getId() == null
          || manifest.getId().isBlank()
          || manifest.getName() == null
          || manifest.getName().isBlank()
          || SemVer.parse(manifest.getVersion()) == null) return fail("INVALID_MANIFEST_IDENTITY");
      if (manifest.getMinIrVersion() != null
          && (manifest.getMinIrVersion() < 1 || manifest.getMinIrVersion() > 1))
        return fail("INCOMPATIBLE_IR_VERSION");
      if (manifest.getMinCatalogVersion() != null
          && (SemVer.parse(manifest.getMinCatalogVersion()) == null
              || SemVer.parse(SemVer.CATALOG_VERSION)
                      .compareTo(SemVer.parse(manifest.getMinCatalogVersion()))
                  < 0)) return fail("INCOMPATIBLE_CATALOG_VERSION");
      for (var dependency : manifest.getDependencies())
        if (dependency == null
            || dependency.getId() == null
            || dependency.getId().isBlank()
            || SemVer.parse(dependency.getMinVersion()) == null) return fail("INVALID_DEPENDENCY");
      if (manifest.getManifestVersion() == 1)
        return manifest.getResources() != null && manifest.getResources().isEmpty()
            ? new Validation(true, null, List.of())
            : fail("RESOURCES_REQUIRE_MANIFEST_V2");
      if (manifest.hasMalformedInput()) return fail("INVALID_V2_SCHEMA");
      JsonNode root = JSON.valueToTree(manifest);
      if (JSON.writeValueAsBytes(root).length > 2_097_152
          || !bounded(root, 0)
          || !PackSchema.valid(root, SCHEMA)) return fail("INVALID_V2_SCHEMA");
      if (manifest.getMinCatalogVersion() != null) {
        var minimum = SemVer.parse(manifest.getMinCatalogVersion());
        if (minimum == null || SemVer.parse(SemVer.CATALOG_VERSION).compareTo(minimum) < 0)
          return fail("INCOMPATIBLE_CATALOG_VERSION");
      }
      var dependencyIds = new HashSet<String>();
      for (var dependency : manifest.getDependencies())
        if (dependency.getId().equals(manifest.getId())
            || !dependencyIds.add(dependency.getId())
            || SemVer.parse(dependency.getMinVersion()) == null) return fail("INVALID_DEPENDENCY");
      var resources = new TreeMap<String, JsonNode>();
      var declared = new HashSet<String>(manifest.getCapabilities());
      for (var resource : root.get("resources")) {
        String id = resource.get("id").asText();
        if (resources.put(id, resource) != null) return fail("DUPLICATE_RESOURCE_ID");
      }
      for (var resource : resources.values()) {
        String kind = resource.get("kind").asText();
        var caps = strings(resource.get("capabilities"));
        if (!caps.contains(CAPABILITIES.get(kind)) || !declared.containsAll(caps))
          return fail("UNDECLARED_CAPABILITY");
        var requires = strings(resource.get("requires"));
        if (requires.contains(resource.get("id").asText())
            || !resources.keySet().containsAll(requires)) return fail("INVALID_RESOURCE_REFERENCE");
        var spec = resource.get("spec");
        if (kind.equals("permissionPreset")
            && (!caps.containsAll(strings(spec.get("requested")))
                || !declared.containsAll(strings(spec.get("requested")))))
          return fail("UNDECLARED_CAPABILITY");
        if (kind.equals("template") && spec.has("schemaRef"))
          reference(spec.get("schemaRef").asText(), "propertySchema", resources, requires);
        if (kind.equals("savedQuery")) {
          var schema =
              reference(spec.get("schemaRef").asText(), "propertySchema", resources, requires);
          var ids = new HashSet<String>();
          for (var field : schema.get("spec").get("fields")) ids.add(field.get("id").asText());
          for (var filter : spec.get("filters"))
            if (!ids.contains(filter.get("property").asText()))
              return fail("UNKNOWN_QUERY_PROPERTY");
        }
        if (kind.equals("view")) {
          var query = reference(spec.get("queryRef").asText(), "savedQuery", resources, requires);
          if (spec.get("layout").asText().equals("board") && !spec.has("groupBy"))
            return fail("BOARD_REQUIRES_GROUP_PROPERTY");
          if (spec.has("groupBy")) {
            var schema = resources.get(query.get("spec").get("schemaRef").asText());
            boolean found = false;
            for (var field : schema.get("spec").get("fields"))
              if (field.get("id").equals(spec.get("groupBy"))) found = true;
            if (!found) return fail("UNKNOWN_QUERY_PROPERTY");
          }
        }
        if (kind.equals("dashboard") || kind.equals("workspaceMode"))
          for (var ref : spec.get("viewRefs")) reference(ref.asText(), "view", resources, requires);
        if (kind.equals("workspaceMode") && spec.has("dashboardRef"))
          reference(spec.get("dashboardRef").asText(), "dashboard", resources, requires);
        if (kind.equals("demoData")) {
          reference(spec.get("templateRef").asText(), "template", resources, requires);
          var ids = new HashSet<String>();
          for (var note : spec.get("notes"))
            if (!ids.add(note.get("id").asText())) return fail("DUPLICATE_DEMO_ID");
        }
        if (kind.equals("propertySchema")) {
          var ids = new HashSet<String>();
          for (var field : spec.get("fields")) {
            if (!ids.add(field.get("id").asText())) return fail("DUPLICATE_PROPERTY_ID");
            if (field.get("type").asText().equals("select")
                && (!field.has("options") || field.get("options").isEmpty()))
              return fail("SELECT_REQUIRES_OPTIONS");
          }
        }
        if (kind.equals("blueprint")) {
          var ir = spec.get("ir");
          var ids = new HashSet<String>();
          for (var node : ir.get("nodes")) {
            if (!node.path("id").asText().matches("[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}")
                || !ids.add(node.get("id").asText())
                || !node.path("type").isTextual()) return fail("INVALID_BLUEPRINT_IR");
            String nodeType = node.get("type").asText();
            String cap = BlueprintCapabilityService.NODE_CAPABILITY_MAP.get(nodeType);
            if (cap == null
                && !Set.of(
                        "trigger.schedule",
                        "trigger.webhook",
                        "trigger.note.saved",
                        "trigger.link.created",
                        "logic.branch",
                        "logic.wait",
                        "logic.notes.filter",
                        "logic.approval.wait",
                        "logic.approval.result")
                    .contains(nodeType)) return fail("UNKNOWN_BLUEPRINT_NODE");
            if (cap != null && !caps.contains(cap)) return fail("UNDECLARED_CAPABILITY");
          }
          for (var edge : ir.get("edges"))
            if (!ids.contains(edge.path("fromNode").asText())
                || !ids.contains(edge.path("toNode").asText()))
              return fail("INVALID_BLUEPRINT_REFERENCE");
        }
      }
      var order = new ArrayList<String>();
      var active = new HashSet<String>();
      var complete = new HashSet<String>();
      for (String id : resources.keySet()) visit(id, resources, active, complete, order);
      return new Validation(true, null, order);
    } catch (Exception invalid) {
      return fail("INVALID_RESOURCE_CONTRACT");
    }
  }

  private static JsonNode reference(
      String id, String kind, Map<String, JsonNode> resources, Set<String> requires) {
    var target = resources.get(id);
    if (target == null || !kind.equals(target.path("kind").asText()) || !requires.contains(id))
      throw new IllegalArgumentException();
    return target;
  }

  private static void visit(
      String id,
      Map<String, JsonNode> resources,
      Set<String> active,
      Set<String> complete,
      List<String> order) {
    if (complete.contains(id)) return;
    if (!active.add(id)) throw new IllegalArgumentException();
    for (String ref : new TreeSet<>(strings(resources.get(id).get("requires"))))
      visit(ref, resources, active, complete, order);
    active.remove(id);
    complete.add(id);
    order.add(id);
  }

  private static Set<String> strings(JsonNode values) {
    var result = new HashSet<String>();
    for (var value : values) result.add(value.asText());
    return result;
  }

  private static boolean bounded(JsonNode value, int depth) {
    if (depth > 32) return false;
    if (value.isContainerNode())
      for (var child : value) if (!bounded(child, depth + 1)) return false;
    return true;
  }

  private static Validation fail(String reason) {
    return new Validation(false, reason, List.of());
  }
}
