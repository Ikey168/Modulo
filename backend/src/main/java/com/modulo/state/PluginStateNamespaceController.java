package com.modulo.state;

import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Lists the signed-in owner's plugin-state namespaces for full-workspace backup (#496). */
@RestController
public class PluginStateNamespaceController {
  private final PluginStateStore store;

  public PluginStateNamespaceController(PluginStateStore store) {
    this.store = store;
  }

  @GetMapping(value = "/api/workspaces/{workspace}/plugin-state", produces = "application/json")
  public ResponseEntity<List<PluginStateStore.NamespaceSummary>> namespaces(@PathVariable String workspace) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(store.namespaces(workspace));
  }
}
