package com.modulo.blueprint;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class BlueprintAutonomyLevelTest {
  @Test
  void legacyBlueprintsDefaultToSupervised() {
    assertThat(BlueprintAutonomyLevel.fromIr(Map.of("metadata", Map.of())))
        .isEqualTo(BlueprintAutonomyLevel.SUPERVISED);
  }

  @Test
  void readsExplicitLevel() {
    assertThat(BlueprintAutonomyLevel.fromIr(
            Map.of("metadata", Map.of("autonomyLevel", "MANUAL"))))
        .isEqualTo(BlueprintAutonomyLevel.MANUAL);
  }

  @Test
  void rejectsUnknownLevel() {
    assertThatThrownBy(() -> BlueprintAutonomyLevel.fromIr(
            Map.of("metadata", Map.of("autonomyLevel", "UNBOUNDED"))))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
