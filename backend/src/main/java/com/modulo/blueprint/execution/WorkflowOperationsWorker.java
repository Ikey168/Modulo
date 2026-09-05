package com.modulo.blueprint.execution;

@org.springframework.stereotype.Component
@org.springframework.context.annotation.Profile("!test")
public class WorkflowOperationsWorker {
  private final WorkflowOperationsService operations;

  public WorkflowOperationsWorker(WorkflowOperationsService operations) {
    this.operations = operations;
  }

  @org.springframework.scheduling.annotation.Scheduled(
      fixedDelayString = "${modulo.workflow.operations.poll-ms:30000}")
  public void poll() {
    operations.refreshMetrics();
    operations.evaluateAlerts();
  }
}
