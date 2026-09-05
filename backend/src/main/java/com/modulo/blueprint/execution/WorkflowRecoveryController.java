package com.modulo.blueprint.execution;

import com.modulo.blueprint.interpreter.BlueprintInterpreterService;
import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workflow-runs")
@PreAuthorize("isAuthenticated()")
public class WorkflowRecoveryController {
  private final BlueprintInterpreterService interpreter;
  private final AuthenticatedUserService users;
  private final WorkflowRunService runs;

  public WorkflowRecoveryController(
      BlueprintInterpreterService interpreter,
      AuthenticatedUserService users,
      WorkflowRunService runs) {
    this.interpreter = interpreter;
    this.users = users;
    this.runs = runs;
  }

  @PostMapping("/{id}/cancel")
  public Map<String, String> cancel(@PathVariable UUID id) {
    runs.requestCancellation(id, users.requireUserId());
    return Map.of("status", "cancellation_requested");
  }

  public record RetryRequest(UUID requestId, int checkpoint, boolean confirmSideEffects) {}

  @PostMapping("/{id}/retry")
  public Map<String, UUID> retry(@PathVariable UUID id, @RequestBody RetryRequest request) {
    if (request.requestId() == null || request.checkpoint() < 0 || request.checkpoint() > 10001)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "INVALID_RETRY_REQUEST");
    return Map.of(
        "id",
        interpreter.retryRun(
            id,
            users.requireUserId(),
            request.requestId(),
            request.checkpoint(),
            request.confirmSideEffects()));
  }
}
