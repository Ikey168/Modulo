package com.modulo.blueprint;

/** Executes one registered blueprint action or logic node. */
@FunctionalInterface
public interface BlueprintNodeHandler {

  /**
   * Execute the node with the inputs resolved from upstream pins.
   *
   * <p>Handlers should use the host services exposed by their plugin and
   * return a structured failure as an exception. The interpreter records the
   * failure and stops the run according to the normal workflow policy.
   */
  BlueprintNodeResult execute(BlueprintNodeExecutionContext context);
}
