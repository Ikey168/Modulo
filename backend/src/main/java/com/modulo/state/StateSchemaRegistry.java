package com.modulo.state;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Bounded structural schema dialect. Unsupported keywords fail registration, never silently pass.
 */
final class StateSchemaRegistry {
  private static final Set<String> KEYWORDS =
      Set.of(
          "type",
          "properties",
          "required",
          "additionalProperties",
          "items",
          "enum",
          "minItems",
          "maxItems",
          "minLength",
          "maxLength",
          "minimum",
          "maximum");
  private static final Set<String> TYPES =
      Set.of("object", "array", "string", "number", "integer", "boolean", "null");
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  StateSchemaRegistry(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  void register(long owner, String namespace, String id, int version, JsonNode definition) {
    if (id == null
        || id.isBlank()
        || id.length() > 256
        || id.startsWith("modulo.")
        || version < 1
        || definition == null
        || definition.toString().length() > 16384) throw error("STATE_INVALID_SCHEMA");
    checkDefinition(definition, 0);
    var existing =
        jdbc.queryForList(
            "SELECT definition::text FROM plugin_state_schemas WHERE owner_id=? AND namespace=? AND"
                + " schema_id=? AND schema_version=?",
            String.class,
            owner,
            namespace,
            id,
            version);
    if (!existing.isEmpty()) {
      if (!read(existing.get(0)).equals(definition))
        throw new ResponseStatusException(HttpStatus.CONFLICT, "STATE_SCHEMA_IMMUTABLE");
      return;
    }
    if (jdbc.queryForObject(
            "SELECT count(*) FROM plugin_state_schemas WHERE owner_id=?", Long.class, owner)
        >= 1000)
      throw new ResponseStatusException(
          HttpStatus.TOO_MANY_REQUESTS, "STATE_SCHEMA_QUOTA_EXCEEDED");
    jdbc.update(
        "INSERT INTO plugin_state_schemas(owner_id,namespace,schema_id,schema_version,definition)"
            + " VALUES (?,?,?,?,CAST(? AS jsonb))",
        owner,
        namespace,
        id,
        version,
        definition.toString());
  }

  void validate(long owner, String namespace, String id, int version, JsonNode value) {
    JsonNode schema = builtin(namespace, id, version);
    if (schema == null) {
      var found =
          jdbc.queryForList(
              "SELECT definition::text FROM plugin_state_schemas WHERE owner_id=? AND namespace=?"
                  + " AND schema_id=? AND schema_version=?",
              String.class,
              owner,
              namespace,
              id,
              version);
      if (found.isEmpty()) throw error("STATE_UNKNOWN_SCHEMA");
      schema = read(found.get(0));
    }
    validateValue(schema, value, 0);
  }

  private JsonNode builtin(String namespace, String id, int version) {
    if (version != 1) return null;
    String definition =
        switch (id) {
          case "modulo.migration" -> "{\"type\":\"object\"}";
          case "modulo.canvas.preference" ->
              namespace.equals("canvas-board") ? "{\"type\":\"string\",\"maxLength\":128}" : null;
          case "modulo.canvas.board" ->
              namespace.equals("canvas-board")
                  ? "{\"type\":\"object\",\"required\":[\"id\",\"name\",\"cards\",\"connections\"],\"properties\":{\"id\":{\"type\":\"string\",\"maxLength\":128},\"name\":{\"type\":\"string\",\"maxLength\":200},\"cards\":{\"type\":\"array\",\"maxItems\":10000},\"connections\":{\"type\":\"array\",\"maxItems\":10000}}}"
                  : null;
          case "modulo.embedded-database" ->
              namespace.equals("notion-database")
                  ? "{\"type\":\"object\",\"required\":[\"id\",\"title\",\"columns\",\"rows\"],\"properties\":{\"id\":{\"type\":\"string\"},\"title\":{\"type\":\"string\"},\"columns\":{\"type\":\"array\"},\"rows\":{\"type\":\"array\"}}}"
                  : null;
          case "modulo.saved-searches" ->
              namespace.equals("saved-searches")
                  ? "{\"type\":\"array\",\"items\":{\"type\":\"object\"}}"
                  : null;
          case "modulo.workspace.installations" ->
              namespace.equals("workspace-settings")
                  ? "{\"type\":\"array\",\"items\":{\"type\":\"object\",\"required\":[\"id\",\"enabled\"],\"properties\":{\"id\":{\"type\":\"string\"},\"enabled\":{\"type\":\"boolean\"}}}}"
                  : null;
          case "modulo.workspace.hub-tab" ->
              namespace.equals("workspace-settings")
                  ? "{\"type\":\"string\",\"maxLength\":128}"
                  : null;
          default -> null;
        };
    return definition == null ? null : read(definition);
  }

  private void checkDefinition(JsonNode schema, int depth) {
    if (depth > 16 || !schema.isObject()) throw error("STATE_INVALID_SCHEMA");
    schema
        .fieldNames()
        .forEachRemaining(
            k -> {
              if (!KEYWORDS.contains(k)) throw error("STATE_UNSUPPORTED_SCHEMA_KEYWORD");
            });
    if (schema.has("type")
        && (!schema.get("type").isTextual() || !TYPES.contains(schema.get("type").textValue())))
      throw error("STATE_INVALID_SCHEMA");
    if (schema.has("properties")) {
      if (!schema.get("properties").isObject()) throw error("STATE_INVALID_SCHEMA");
      schema
          .get("properties")
          .elements()
          .forEachRemaining(child -> checkDefinition(child, depth + 1));
    }
    if (schema.has("required")) {
      if (!schema.get("required").isArray()) throw error("STATE_INVALID_SCHEMA");
      for (JsonNode key : schema.get("required"))
        if (!key.isTextual()) throw error("STATE_INVALID_SCHEMA");
    }
    if (schema.has("additionalProperties") && !schema.get("additionalProperties").isBoolean())
      throw error("STATE_INVALID_SCHEMA");
    if (schema.has("items")) checkDefinition(schema.get("items"), depth + 1);
    if (schema.has("enum") && (!schema.get("enum").isArray() || schema.get("enum").isEmpty()))
      throw error("STATE_INVALID_SCHEMA");
    for (String bound : List.of("minItems", "maxItems", "minLength", "maxLength"))
      if (schema.has(bound)
          && (!schema.get(bound).isIntegralNumber()
              || !schema.get(bound).canConvertToInt()
              || schema.get(bound).intValue() < 0)) throw error("STATE_INVALID_SCHEMA");
    for (String bound : List.of("minimum", "maximum"))
      if (schema.has(bound) && !schema.get(bound).isNumber()) throw error("STATE_INVALID_SCHEMA");
  }

  private void validateValue(JsonNode schema, JsonNode value, int depth) {
    if (depth > 64) throw error("STATE_SCHEMA_MISMATCH");
    if (schema.has("type")) {
      boolean matches =
          switch (schema.get("type").asText()) {
            case "object" -> value.isObject();
            case "array" -> value.isArray();
            case "string" -> value.isTextual();
            case "number" -> value.isNumber();
            case "integer" -> value.isIntegralNumber();
            case "boolean" -> value.isBoolean();
            case "null" -> value.isNull();
            default -> false;
          };
      if (!matches) throw error("STATE_SCHEMA_MISMATCH");
    }
    if (schema.has("enum")) {
      boolean found = false;
      for (JsonNode candidate : schema.get("enum")) if (candidate.equals(value)) found = true;
      if (!found) throw error("STATE_SCHEMA_MISMATCH");
    }
    if (value.isObject()) {
      for (JsonNode key : schema.path("required"))
        if (!value.has(key.asText())) throw error("STATE_SCHEMA_MISMATCH");
      var fields = value.fields();
      while (fields.hasNext()) {
        var field = fields.next();
        JsonNode child = schema.path("properties").get(field.getKey());
        if (child != null) validateValue(child, field.getValue(), depth + 1);
        else if (schema.has("additionalProperties")
            && !schema.get("additionalProperties").booleanValue())
          throw error("STATE_SCHEMA_MISMATCH");
      }
    }
    if (value.isArray()) {
      bound(schema, "minItems", "maxItems", value.size());
      if (schema.has("items"))
        for (JsonNode item : value) validateValue(schema.get("items"), item, depth + 1);
    }
    if (value.isTextual())
      bound(
          schema,
          "minLength",
          "maxLength",
          value.textValue().codePointCount(0, value.textValue().length()));
    if (value.isNumber()
        && ((schema.has("minimum")
                && value.decimalValue().compareTo(schema.get("minimum").decimalValue()) < 0)
            || (schema.has("maximum")
                && value.decimalValue().compareTo(schema.get("maximum").decimalValue()) > 0)))
      throw error("STATE_SCHEMA_MISMATCH");
  }

  private void bound(JsonNode schema, String min, String max, int value) {
    if ((schema.has(min) && value < schema.get(min).intValue())
        || (schema.has(max) && value > schema.get(max).intValue()))
      throw error("STATE_SCHEMA_MISMATCH");
  }

  private JsonNode read(String value) {
    try {
      return json.readTree(value);
    } catch (Exception invalid) {
      throw error("STATE_INVALID_SCHEMA");
    }
  }

  private static ResponseStatusException error(String code) {
    return new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
  }
}
