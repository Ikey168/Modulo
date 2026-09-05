package com.modulo.pack;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/audit-pack")
@PreAuthorize("isAuthenticated()")
public class AuditPackController {
  private final AuditPackService audit;
  private final AuthenticatedUserService users;

  public AuditPackController(AuditPackService audit, AuthenticatedUserService users) {
    this.audit = audit;
    this.users = users;
  }

  public record Reviewer(long reviewer) {}

  public record Submit(UUID requestId, boolean shareReport,Long expectedReport,Long expectedVersion) {}

  @GetMapping
  public Object status() {
    return audit.status(users.requireUserId());
  }

  @PostMapping("/manifest")
  public Object manifest(@RequestBody Reviewer body) {
    return audit.manifest(users.requireUserId(), body.reviewer());
  }

  @GetMapping("/engagements")
  public Object list() {
    return audit.list(users.requireUserId());
  }

  @PostMapping("/engagements")
  public Object create(@RequestBody AuditPackService.Intake body) {
    return audit.create(users.requireUserId(), body);
  }

  @GetMapping("/engagements/{id}")
  public Object get(@PathVariable UUID id) {
    return audit.engagement(users.requireUserId(), id);
  }

  @PostMapping("/engagements/{id}/findings")
  public Object finding(@PathVariable UUID id, @RequestBody AuditPackService.Finding body) {
    return audit.finding(users.requireUserId(), id, body);
  }

  @PostMapping("/engagements/{id}/report")
  public Object report(@PathVariable UUID id) {
    return audit.report(users.requireUserId(), id);
  }

  @PostMapping("/engagements/{id}/submit")
  public Object submit(@PathVariable UUID id, @RequestBody Submit body) {
    return audit.submit(users.requireUserId(), id, body.requestId(), body.shareReport(),body.expectedReport(),body.expectedVersion());
  }

  @GetMapping("/approvals/{id}/report")
  public Object reviewedReport(@PathVariable UUID id) {
    return audit.reviewedReport(users.requireUserId(), id);
  }

  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public org.springframework.http.ResponseEntity<Map<String, String>> failure(
      org.springframework.web.server.ResponseStatusException failure) {
    return org.springframework.http.ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", Objects.toString(failure.getReason(), "AUDIT_REQUEST_FAILED")));
  }
}
