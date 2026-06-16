package com.modulo.plugin.sample;

import com.modulo.plugin.api.HealthCheck;
import com.modulo.plugin.api.PluginException;
import com.modulo.plugin.api.PluginInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Sample Logging Plugin Tests")
class SampleLoggingPluginTest {

    private SampleLoggingPlugin plugin;

    @BeforeEach
    void setUp() {
        plugin = new SampleLoggingPlugin();
    }

    @Test
    void getInfo() {
        PluginInfo info = plugin.getInfo();
        assertThat(info.getName()).isEqualTo("sample-logging-plugin");
        assertThat(info.getVersion()).isEqualTo("1.0.0");
        assertThat(info.getAuthor()).isEqualTo("Modulo Team");
    }

    @Test
    void metadataLists() {
        assertThat(plugin.getCapabilities()).contains("event.logging");
        assertThat(plugin.getRequiredPermissions()).contains("notes.read");
        assertThat(plugin.getSubscribedEvents()).contains("note.created", "note.updated", "note.deleted");
        assertThat(plugin.getPublishedEvents()).contains("statistics.updated");
    }

    @Test
    void initializeAcceptsValidConfig() throws Exception {
        Map<String, Object> config = new HashMap<>();
        config.put("log_level", "INFO");

        plugin.initialize(config);
        // initialized -> start should now succeed
        plugin.start();

        assertThat(plugin.healthCheck().isHealthy()).isTrue();
    }

    @Test
    void initializeRejectsInvalidLogLevel() {
        Map<String, Object> config = new HashMap<>();
        config.put("log_level", "VERBOSE");

        assertThatThrownBy(() -> plugin.initialize(config))
                .isInstanceOf(PluginException.class);
    }

    @Test
    void startRequiresInitialization() {
        assertThatThrownBy(() -> plugin.start())
                .isInstanceOf(PluginException.class);
    }

    @Test
    void healthCheckReflectsLifecycle() throws Exception {
        assertThat(plugin.healthCheck().isHealthy()).isFalse(); // not initialized

        plugin.initialize(null);
        assertThat(plugin.healthCheck().isHealthy()).isFalse(); // initialized but not running

        plugin.start();
        HealthCheck running = plugin.healthCheck();
        assertThat(running.isHealthy()).isTrue();

        plugin.stop();
        assertThat(plugin.healthCheck().isHealthy()).isFalse();
    }

    @Test
    void statisticsStartAtZero() throws Exception {
        plugin.initialize(null);
        plugin.start();

        Map<String, Integer> stats = plugin.getStatistics();
        assertThat(stats).containsEntry("created", 0)
                .containsEntry("updated", 0)
                .containsEntry("deleted", 0)
                .containsEntry("total", 0);
    }
}
