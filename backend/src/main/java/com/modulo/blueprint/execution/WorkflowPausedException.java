package com.modulo.blueprint.execution;

/** Internal control flow after a durable wait checkpoint has been committed. */
public final class WorkflowPausedException extends RuntimeException {
  public WorkflowPausedException() {
    super("WORKFLOW_WAITING");
  }
}
