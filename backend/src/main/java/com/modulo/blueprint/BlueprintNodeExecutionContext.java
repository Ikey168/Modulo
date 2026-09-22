package com.modulo.blueprint;

import com.modulo.blueprint.execution.WorkflowRunService;
import com.modulo.blueprint.interpreter.BlueprintIRGraph;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bounded context passed to a plugin blueprint node handler.
 *
 * <p>The context exposes the node's immutable graph data, resolved inputs and
 * workflow identity. It deliberately does not expose the interpreter or its
 * mutable pin store.
 */
public final class BlueprintNodeExecutionContext {
  private final BlueprintIRGraph.IRNode node;
  private final Map<String, Object> inputs;
  private final long blueprintId;
  private final long ownerId;
  private final WorkflowRunService.Lease lease;

  public BlueprintNodeExecutionContext(
      BlueprintIRGraph.IRNode node,
      Map<String, Object> inputs,
      long blueprintId,
      long ownerId,
      WorkflowRunService.Lease lease) {
    this.node = copyNode(node);
    this.inputs = inputs == null
        ? Map.of()
        : Collections.unmodifiableMap(new LinkedHashMap<>(inputs));
    this.blueprintId = blueprintId;
    this.ownerId = ownerId;
    this.lease = lease;
  }

  public BlueprintIRGraph.IRNode node() {
    return node;
  }

  public Map<String, Object> inputs() {
    return inputs;
  }

  public Object input(String pin) {
    return inputs.get(pin);
  }

  public Map<String, Object> config() {
    return node == null || node.getConfig() == null
        ? Map.of()
        : BlueprintContextCopies.map(node.getConfig());
  }

  public long blueprintId() {
    return blueprintId;
  }

  public long ownerId() {
    return ownerId;
  }

  /** Workflow lease for host services that need to bind work to this run. */
  public WorkflowRunService.Lease lease() {
    return lease;
  }

  private static BlueprintIRGraph.IRNode copyNode(BlueprintIRGraph.IRNode source) {
    if (source == null) return null;
    var copy = new BlueprintIRGraph.IRNode();
    copy.setId(source.getId());
    copy.setType(source.getType());
    copy.setNodeVersion(source.getNodeVersion());
    copy.setConfig(source.getConfig() == null ? null : BlueprintContextCopies.map(source.getConfig()));
    return copy;
  }
}
