package com.modulo.blueprint.approval;

@org.springframework.stereotype.Component
@org.springframework.context.annotation.Profile("!test")
public class ApprovalWorker {
  private final ApprovalService approvals;

  public ApprovalWorker(ApprovalService approvals) {
    this.approvals = approvals;
  }

  @org.springframework.scheduling.annotation.Scheduled(
      fixedDelayString = "${modulo.approval.poll-ms:5000}")
  public void poll() {
    approvals.sweep();
  }
}
