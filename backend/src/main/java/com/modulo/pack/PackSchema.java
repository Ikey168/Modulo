package com.modulo.pack;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

/** Validator for the bounded draft-07 keyword subset used by our versioned schema. */
final class PackSchema {
  static boolean valid(JsonNode value, JsonNode schema) {
    if (schema.has("oneOf")) {
      int count = 0;
      for (var choice : schema.get("oneOf")) if (valid(value, choice)) count++;
      if (count != 1) return false;
    }
    if (schema.has("enum")) {
      boolean match = false;
      for (var option : schema.get("enum")) if (option.equals(value)) match = true;
      if (!match) return false;
    }
    if (schema.has("type")) {
      var type = schema.get("type");
      boolean match = false;
      if (type.isArray()) {
        for (var option : type) match |= type(value, option.asText());
      } else match = type(value, type.asText());
      if (!match) return false;
    }
    if (value.isTextual()) {
      String text = value.asText();
      if (text.codePointCount(0, text.length()) < schema.path("minLength").asInt(0)
          || text.codePointCount(0, text.length())
              > schema.path("maxLength").asInt(Integer.MAX_VALUE)) return false;
      if (schema.has("pattern") && !text.matches(schema.get("pattern").asText())) return false;
    }
    if (value.isArray()) {
      if (value.size() < schema.path("minItems").asInt(0)
          || value.size() > schema.path("maxItems").asInt(Integer.MAX_VALUE)) return false;
      var unique = new HashSet<JsonNode>();
      for (var item : value) {
        if (schema.path("uniqueItems").asBoolean() && !unique.add(item)) return false;
        if (schema.has("items") && !valid(item, schema.get("items"))) return false;
      }
    }
    if (value.isObject()) {
      for (var required : schema.path("required")) if (!value.has(required.asText())) return false;
      var properties = schema.path("properties");
      var names = value.fieldNames();
      while (names.hasNext()) {
        String name = names.next();
        if (properties.has(name)) {
          if (!valid(value.get(name), properties.get(name))) return false;
        } else if (schema.has("additionalProperties")
            && !schema.get("additionalProperties").asBoolean(true)) return false;
      }
    }
    return true;
  }

  private static boolean type(JsonNode value, String type) {
    return switch (type) {
      case "object" -> value.isObject();
      case "array" -> value.isArray();
      case "string" -> value.isTextual();
      case "number" -> value.isNumber();
      case "integer" -> value.isIntegralNumber();
      case "boolean" -> value.isBoolean();
      case "null" -> value.isNull();
      default -> false;
    };
  }
}
