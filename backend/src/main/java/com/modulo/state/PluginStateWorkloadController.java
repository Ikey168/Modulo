package com.modulo.state;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

/** Owner provisioning and outbound-only grant renewal for callback workloads. */
@RestController
public class PluginStateWorkloadController {
  private final PluginStateGrantService grants;

  public PluginStateWorkloadController(PluginStateGrantService grants) {
    this.grants = grants;
  }

  @PostMapping("/api/plugin-state/workloads")
  public ResponseEntity<PluginStateGrantService.IssuedWorkload> create(
      @RequestBody PluginStateGrantService.WorkloadRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore())
        .body(grants.createWorkload(request));
  }

  @GetMapping("/api/plugin-state/workloads")
  public ResponseEntity<List<PluginStateGrantService.Workload>> list() {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(grants.listWorkloads());
  }

  @DeleteMapping("/api/plugin-state/workloads/{id}")
  public ResponseEntity<Void> revoke(@PathVariable String id) {
    grants.revokeWorkload(id);
    return ResponseEntity.noContent().build();
  }

  public record RenewalRequest(int lifetimeSeconds) {}

  @PostMapping("/api/plugin-state/callback/grants/rotate")
  public ResponseEntity<PluginStateGrantService.IssuedGrant> renew(
      HttpServletRequest request, @RequestBody RenewalRequest body) {
    return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(
        grants.renew(request.getHeader("X-Modulo-Plugin-Token"),
            request.getHeader("X-Modulo-State-Grant"), body.lifetimeSeconds()));
  }
}
