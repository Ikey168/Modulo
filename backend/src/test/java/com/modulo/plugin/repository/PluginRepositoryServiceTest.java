package com.modulo.plugin.repository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Plugin Repository Service Tests")
class PluginRepositoryServiceTest {

    private PluginRepositoryService service;

    @BeforeEach
    void setUp() {
        service = new PluginRepositoryService();
    }

    @Test
    void startsWithDefaultRepositories() {
        assertThat(service.getConfiguredRepositories()).isNotEmpty();
    }

    @Test
    void addRepositoryAddsNewUrl() {
        int before = service.getConfiguredRepositories().size();
        service.addRepository("https://example.com/plugins");

        assertThat(service.getConfiguredRepositories())
                .contains("https://example.com/plugins")
                .hasSize(before + 1);
    }

    @Test
    void addRepositoryIsIdempotent() {
        service.addRepository("https://dup.com/plugins");
        int size = service.getConfiguredRepositories().size();
        service.addRepository("https://dup.com/plugins");

        assertThat(service.getConfiguredRepositories()).hasSize(size);
    }

    @Test
    void removeRepository() {
        service.addRepository("https://remove.com/plugins");
        service.removeRepository("https://remove.com/plugins");

        assertThat(service.getConfiguredRepositories()).doesNotContain("https://remove.com/plugins");
    }
}
