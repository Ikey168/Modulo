package com.modulo.plugin;

import com.modulo.plugin.manager.PluginStatus;
import com.modulo.plugin.registry.PluginRegistryEntry;
import com.modulo.plugin.repository.RemotePluginEntry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin Registry/Remote Entry Tests")
class PluginEntriesTest {

    @Test
    void pluginRegistryEntryAccessors() {
        PluginRegistryEntry e = new PluginRegistryEntry("name", "1.0", "INTERNAL", "JAR");
        assertThat(e.getName()).isEqualTo("name");
        assertThat(e.getVersion()).isEqualTo("1.0");
        assertThat(e.getType()).isEqualTo("INTERNAL");
        assertThat(e.getRuntime()).isEqualTo("JAR");

        LocalDateTime now = LocalDateTime.now();
        e.setId(7L);
        e.setDescription("desc");
        e.setAuthor("author");
        e.setStatus(PluginStatus.ACTIVE);
        e.setPath("/path");
        e.setEndpoint("http://endpoint");
        e.setConfig(Map.of("k", "v"));
        e.setConfigSchema(Map.of("s", "v"));
        e.setCreatedAt(now);
        e.setUpdatedAt(now);

        assertThat(e.getId()).isEqualTo(7L);
        assertThat(e.getDescription()).isEqualTo("desc");
        assertThat(e.getAuthor()).isEqualTo("author");
        assertThat(e.getStatus()).isEqualTo(PluginStatus.ACTIVE);
        assertThat(e.getPath()).isEqualTo("/path");
        assertThat(e.getEndpoint()).isEqualTo("http://endpoint");
        assertThat(e.getConfig()).containsEntry("k", "v");
        assertThat(e.getConfigSchema()).containsEntry("s", "v");
        assertThat(e.getCreatedAt()).isEqualTo(now);
        assertThat(e.getUpdatedAt()).isEqualTo(now);
    }

    @Test
    void remotePluginEntryAccessors() {
        RemotePluginEntry e = new RemotePluginEntry("id", "name", "1.0", "http://dl");
        assertThat(e.getId()).isEqualTo("id");
        assertThat(e.getName()).isEqualTo("name");
        assertThat(e.getVersion()).isEqualTo("1.0");
        assertThat(e.getDownloadUrl()).isEqualTo("http://dl");

        e.setDescription("desc");
        e.setAuthor("author");
        e.setChecksum("sha256");
        e.setFileSize(1024L);
        e.setCategory("utility");
        e.setHomepageUrl("http://home");
        e.setDocumentationUrl("http://docs");
        e.setLicenseType("MIT");
        e.setMinPlatformVersion("1.0.0");
        e.setDownloadCount(50L);
        e.setRating(4.5);
        e.setReviewCount(10);
        e.setVerified(true);
        e.setDeprecated(false);

        assertThat(e.getDescription()).isEqualTo("desc");
        assertThat(e.getAuthor()).isEqualTo("author");
        assertThat(e.getChecksum()).isEqualTo("sha256");
        assertThat(e.getFileSize()).isEqualTo(1024L);
        assertThat(e.getCategory()).isEqualTo("utility");
        assertThat(e.getHomepageUrl()).isEqualTo("http://home");
        assertThat(e.getDocumentationUrl()).isEqualTo("http://docs");
        assertThat(e.getLicenseType()).isEqualTo("MIT");
        assertThat(e.getMinPlatformVersion()).isEqualTo("1.0.0");
        assertThat(e.getDownloadCount()).isEqualTo(50L);
        assertThat(e.getRating()).isEqualTo(4.5);
        assertThat(e.getReviewCount()).isEqualTo(10);
        assertThat(e.isVerified()).isTrue();
        assertThat(e.isDeprecated()).isFalse();
    }
}
