package com.modulo.blueprint;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Runtime registry for blueprint node metadata and executable contributions.
 *
 * <p>Core node metadata is present from construction. Plugin managers add and
 * remove plugin-owned entries as plugins start and stop. A plugin cannot
 * silently replace another plugin's node or a core node with the same pinned
 * version.
 */
@Service
public class BlueprintNodeRegistry {
  public static final String CORE_OWNER = "modulo-core";

  /** Capabilities for nodes that are always available without a plugin. */
  public static final Map<String, String> CORE_CAPABILITIES = Map.ofEntries(
      Map.entry("action.approval.request", "approval:request"),
      Map.entry("action.code.execute", "code:execute"),
      Map.entry("action.wasm.execute", "wasm:execute"));

  /**
   * Capabilities for legacy built-in handlers whose editor descriptors belong
   * to optional frontend plugins. Keeping this execution map preserves the
   * capability check for saved blueprints while keeping their node metadata
   * out of the core registry.
   */
  public static final Map<String, String> LEGACY_BUILTIN_CAPABILITIES = Map.ofEntries(
      Map.entry("action.note.create", "notes:write"),
      Map.entry("action.tag.add", "notes:write"),
      Map.entry("action.note.anchor", "blockchain:anchor"),
      Map.entry("action.ai.summarize", "ai:invoke"),
      Map.entry("action.audit.reaudit", "notes:write"),
      Map.entry("action.audit.digest", "notes:write"),
      Map.entry("action.tax.deadline.reminder", "notes:write"),
      Map.entry("action.invoice.chase", "notes:write"),
      Map.entry("action.vies.check", "network:vies"),
      Map.entry("action.noesis.brief", "network:noesis"));

  private static final Set<String> CORE_NODE_TYPES = Set.of(
      "trigger.manual",
      "trigger.schedule",
      "action.approval.request",
      "action.code.execute",
      "action.wasm.execute",
      "logic.approval.wait",
      "logic.approval.result",
      "logic.wait",
      "logic.branch");

  private final Map<Key, Entry> entries = new ConcurrentHashMap<>();

  public BlueprintNodeRegistry() {
    for (String type : CORE_NODE_TYPES) {
      register(CORE_OWNER, BlueprintNodeRegistration.metadata(type, 1, CORE_CAPABILITIES.get(type)));
    }
  }

  /** Register or replace an entry owned by the same plugin. */
  public synchronized void register(String owner, BlueprintNodeRegistration registration) {
    if (owner == null || owner.isBlank()) throw new IllegalArgumentException("Node owner is required");
    Key key = new Key(registration.type(), registration.version());
    Entry existing = entries.get(key);
    if (existing != null && !existing.owner().equals(owner)) {
      throw new IllegalArgumentException(
          "Blueprint node already registered: " + registration.type() + "@" + registration.version());
    }
    entries.put(key, new Entry(owner, registration));
  }

  public synchronized void register(String owner, Collection<BlueprintNodeRegistration> registrations) {
    if (owner == null || owner.isBlank()) throw new IllegalArgumentException("Node owner is required");
    if (registrations == null) throw new IllegalArgumentException("Blueprint registrations are required");
    // Validate collisions before mutating the registry, so a bad plugin does
    // not leave half of its node set active.
    Map<Key, BlueprintNodeRegistration> next = new LinkedHashMap<>();
    for (BlueprintNodeRegistration registration : registrations) {
      if (registration == null) throw new IllegalArgumentException("Blueprint registration is null");
      Key key = new Key(registration.type(), registration.version());
      Entry existing = entries.get(key);
      if (existing != null && !existing.owner().equals(owner)) {
        throw new IllegalArgumentException(
            "Blueprint node already registered: " + registration.type() + "@" + registration.version());
      }
      if (next.put(key, registration) != null) {
        throw new IllegalArgumentException(
            "Duplicate blueprint node registration: " + registration.type() + "@" + registration.version());
      }
    }
    next.forEach((key, registration) -> entries.put(key, new Entry(owner, registration)));
  }

  /** Replace the complete contribution set for one owner without partial updates. */
  public synchronized void replaceOwner(String owner, Collection<BlueprintNodeRegistration> registrations) {
    if (owner == null || owner.isBlank()) throw new IllegalArgumentException("Node owner is required");
    if (CORE_OWNER.equals(owner)) throw new IllegalArgumentException("Core registrations cannot be replaced");
    if (registrations == null) throw new IllegalArgumentException("Blueprint registrations are required");

    Map<Key, BlueprintNodeRegistration> next = new LinkedHashMap<>();
    for (BlueprintNodeRegistration registration : registrations) {
      if (registration == null) throw new IllegalArgumentException("Blueprint registration is null");
      Key key = new Key(registration.type(), registration.version());
      Entry existing = entries.get(key);
      if (existing != null && !existing.owner().equals(owner)) {
        throw new IllegalArgumentException(
            "Blueprint node already registered: " + registration.type() + "@" + registration.version());
      }
      if (next.put(key, registration) != null) {
        throw new IllegalArgumentException(
            "Duplicate blueprint node registration: " + registration.type() + "@" + registration.version());
      }
    }
    entries.entrySet().removeIf(entry -> owner.equals(entry.getValue().owner()));
    next.forEach((key, registration) -> entries.put(key, new Entry(owner, registration)));
  }

  public synchronized void unregisterOwner(String owner) {
    if (owner == null || owner.isBlank() || CORE_OWNER.equals(owner)) return;
    entries.entrySet().removeIf(entry -> owner.equals(entry.getValue().owner()));
  }

  public boolean isKnown(String type, int version) {
    return entries.containsKey(new Key(type, normalizeVersion(version)));
  }

  public Optional<String> capability(String type, int version) {
    return Optional.ofNullable(entry(type, version)).map(Entry::registration).map(BlueprintNodeRegistration::capability);
  }

  public Optional<BlueprintNodeHandler> handler(String type, int version) {
    return Optional.ofNullable(entry(type, version))
        .map(Entry::registration)
        .map(BlueprintNodeRegistration::handler);
  }

  public Optional<BlueprintNodeRegistration> trigger(String type, int version) {
    return Optional.ofNullable(entry(type, version))
        .map(Entry::registration)
        .filter(BlueprintNodeRegistration::trigger);
  }

  public Optional<String> ownerOf(String type, int version) {
    return Optional.ofNullable(entry(type, version)).map(Entry::owner);
  }

  public Set<String> knownTypes() {
    Set<String> types = new LinkedHashSet<>();
    entries.keySet().forEach(key -> types.add(key.type()));
    return Collections.unmodifiableSet(types);
  }

  public Set<String> coreNodeTypes() {
    return CORE_NODE_TYPES;
  }

  /** A standalone core-only registry for static validation and tooling. */
  public static BlueprintNodeRegistry coreOnly() {
    return new BlueprintNodeRegistry();
  }

  private Entry entry(String type, int version) {
    if (type == null) return null;
    return entries.get(new Key(type, normalizeVersion(version)));
  }

  private static int normalizeVersion(int version) {
    return version < 1 ? 1 : version;
  }

  private record Key(String type, int version) {}

  private record Entry(String owner, BlueprintNodeRegistration registration) {}
}
