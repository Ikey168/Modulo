package com.modulo.blueprint.approval;

import com.modulo.security.AuthenticatedUserService;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/workflow-runs")
@PreAuthorize("isAuthenticated()")
public class EvidenceBundleController {
  private final EvidenceBundleService bundles;
  private final AuthenticatedUserService users;

  public EvidenceBundleController(EvidenceBundleService bundles, AuthenticatedUserService users) {
    this.bundles = bundles;
    this.users = users;
  }

  @GetMapping("/{id}/evidence-bundle")
  public ResponseEntity<byte[]> export(
      @PathVariable UUID id,
      @RequestParam(defaultValue = "false") boolean omitSummaries,
      @RequestParam(defaultValue = "false") boolean omitComments,
      @RequestParam(defaultValue = "false") boolean omitSignatures) {
    var bundle =
        bundles.export(
            id,
            users.requireUserId(),
            new EvidenceBundleService.Options(omitSummaries, omitComments, omitSignatures));
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("application/zip"))
        .header("Content-Disposition", "attachment; filename=workflow-" + id + ".zip")
        .header("X-Modulo-Evidence-Root", bundle.rootHash())
        .cacheControl(CacheControl.noStore())
        .body(bundle.bytes());
  }
}
