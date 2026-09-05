package com.modulo.blueprint.execution;

/** Cooperative boundary cancellation; never interrupts an in-flight external side effect. */
public final class WorkflowCancelledException extends RuntimeException {
  public WorkflowCancelledException() {
    super("WORKFLOW_CANCELLED");
  }
}
