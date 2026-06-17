package com.modulo.plugin.manager;

import com.modulo.plugin.api.Plugin;
import com.modulo.plugin.api.PluginException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Plugin Manager Tests")
class PluginManagerTest {

    @InjectMocks
    private PluginManager pluginManager;

    @Mock
    private com.modulo.plugin.registry.PluginRegistry pluginRegistry;
    @Mock
    private com.modulo.plugin.event.PluginEventBus eventBus;
    @Mock
    private PluginLoader pluginLoader;
    @Mock
    private PluginSecurityManager securityManager;

    @BeforeEach
    void setUp() {
        // no-op
    }

    @Test
    void unknownPluginStatusIsUnknown() {
        assertThat(pluginManager.getPluginStatus("nope")).isEqualTo(PluginStatus.UNKNOWN);
    }

    @Test
    void noActivePluginsInitially() {
        assertThat(pluginManager.getActivePlugins()).isEmpty();
        assertThat(pluginManager.getAllPluginStatuses()).isEmpty();
    }

    @Test
    void getUnknownPluginReturnsNull() {
        assertThat(pluginManager.getPlugin("nope")).isNull();
    }

    @Test
    void startUnknownPluginThrows() {
        assertThatThrownBy(() -> pluginManager.startPlugin("nope"))
                .isInstanceOf(PluginException.class);
    }

    @Test
    void stopUnknownPluginThrows() {
        assertThatThrownBy(() -> pluginManager.stopPlugin("nope"))
                .isInstanceOf(PluginException.class);
    }

    @Test
    void uninstallUnknownPluginThrows() {
        assertThatThrownBy(() -> pluginManager.uninstallPlugin("nope"))
                .isInstanceOf(PluginException.class);
    }

    @Test
    void checkHealthOfUnknownPluginReturnsResult() {
        assertThat(pluginManager.checkPluginHealth("nope")).isNotNull();
    }
}
