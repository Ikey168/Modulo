package com.modulo.blueprint;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Small JSON-shaped deep copy used to keep plugin configuration read-only. */
final class BlueprintContextCopies {
  private BlueprintContextCopies() {}

  static Map<String, Object> map(Map<String, Object> source) {
    if (source == null) return Map.of();
    var copy = new LinkedHashMap<String, Object>();
    source.forEach((key, value) -> copy.put(key, value(value)));
    return Collections.unmodifiableMap(copy);
  }

  private static Object value(Object source) {
    if (source instanceof Map<?, ?> map) {
      var copy = new LinkedHashMap<String, Object>();
      map.forEach((key, value) -> copy.put(String.valueOf(key), value(value)));
      return Collections.unmodifiableMap(copy);
    }
    if (source instanceof List<?> list) {
      return Collections.unmodifiableList(list.stream().map(BlueprintContextCopies::value).toList());
    }
    if (source instanceof Set<?> set) {
      return Collections.unmodifiableSet(
          set.stream().map(BlueprintContextCopies::value).collect(Collectors.toSet()));
    }
    return source;
  }
}
