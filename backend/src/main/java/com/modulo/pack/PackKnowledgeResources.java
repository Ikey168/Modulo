package com.modulo.pack;

import com.fasterxml.jackson.databind.*;
import com.modulo.knowledge.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;

@Service
public class PackKnowledgeResources {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final NotePropertyService properties;
  private final SavedPropertyQueryService queries;

  public PackKnowledgeResources(
      JdbcTemplate jdbc, ObjectMapper json, PlatformTransactionManager manager) {
    this.jdbc = jdbc;
    this.json = json;
    properties = new NotePropertyService(jdbc, json, manager);
    queries = new SavedPropertyQueryService(jdbc, json, properties, manager);
  }

  public static String key(String pack, String schema, String field) {
    return "pack."
        + com.modulo.blueprint.approval.ApprovalService.hash(pack + ":" + schema).substring(0, 16)
        + "."
        + field;
  }

  @SuppressWarnings("unchecked")
  public void materialize(
      long owner, PackManifest manifest, Map<String, Object> resource, UUID id) {
    String kind = resource.get("kind").toString();
    var spec = (Map<String, Object>) resource.get("spec");
    if ("propertySchema".equals(kind)) {
      var existing = new HashMap<String, Map<String, Object>>();
      for (var def : properties.definitions(owner)) existing.put(def.get("key").toString(), def);
      for (var field : (List<Map<String, Object>>) spec.get("fields")) {
        String key =
            key(manifest.getId(), resource.get("id").toString(), field.get("id").toString());
        String type =
            "relation".equals(field.get("type")) ? "noteReference" : field.get("type").toString();
        var options = (List<String>) field.getOrDefault("options", List.of());
        if (!existing.containsKey(key))
          properties.define(
              owner,
              new NotePropertyService.Definition(
                  key, field.get("title").toString(), type, options, 0));
        else if (!type.equals(existing.get(key).get("type"))
            || !json.valueToTree(options).equals(existing.get(key).get("options")))
          throw new org.springframework.web.server.ResponseStatusException(
              org.springframework.http.HttpStatus.CONFLICT, "PACK_PROPERTY_TYPE_CHANGED");
      }
    }
    if ("savedQuery".equals(kind)) {
      String schema = spec.get("schemaRef").toString();
      var source =
          manifest.getResources().stream()
              .filter(item -> schema.equals(item.get("id")))
              .findFirst()
              .orElseThrow();
      var schemaSpec = (Map<String, Object>) source.get("spec");
      var columns =
          ((List<Map<String, Object>>) schemaSpec.get("fields"))
              .stream()
                  .limit(20)
                  .map(field -> key(manifest.getId(), schema, field.get("id").toString()))
                  .toList();
      var filters = new ArrayList<NotePropertyService.Filter>();
      for (var filter : (List<Map<String, Object>>) spec.get("filters"))
        filters.add(
            new NotePropertyService.Filter(
                key(manifest.getId(), schema, filter.get("property").toString()),
                filter.get("operator").toString(),
                json.valueToTree(filter.get("value"))));
      String groupBy=null;
      for(var candidate:manifest.getResources())if("view".equals(candidate.get("kind"))){var view=(Map<String,Object>)candidate.get("spec");if(resource.get("id").equals(view.get("queryRef"))&&view.get("groupBy")!=null)groupBy=key(manifest.getId(),schema,view.get("groupBy").toString());}
      var config =
          new SavedPropertyQueryService.Configuration(
              filters,
              new SavedPropertyQueryService.Sort("noteId", "asc"),
              groupBy,
              columns,
              List.of(),
              "table");
      var row =
          jdbc.queryForMap(
              "SELECT knowledge_id,knowledge_revision FROM workspace_pack_resources WHERE id=?",
              id);
      UUID previous = (UUID) row.get("knowledge_id");
      var saved =
          queries.save(
              owner,
              new SavedPropertyQueryService.Save(
                  previous,
                  previous == null ? 0 : ((Number) row.get("knowledge_revision")).longValue(),
                  resource.get("title").toString(),
                  config));
      jdbc.update(
          "UPDATE workspace_pack_resources SET knowledge_id=?,knowledge_revision=? WHERE id=?",
          saved.get("id"),
          saved.get("revision"),
          id);
    }
  }

  public boolean modified(Map<String, Object> row) {
    if (!"savedQuery".equals(row.get("kind"))) return false;
    if (row.get("knowledge_id") == null) return row.get("knowledge_revision") != null;
    var revisions =
        jdbc.queryForList(
            "SELECT revision FROM saved_property_queries WHERE id=? AND owner_id=?",
            Long.class,
            row.get("knowledge_id"),
            row.get("owner_id"));
    return revisions.isEmpty() || !Objects.equals(revisions.get(0), row.get("knowledge_revision"));
  }

  public void remove(Map<String, Object> row) {
    if (row.get("knowledge_id") != null)
      jdbc.update(
          "DELETE FROM saved_property_queries WHERE id=? AND owner_id=? AND revision=?",
          row.get("knowledge_id"),
          row.get("owner_id"),
          row.get("knowledge_revision"));
  }
}
