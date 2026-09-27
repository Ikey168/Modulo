package com.modulo.blueprint.approval;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** The fixed approval failures shared by the approval classes. */
final class ApprovalErrors {
  private ApprovalErrors() {}

  static ResponseStatusException conflict(String reason) {
    return new ApprovalFailure(HttpStatus.CONFLICT, reason);
  }

  static ResponseStatusException unavailable() {
    return new ApprovalFailure(HttpStatus.NOT_FOUND, "APPROVAL_NOT_AVAILABLE");
  }
}
