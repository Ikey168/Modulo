package com.modulo.plugin.manager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@DisplayName("Remote Plugin Loader Tests")
class RemotePluginLoaderTest {

    @Test
    void getCacheDirectoryReturnsPath() {
        RemotePluginLoader loader = new RemotePluginLoader();
        assertThat(loader.getCacheDirectory()).isNotBlank();
    }

    @Test
    void clearCacheDoesNotThrow() {
        RemotePluginLoader loader = new RemotePluginLoader();
        assertThatCode(loader::clearCache).doesNotThrowAnyException();
    }
}
