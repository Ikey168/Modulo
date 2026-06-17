package com.modulo.plugin.impl;

import com.modulo.plugin.api.PluginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Calendar Task Manager Plugin Tests")
class CalendarTaskManagerPluginTest {

    private CalendarTaskManagerPlugin plugin;

    @BeforeEach
    void setUp() {
        plugin = new CalendarTaskManagerPlugin();
    }

    @Test
    void metadata() {
        assertThat(plugin.getInfo()).isNotNull();
        assertThat(plugin.getInfo().getName()).isNotBlank();
        assertThat(plugin.getCapabilities()).isNotEmpty();
        assertThat(plugin.getRequiredPermissions()).isNotEmpty();
        assertThat(plugin.getSubscribedEvents()).isNotNull();
        assertThat(plugin.getPublishedEvents()).isNotNull();
    }

    @Test
    void healthCheckUnhealthyBeforeInit() {
        assertThat(plugin.healthCheck().isHealthy()).isFalse();
    }

    @Test
    void initializeFailsWithoutDependencies() {
        assertThatThrownBy(() -> plugin.initialize(new HashMap<>()))
                .isInstanceOf(PluginException.class);
    }

    @Test
    void startFailsBeforeInitialization() {
        assertThatThrownBy(() -> plugin.start())
                .isInstanceOf(PluginException.class);
    }
}
