package com.modulo.plugin.impl;

import com.modulo.plugin.api.PluginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("AI Notes Summarization Plugin Tests")
class AINotesSummarizationPluginTest {

    private AINotesSummarizationPlugin plugin;

    @BeforeEach
    void setUp() {
        plugin = new AINotesSummarizationPlugin();
    }

    @Test
    void metadata() {
        assertThat(plugin.getInfo()).isNotNull();
        assertThat(plugin.getInfo().getName()).isNotBlank();
        assertThat(plugin.getCapabilities()).contains("summarization");
        assertThat(plugin.getRequiredPermissions()).isNotEmpty();
        assertThat(plugin.getSubscribedEvents()).contains("note_created");
        assertThat(plugin.getPublishedEvents()).isNotEmpty();
    }

    @Test
    void lifecycle() throws Exception {
        // start before init fails
        assertThatThrownBy(() -> plugin.start()).isInstanceOf(PluginException.class);

        plugin.initialize(null);
        assertThat(plugin.healthCheck().isHealthy()).isFalse(); // initialized but not started

        plugin.start();
        assertThat(plugin.healthCheck().isHealthy()).isTrue();

        plugin.stop();
        assertThat(plugin.healthCheck().isHealthy()).isFalse();
    }
}
