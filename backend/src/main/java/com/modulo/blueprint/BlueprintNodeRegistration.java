package com.modulo.blueprint;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Backend half of a plugin blueprint node contribution.
 *
 * <p>The frontend descriptor owns labels, pins and editor presentation. This
 * registration owns the executable handler, capability requirement and (for a
 * trigger) the event types that feed it. Both halves use the same stable
 * {@code type + version} key.
 */
public record BlueprintNodeRegistration(
    String type,
    int version,
    String capability,
    BlueprintNodeHandler handler,
    Set<String> triggerEventTypes,
    BlueprintTriggerHandler triggerHandler) {

  public BlueprintNodeRegistration {
    if (type == null || !type.matches("[a-z][a-z0-9]*(?:\\.[a-z0-9_-]+)+")) {
      throw new IllegalArgumentException("Invalid blueprint node type: " + type);
    }
    if (version < 1) throw new IllegalArgumentException("Blueprint node version must be >= 1");
    if (capability != null && (capability.isBlank() || capability.length() > 128)) {
      throw new IllegalArgumentException("Invalid blueprint capability for " + type);
    }
    if (handler == null && triggerHandler == null) {
      // Metadata-only registrations are useful for core triggers and for pack
      // validation, so a missing executable function is allowed.
    }
    triggerEventTypes = triggerEventTypes == null
        ? Set.of()
        : Set.copyOf(new LinkedHashSet<>(triggerEventTypes));
    if (!triggerEventTypes.isEmpty() && triggerHandler == null) {
      throw new IllegalArgumentException("Trigger event types require a trigger handler: " + type);
    }
    if (triggerHandler != null && triggerEventTypes.isEmpty()) {
      throw new IllegalArgumentException("A trigger handler requires at least one event type: " + type);
    }
  }

  public static BlueprintNodeRegistration metadata(String type, int version, String capability) {
    return new BlueprintNodeRegistration(type, version, capability, null, Set.of(), null);
  }

  public static BlueprintNodeRegistration action(
      String type, int version, String capability, BlueprintNodeHandler handler) {
    if (handler == null) throw new IllegalArgumentException("Action handler is required: " + type);
    return new BlueprintNodeRegistration(type, version, capability, handler, Set.of(), null);
  }

  public static BlueprintNodeRegistration trigger(
      String type,
      int version,
      String capability,
      Collection<String> eventTypes,
      BlueprintTriggerHandler handler) {
    if (type == null || !type.startsWith("trigger.")) {
      throw new IllegalArgumentException("Trigger node types must start with trigger.: " + type);
    }
    if (eventTypes == null) throw new IllegalArgumentException("Trigger event types are required: " + type);
    return new BlueprintNodeRegistration(
        type, version, capability, null, new LinkedHashSet<>(eventTypes), handler);
  }

  public boolean executable() {
    return handler != null;
  }

  public boolean trigger() {
    return triggerHandler != null;
  }
}
