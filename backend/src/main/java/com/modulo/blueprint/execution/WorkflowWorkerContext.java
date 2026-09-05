package com.modulo.blueprint.execution;

/** Marks executions owned by the database-elected scheduler, for crash diagnosis. */
public final class WorkflowWorkerContext implements AutoCloseable {
  private static final ThreadLocal<Boolean> ACTIVE = new ThreadLocal<>();
  private final Boolean previous = ACTIVE.get();

  public WorkflowWorkerContext() {
    ACTIVE.set(true);
  }

  public static boolean active() {
    return Boolean.TRUE.equals(ACTIVE.get());
  }

  public void close() {
    if (previous == null) ACTIVE.remove();
    else ACTIVE.set(previous);
  }
}
