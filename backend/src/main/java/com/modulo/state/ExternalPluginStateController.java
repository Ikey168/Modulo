package com.modulo.state;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.*;

/** Same bounded API contract, authorized by workload identity plus explicit owner delegation. */
@RestController
@RequestMapping(
    value = "/api/plugin-state/callback/workspaces/{workspace}/{namespace}",
    produces = "application/json")
public class ExternalPluginStateController extends PluginStateController {
  private final PluginStateGrantService grants;
  private final PluginStateStore host;

  public ExternalPluginStateController(PluginStateStore store, PluginStateGrantService grants) {
    super(store);
    this.host = store;
    this.grants = grants;
  }

  @Override
  protected PluginStateStore store() {
    var request =
        ((ServletRequestAttributes) RequestContextHolder.currentRequestAttributes()).getRequest();
    return grants.delegate(
        host,
        request.getHeader("X-Modulo-Plugin-Token"),
        request.getHeader("X-Modulo-State-Grant"));
  }
}
