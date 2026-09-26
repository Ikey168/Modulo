package com.modulo.blueprint;

import com.modulo.plugin.event.PluginEvent;
import java.util.Map;

/** Immutable context delivered to a plugin blueprint trigger handler. */
public final class BlueprintTriggerContext {
  private final PluginEvent event;
  private final String nodeId;
  private final String nodeType;
  private final int nodeVersion;
  private final Map<String, Object> config;
  private final long ownerId;

  public BlueprintTriggerContext(
      PluginEvent event,
      String nodeId,
      String nodeType,
      int nodeVersion,
      Map<String, Object> config,
      long ownerId) {
    this.event = event;
    this.nodeId = nodeId;
    this.nodeType = nodeType;
    this.nodeVersion = nodeVersion;
    this.config = BlueprintContextCopies.map(config);
    this.ownerId = ownerId;
  }

  public PluginEvent event() { return event; }
  public String nodeId() { return nodeId; }
  public String nodeType() { return nodeType; }
  public int nodeVersion() { return nodeVersion; }
  public Map<String, Object> config() { return config; }
  public long ownerId() { return ownerId; }
}
