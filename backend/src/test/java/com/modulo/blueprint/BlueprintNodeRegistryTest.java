package com.modulo.blueprint;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class BlueprintNodeRegistryTest {

  @Test
  void coreNodesRemainAvailableAndPluginActionsExposeTheirContract() {
    var registry = new BlueprintNodeRegistry();
    var action =
        BlueprintNodeRegistration.action(
            "acme.lookup", 2, "acme:lookup", context -> new BlueprintNodeResult(Map.of("value", 7), "then"));

    registry.register("acme-plugin", action);

    assertThat(registry.isKnown("action.approval.request", 1)).isTrue();
    assertThat(registry.capability("action.approval.request", 1)).contains("approval:request");
    assertThat(registry.isKnown("action.note.create", 1)).isFalse();
    assertThat(registry.isKnown("action.audit.digest", 1)).isFalse();
    assertThat(registry.ownerOf("action.audit.digest", 1)).isEmpty();
    assertThat(registry.isKnown("acme.lookup", 2)).isTrue();
    assertThat(registry.capability("acme.lookup", 2)).contains("acme:lookup");
    assertThat(registry.handler("acme.lookup", 2)).isPresent();
    assertThat(registry.ownerOf("acme.lookup", 2)).contains("acme-plugin");
  }

  @Test
  void pluginCannotReplaceAnotherOwnerAndBatchRegistrationIsAtomic() {
    var registry = new BlueprintNodeRegistry();
    var first = BlueprintNodeRegistration.metadata("acme.first", 1, null);
    registry.register("plugin-a", first);

    assertThatThrownBy(() -> registry.register("plugin-b", first))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("already registered");

    var second = BlueprintNodeRegistration.metadata("acme.second", 1, null);
    assertThatThrownBy(
            () -> registry.register("plugin-b", List.of(second, first)))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(registry.isKnown("acme.second", 1)).isFalse();

    registry.unregisterOwner("plugin-a");
    assertThat(registry.isKnown("acme.first", 1)).isFalse();
    assertThat(registry.isKnown("action.approval.request", 1)).isTrue();
  }

  @Test
  void replacingAnOwnerRemovesNodesItNoLongerProvides() {
    var registry = new BlueprintNodeRegistry();
    registry.register(
        "plugin-a",
        List.of(
            BlueprintNodeRegistration.metadata("acme.first", 1, null),
            BlueprintNodeRegistration.metadata("acme.second", 1, null)));

    registry.replaceOwner(
        "plugin-a", List.of(BlueprintNodeRegistration.metadata("acme.second", 1, null)));

    assertThat(registry.isKnown("acme.first", 1)).isFalse();
    assertThat(registry.isKnown("acme.second", 1)).isTrue();
  }

  @Test
  void triggerRegistrationCarriesEventTypesAndNodeConfiguration() {
    var registry = new BlueprintNodeRegistry();
    var node = new BlueprintIRGraph.IRNode();
    node.setId("trigger");
    node.setType("acme.changed");
    node.setNodeVersion(1);
    node.setConfig(Map.of("field", "status"));
    var event = new com.modulo.plugin.event.SystemEvent.ApplicationStarted();

    registry.register(
        "acme-plugin",
        BlueprintNodeRegistration.trigger(
            "trigger.acme.changed",
            1,
            null,
            Set.of(event.getType()),
            context ->
                Map.of("field", context.config().get("field"), "owner", context.ownerId())));

    var registration = registry.trigger("trigger.acme.changed", 1).orElseThrow();
    assertThat(registration.triggerEventTypes()).containsExactly(event.getType());
    assertThat(registration.triggerHandler().outputs(
            new BlueprintTriggerContext(event, node.getId(), node.getType(), node.getNodeVersion(), node.getConfig(), 42L)))
        .containsEntry("field", "status")
        .containsEntry("owner", 42L);
  }

  @Test
  void nodeResultsPreserveNullOutputs() {
    var outputs = new HashMap<String, Object>();
    outputs.put("value", null);
    var result = new BlueprintNodeResult(outputs, "then");
    assertThat(result.outputs()).containsKey("value");
    assertThat(result.outputs().get("value")).isNull();
  }
}
