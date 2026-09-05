package com.modulo.observability;

import java.util.UUID;
import org.slf4j.MDC;

/**
 * Server-generated identifiers only; scoped restoration prevents pooled-thread correlation leaks.
 */
public final class ExecutionTraceContext implements AutoCloseable {
  public record Trace(UUID runId, UUID stepId, boolean noteReferencesAllowed) {}

  private static final ThreadLocal<Trace> CURRENT = new ThreadLocal<>();
  private final Trace previous;
  private final String previousRun, previousStep;

  private ExecutionTraceContext(Trace trace) {
    previous = CURRENT.get();
    previousRun = MDC.get("workflowRunId");
    previousStep = MDC.get("workflowStepId");
    CURRENT.set(trace);
    MDC.put("workflowRunId", trace.runId().toString());
    MDC.put("workflowStepId", trace.stepId().toString());
  }

  public static ExecutionTraceContext open(UUID run, UUID step, boolean references) {
    return new ExecutionTraceContext(new Trace(run, step, references));
  }

  public static Trace current() {
    return CURRENT.get();
  }

  @Override
  public void close() {
    if (previous == null) CURRENT.remove();
    else CURRENT.set(previous);
    if (previousRun == null) MDC.remove("workflowRunId");
    else MDC.put("workflowRunId", previousRun);
    if (previousStep == null) MDC.remove("workflowStepId");
    else MDC.put("workflowStepId", previousStep);
  }
}
