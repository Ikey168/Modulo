package com.modulo.blueprint.approval;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/approvals")
@PreAuthorize("isAuthenticated()")
public class ApprovalController {
  private final ApprovalService approvals;
  private final AuthenticatedUserService users;

  public ApprovalController(ApprovalService approvals, AuthenticatedUserService users) {
    this.approvals = approvals;
    this.users = users;
  }

  @ExceptionHandler(ApprovalFailure.class)
  public org.springframework.http.ResponseEntity<Map<String, String>> failure(
      ApprovalFailure failure) {
    return org.springframework.http.ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", failure.getReason()));
  }

  @GetMapping
  public List<Map<String, Object>> list(
      @RequestParam(defaultValue = "") String state,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "25") int size) {
    return approvals.list(users.requireUserId(), state, page, size);
  }

  @GetMapping("/{id}")
  public Map<String, Object> view(@PathVariable UUID id) {
    return approvals.view(id, users.requireUserId());
  }

  @GetMapping("/{id}/decisions/{decision}/signature")
  public Map<String, Object> signature(@PathVariable UUID id, @PathVariable UUID decision) {
    return approvals.signature(id, decision, users.requireUserId());
  }

  @PostMapping("/{id}/decision")
  public Map<String, Object> decide(
      @PathVariable UUID id, @RequestBody ApprovalService.DecisionInput input) {
    return approvals.decide(id, users.requireUserId(), input);
  }

  @PostMapping("/{id}/cancel")
  public void cancel(@PathVariable UUID id) {
    approvals.cancel(id, users.requireUserId());
  }

  public record GrantInput(boolean enabled) {}

  @PutMapping("/grants/{blueprint}/{reviewer}")
  public void grant(
      @PathVariable long blueprint, @PathVariable long reviewer, @RequestBody GrantInput input) {
    approvals.grant(users.requireUserId(), blueprint, reviewer, input.enabled());
  }

  @GetMapping("/{id}/evidence")
  public Map<String, Object> evidence(@PathVariable UUID id) {
    var request = view(id);
    return Map.of(
        "requestId",
        id,
        "digest",
        request.get("evidenceDigest"),
        "summary",
        request.get("summary"),
        "redacted",
        true);
  }
}
