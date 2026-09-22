package com.modulo.pack;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workspace-packs")
@PreAuthorize("isAuthenticated()")
public class WorkspacePackController {
  private final WorkspacePackService packs;
  private final AuthenticatedUserService users;

  public WorkspacePackController(WorkspacePackService packs, AuthenticatedUserService users) {
    this.packs = packs;
    this.users = users;
  }

  @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
  public org.springframework.http.ResponseEntity<Map<String, String>> failure(
      org.springframework.web.server.ResponseStatusException failure) {
    return org.springframework.http.ResponseEntity.status(failure.getStatus())
        .body(Map.of("code", Objects.toString(failure.getReason(), "PACK_REQUEST_FAILED")));
  }

  public record PlanInput(PackManifest manifest, boolean includeDemo) {}

  public record ApplyInput(String manifestDigest, List<String> acceptedCapabilities) {}

  public record RollbackInput(UUID release) {}

  @PostMapping("/plans")
  public Map<String, Object> plan(@RequestBody PlanInput input) {
    return packs.plan(users.requireUserId(), input.manifest(), input.includeDemo());
  }

  @PostMapping("/plans/{id}/apply")
  public Map<String, Object> apply(@PathVariable UUID id, @RequestBody ApplyInput input) {
    return packs.apply(
        id, users.requireUserId(), input.manifestDigest(), input.acceptedCapabilities());
  }

  @GetMapping("/plans/{id}")
  public Map<String, Object> operation(@PathVariable UUID id) {
    return packs.operation(id, users.requireUserId());
  }

  @PostMapping("/{pack}/rollback-plan")
  public Map<String, Object> rollback(@PathVariable String pack, @RequestBody RollbackInput input) {
    return packs.planRollback(users.requireUserId(), pack, input.release());
  }

  @PostMapping("/{pack}/uninstall-plan")
  public Map<String, Object> uninstall(@PathVariable String pack) {
    return packs.planUninstall(users.requireUserId(), pack);
  }

  @PostMapping("/{pack}/retry-runtime")
  public Map<String, Integer> retryRuntime(@PathVariable String pack) {
    return Map.of("queued", packs.retryRuntime(users.requireUserId(), pack));
  }

  @GetMapping
  public List<Map<String, Object>> installations() {
    return packs.installations(users.requireUserId());
  }

  @GetMapping("/history")
  public List<Map<String, Object>> history(@RequestParam(defaultValue = "0") int page) {
    return packs.history(users.requireUserId(), page);
  }

  @GetMapping("/resources")
  public List<Map<String, Object>> resources() {
    return packs.resources(users.requireUserId());
  }

  @GetMapping("/{pack}/releases")
  public List<Map<String, Object>> releases(@PathVariable String pack) {
    return packs.releases(users.requireUserId(), pack);
  }
}
