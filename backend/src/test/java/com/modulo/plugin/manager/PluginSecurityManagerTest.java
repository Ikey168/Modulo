package com.modulo.plugin.manager;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin Security Manager Tests")
class PluginSecurityManagerTest {

    private PluginSecurityManager manager;

    @BeforeEach
    void setUp() {
        manager = new PluginSecurityManager();
    }

    @Test
    void isValidPermission() {
        assertThat(manager.isValidPermission("notes.read")).isTrue();
        assertThat(manager.isValidPermission("not.a.real.permission")).isFalse();
    }

    @Test
    void canInstallPluginWithValidPermissions() {
        assertThat(manager.canInstallPlugin("p1", List.of())).isTrue();
        assertThat(manager.canInstallPlugin("p1", List.of("notes.read", "notes.write"))).isTrue();
        assertThat(manager.canInstallPlugin("p1", List.of("notes.read", "bogus.permission"))).isFalse();
    }

    @Test
    void grantAndCheckPermissions() {
        manager.grantPermissions("p1", List.of("notes.read", "notes.write"));

        assertThat(manager.hasPermission("p1", "notes.read")).isTrue();
        assertThat(manager.hasPermission("p1", "notes.delete")).isFalse();
        assertThat(manager.getPluginPermissions("p1")).contains("notes.read", "notes.write");
    }

    @Test
    void revokePermissions() {
        manager.grantPermissions("p1", List.of("notes.read", "notes.write"));
        manager.revokePermissions("p1", List.of("notes.read"));

        assertThat(manager.hasPermission("p1", "notes.read")).isFalse();
        assertThat(manager.hasPermission("p1", "notes.write")).isTrue();
    }

    @Test
    void revokePluginAccessClearsEverything() {
        manager.grantPermissions("p1", List.of("notes.read"));
        String token = manager.generatePluginToken("p1");

        manager.revokePluginAccess("p1");

        assertThat(manager.getPluginPermissions("p1")).isEmpty();
        assertThat(manager.isValidPluginToken(token)).isFalse();
    }

    @Test
    void pluginTokenLifecycle() {
        String token = manager.generatePluginToken("p1");

        assertThat(token).isNotBlank();
        assertThat(manager.validatePluginToken(token)).isEqualTo("p1");
        assertThat(manager.isValidPluginToken(token)).isTrue();
        assertThat(manager.isValidPluginToken("bogus-token")).isFalse();
        assertThat(manager.validatePluginToken("bogus-token")).isNull();
    }

    @Test
    void getAllValidPermissions() {
        assertThat(manager.getAllValidPermissions()).contains("notes.read", "notes.write");
    }
}
