package com.modulo.plugin.api;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin API Value Object Tests")
class PluginApiValueTest {

    @Test
    void healthCheckFactories() {
        HealthCheck healthy = HealthCheck.healthy("all good");
        assertThat(healthy.isHealthy()).isTrue();
        assertThat(healthy.getStatus()).isEqualTo(HealthCheck.Status.HEALTHY);
        assertThat(healthy.getMessage()).isEqualTo("all good");
        assertThat(healthy.getTimestamp()).isNotNull();

        HealthCheck unhealthy = HealthCheck.unhealthy("broken");
        assertThat(unhealthy.isHealthy()).isFalse();
        assertThat(unhealthy.getStatus()).isEqualTo(HealthCheck.Status.UNHEALTHY);

        HealthCheck degraded = HealthCheck.degraded("slow");
        assertThat(degraded.getStatus()).isEqualTo(HealthCheck.Status.DEGRADED);

        HealthCheck unknown = HealthCheck.unknown("dunno");
        assertThat(unknown.getStatus()).isEqualTo(HealthCheck.Status.UNKNOWN);
    }

    @Test
    void healthCheckConstructor() {
        HealthCheck hc = new HealthCheck(HealthCheck.Status.HEALTHY, "ok", 42L);
        assertThat(hc.getMessage()).isEqualTo("ok");
        assertThat(hc.isHealthy()).isTrue();
    }

    @Test
    void pluginInfoAccessors() {
        PluginInfo info = new PluginInfo("my-plugin", "1.0.0", "desc", "author",
                PluginType.INTERNAL, PluginRuntime.JAR);

        assertThat(info.getName()).isEqualTo("my-plugin");
        assertThat(info.getVersion()).isEqualTo("1.0.0");
        assertThat(info.getDescription()).isEqualTo("desc");
        assertThat(info.getAuthor()).isEqualTo("author");
        assertThat(info.getType()).isEqualTo(PluginType.INTERNAL);
        assertThat(info.getRuntime()).isEqualTo(PluginRuntime.JAR);
        assertThat(info.getCreatedAt()).isNotNull();
    }
}
