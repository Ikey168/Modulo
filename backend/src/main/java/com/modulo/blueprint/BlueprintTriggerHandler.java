package com.modulo.blueprint;

import java.util.Map;

/** Converts a plugin event into the data outputs of a blueprint trigger node. */
@FunctionalInterface
public interface BlueprintTriggerHandler {

  /**
   * Return trigger output pins for the event, or {@code null} to ignore it.
   * The context carries the node configuration, and the owner id is supplied
   * so a provider can enforce tenant ownership before exposing event data.
   */
  Map<String, Object> outputs(BlueprintTriggerContext context);
}
