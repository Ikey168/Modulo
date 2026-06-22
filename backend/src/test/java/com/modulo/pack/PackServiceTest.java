package com.modulo.pack;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.modulo.blueprint.BlueprintCapabilityService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("PackService")
class PackServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock ObjectMapper objectMapper;
    @Mock BlueprintCapabilityService capabilityService;

    @InjectMocks PackService service;

    private PackManifest minimalManifest() {
        PackManifest m = new PackManifest();
        m.setId("test.pack");
        m.setName("Test Pack");
        m.setVersion("1.0.0");
        return m;
    }

    @BeforeEach
    void setUp() throws Exception {
        // No packs loaded on startup (empty result set)
        doAnswer(inv -> null).when(jdbc).query(anyString(), any(RowCallbackHandler.class), any(), any());
        service.loadInstalledPacks();

        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(jdbc.queryForObject(contains("RETURNING id"), eq(Long.class), any(), any(), any(), any(), any(), any(), any(), any(), any()))
            .thenReturn(1L);
    }

    // ---- validateManifest ----

    @Test
    void install_missingId_fails() {
        PackManifest m = minimalManifest();
        m.setId(null);
        assertThat(service.install(m).ok()).isFalse();
    }

    @Test
    void install_missingName_fails() {
        PackManifest m = minimalManifest();
        m.setName(null);
        assertThat(service.install(m).ok()).isFalse();
    }

    @Test
    void install_invalidVersion_fails() {
        PackManifest m = minimalManifest();
        m.setVersion("not-semver");
        assertThat(service.install(m).ok()).isFalse();
    }

    @Test
    void install_invalidMinCatalogVersion_fails() {
        PackManifest m = minimalManifest();
        m.setMinCatalogVersion("bad");
        assertThat(service.install(m).ok()).isFalse();
    }

    // ---- checkCompatibility ----

    @Test
    void install_irVersionTooHigh_fails() {
        PackManifest m = minimalManifest();
        m.setMinIrVersion(999);
        assertThat(service.install(m).ok()).isFalse();
    }

    // ---- checkDependencies ----

    @Test
    void install_missingDependency_fails() {
        PackManifest m = minimalManifest();
        PackManifest.PackDependency dep = new PackManifest.PackDependency();
        dep.setId("other.pack");
        dep.setMinVersion("1.0.0");
        m.setDependencies(List.of(dep));

        assertThat(service.install(m).ok()).isFalse();
        assertThat(service.install(m).reason()).contains("Missing dependency");
    }

    // ---- uninstall ----

    @Test
    void uninstall_notInstalled_fails() {
        PackService.PackCheck result = service.uninstall("nonexistent");
        assertThat(result.ok()).isFalse();
        assertThat(result.reason()).contains("not installed");
    }

    // ---- PackCheck record ----

    @Test
    void packCheck_ok_returnsTrue() {
        PackService.PackCheck ok = PackService.PackCheck.pass();
        assertThat(ok.ok()).isTrue();
        assertThat(ok.reason()).isNull();
    }

    @Test
    void packCheck_fail_returnsFalseWithReason() {
        PackService.PackCheck fail = PackService.PackCheck.fail("test reason");
        assertThat(fail.ok()).isFalse();
        assertThat(fail.reason()).isEqualTo("test reason");
    }
}
