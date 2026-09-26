# Blueprint node contributions

Plugins can extend Modulo's blueprint palette and runtime with the same stable
`type` and `version` key.

The frontend plugin contributes the editor descriptor:

```ts
ctx.addBlueprintNode({
  type: 'calendar.create-event',
  version: 1,
  category: 'action',
  title: 'Create calendar event',
  description: 'Create an event in the connected calendar.',
  execIn: true,
  execOut: ['then'],
  inputs: [/* ... */],
  outputs: [/* ... */],
  capability: 'calendar:write',
});
```

An in-process backend plugin implements `BlueprintNodeProvider` and returns the
executable registration:

```java
public final class CalendarPlugin implements Plugin, BlueprintNodeProvider {
  @Override
  public Collection<BlueprintNodeRegistration> getBlueprintNodes() {
    return List.of(BlueprintNodeRegistration.action(
        "calendar.create-event",
        1,
        "calendar:write",
        context -> {
          // Use the bounded context to read resolved inputs and node config.
          String title = String.valueOf(context.input("title"));
          return new BlueprintNodeResult(
              Map.of("eventId", createEvent(title)), "then");
        }));
  }
}
```

Trigger nodes use `BlueprintNodeRegistration.trigger`. The provider declares
the event types it consumes, and its handler receives an immutable trigger
context containing the event, node configuration, and blueprint owner id.
Returning `null` ignores an event.

The plugin manager registers contributions after a plugin starts and removes
them before it stops. A node type cannot replace a core node or another
plugin's registration. The interpreter refreshes active blueprints when a
plugin starts or stops, so trigger subscriptions follow the plugin lifecycle.
Pack validation resolves node types and capabilities through the live registry.

`BlueprintNodeExecutionContext` exposes resolved inputs, immutable node config,
the blueprint id, owner id, and workflow lease. It does not expose interpreter
internals. External plugins currently need a host protocol extension before
they can provide executable JVM handlers.
