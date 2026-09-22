package com.modulo.blueprint;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Collections;

/**
 * Result returned by a blueprint node handler.
 *
 * The output map is copied so a handler cannot mutate the result after the
 * interpreter has started resolving downstream pins.
 */
public record BlueprintNodeResult(
    Map<String, Object> outputs,
    String nextExecOut,
    boolean skipped) {

  public BlueprintNodeResult(Map<String, Object> outputs, String nextExecOut) {
    this(outputs, nextExecOut, false);
  }

  public BlueprintNodeResult {
    outputs = outputs == null
        ? Map.of()
        : Collections.unmodifiableMap(new LinkedHashMap<>(outputs));
  }
}
