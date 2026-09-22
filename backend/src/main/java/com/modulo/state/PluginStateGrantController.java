package com.modulo.state;

import java.util.List;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plugin-state/grants")
public class PluginStateGrantController {
  private final PluginStateGrantService grants;

  public PluginStateGrantController(PluginStateGrantService grants) {
    this.grants = grants;
  }

  @PostMapping
  public ResponseEntity<PluginStateGrantService.IssuedGrant> create(
      @RequestBody PluginStateGrantService.GrantRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .cacheControl(CacheControl.noStore())
        .body(grants.create("personal", request));
  }

  @GetMapping
  public ResponseEntity<List<PluginStateGrantService.Grant>> list() {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(grants.list());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> revoke(@PathVariable String id) {
    grants.revoke(id);
    return ResponseEntity.noContent().build();
  }
}
