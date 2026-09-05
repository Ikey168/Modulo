package com.modulo.blueprint.execution;

@org.springframework.stereotype.Component
@org.springframework.context.annotation.Profile("!test")
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(
    name = "modulo.workflow.retention.enabled",
    havingValue = "true",
    matchIfMissing = true)
public class WorkflowRetention {
  private final WorkflowRunService runs;

  public WorkflowRetention(WorkflowRunService runs) {
    this.runs = runs;
  }

  @org.springframework.scheduling.annotation.Scheduled(
      fixedDelayString = "${modulo.workflow.retention.interval-ms:3600000}")
  public void prune() {
    runs.pruneExpired();
  }
}
