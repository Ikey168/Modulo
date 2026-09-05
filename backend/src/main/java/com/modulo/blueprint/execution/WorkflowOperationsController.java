package com.modulo.blueprint.execution;

import com.modulo.security.AuthenticatedUserService;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/workflow-ops")
@PreAuthorize("isAuthenticated()")
public class WorkflowOperationsController {
  private final WorkflowOperationsService operations;
  private final AuthenticatedUserService users;
  private final JdbcTemplate jdbc;

  public WorkflowOperationsController(
      WorkflowOperationsService operations, AuthenticatedUserService users, JdbcTemplate jdbc) {
    this.operations = operations;
    this.users = users;
    this.jdbc = jdbc;
  }

  @GetMapping("/policies/{blueprint}")
  public Map<String, Object> policy(@PathVariable long blueprint) {
    return operations.policy(users.requireUserId(), blueprint);
  }

  @PutMapping("/policies/{blueprint}")
  public Map<String, Object> policy(
      @PathVariable long blueprint, @RequestBody WorkflowOperationsService.Policy policy) {
    operations.policy(users.requireUserId(), blueprint, policy);
    return policy(blueprint);
  }

  @GetMapping("/alerts")
  public List<Map<String, Object>> alerts() {
    return jdbc.queryForList(
        "SELECT id,blueprint_id,message,created_at,read_at FROM workflow_alerts WHERE owner_id=?"
            + " AND route='EXECUTION_CENTER' ORDER BY created_at DESC LIMIT 100",
        users.requireUserId());
  }

  @PostMapping("/alerts/{id}/read")
  public void read(@PathVariable UUID id) {
    if (jdbc.update(
            "UPDATE workflow_alerts SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=? AND"
                + " owner_id=?",
            id,
            users.requireUserId())
        != 1) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ALERT_NOT_AVAILABLE");
  }
}
