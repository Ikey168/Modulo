package com.modulo.integrations.praxis;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Which process controls to offer. A control is shown disabled, with a reason, when the
 * executor does not declare the feature Praxis needs for it (e.g. cancellation on the
 * Claude and DeepSeek adapters) or when the process state does not allow it, so the UI
 * never offers an operation that is bound to fail.
 */
public final class PraxisControls {
  static final Set<String> ACTIVE = Set.of("pending", "running", "suspended");
  static final Set<String> TERMINAL = Set.of("completed", "failed", "cancelled");

  private PraxisControls() {}

  public static Map<String, Map<String, Object>> of(String executor, String state,
      Map<String, List<String>> executorFeatures) {
    List<String> features = executorFeatures.get(executor);
    Map<String, Map<String, Object>> controls = new LinkedHashMap<>();
    controls.put("cancel", control(features, "cancel", ACTIVE.contains(state)));
    controls.put("suspend", control(features, "suspend", "running".equals(state)));
    controls.put("resume", control(features, "suspend", "suspended".equals(state)));
    controls.put("signal", control(features, "signal", "running".equals(state)));
    // Retry is a kernel operation for failed processes; it needs no executor feature.
    controls.put("retry", entry(true, "failed".equals(state), "failed".equals(state) ? null : "process_not_failed"));
    return controls;
  }

  private static Map<String, Object> control(List<String> features, String feature, boolean stateAllows) {
    if (features == null) return entry(false, false, "executor_features_unknown");
    if (!features.contains(feature)) return entry(false, false, "executor_unsupported");
    return entry(true, stateAllows, stateAllows ? null : "process_state");
  }

  private static Map<String, Object> entry(boolean supported, boolean available, String reason) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("supported", supported);
    entry.put("available", supported && available);
    entry.put("reason", reason);
    return entry;
  }
}
