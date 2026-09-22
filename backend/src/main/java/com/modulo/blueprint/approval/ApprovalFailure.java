package com.modulo.blueprint.approval;

/** Fixed server-classified approval failures are safe for trace metadata. */
public final class ApprovalFailure extends org.springframework.web.server.ResponseStatusException {
  public ApprovalFailure(org.springframework.http.HttpStatus status, String code) {
    super(status, code);
  }
}
