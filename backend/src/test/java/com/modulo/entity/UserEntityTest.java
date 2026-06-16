package com.modulo.entity;

import com.modulo.entity.User.AuthProvider;
import com.modulo.entity.User.MigrationStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("User Entity Tests")
class UserEntityTest {

    @Test
    @DisplayName("scalar getters/setters round-trip")
    void scalarFields() {
        User u = new User();
        LocalDateTime now = LocalDateTime.now();

        u.setId(1L);
        u.setUsername("user");
        u.setEmail("user@example.com");
        u.setWalletAddress("0xabc");
        u.setFirstName("First");
        u.setLastName("Last");
        u.setCreatedAt(now);
        u.setUpdatedAt(now);
        u.setLastLoginAt(now);
        u.setPrimaryAuthProvider(AuthProvider.GOOGLE);
        u.setGoogleSubject("g-sub");
        u.setAzureSubject("a-sub");
        u.setKeycloakSubject("k-sub");
        u.setLegacyOAuthEmail("legacy@example.com");
        u.setMigrationStatus(MigrationStatus.MIGRATED);
        u.setMigrationDate(now);
        u.setLastOAuthProvider(AuthProvider.KEYCLOAK);

        assertThat(u.getId()).isEqualTo(1L);
        assertThat(u.getUsername()).isEqualTo("user");
        assertThat(u.getEmail()).isEqualTo("user@example.com");
        assertThat(u.getWalletAddress()).isEqualTo("0xabc");
        assertThat(u.getFirstName()).isEqualTo("First");
        assertThat(u.getLastName()).isEqualTo("Last");
        assertThat(u.getCreatedAt()).isEqualTo(now);
        assertThat(u.getUpdatedAt()).isEqualTo(now);
        assertThat(u.getLastLoginAt()).isEqualTo(now);
        assertThat(u.getPrimaryAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(u.getGoogleSubject()).isEqualTo("g-sub");
        assertThat(u.getAzureSubject()).isEqualTo("a-sub");
        assertThat(u.getKeycloakSubject()).isEqualTo("k-sub");
        assertThat(u.getLegacyOAuthEmail()).isEqualTo("legacy@example.com");
        assertThat(u.getMigrationStatus()).isEqualTo(MigrationStatus.MIGRATED);
        assertThat(u.getMigrationDate()).isEqualTo(now);
        assertThat(u.getLastOAuthProvider()).isEqualTo(AuthProvider.KEYCLOAK);
    }

    @Test
    @DisplayName("custom attributes and preferences maps round-trip")
    void mapFields() {
        User u = new User();
        Map<String, String> attrs = new HashMap<>();
        attrs.put("k", "v");
        u.setCustomAttributes(attrs);
        Map<String, String> prefs = new HashMap<>();
        prefs.put("lang", "en");
        u.setPreferences(prefs);

        assertThat(u.getCustomAttributes()).containsEntry("k", "v");
        assertThat(u.getPreferences()).containsEntry("lang", "en");
    }

    @Test
    @DisplayName("auth provider set add/contains")
    void authProviders() {
        User u = new User();
        assertThat(u.hasAuthProvider(AuthProvider.GOOGLE)).isFalse();

        u.addAuthProvider(AuthProvider.GOOGLE);
        u.addAuthProvider(AuthProvider.KEYCLOAK);

        assertThat(u.hasAuthProvider(AuthProvider.GOOGLE)).isTrue();
        assertThat(u.hasAuthProvider(AuthProvider.KEYCLOAK)).isTrue();
        assertThat(u.hasAuthProvider(AuthProvider.AZURE)).isFalse();

        u.setAuthProviders(Set.of(AuthProvider.AZURE));
        assertThat(u.getAuthProviders()).containsExactly(AuthProvider.AZURE);
    }

    @Test
    @DisplayName("subject-for-provider maps to the right field per provider")
    void subjectForProvider() {
        User u = new User();

        u.setSubjectForProvider(AuthProvider.GOOGLE, "g");
        u.setSubjectForProvider(AuthProvider.AZURE, "a");
        u.setSubjectForProvider(AuthProvider.KEYCLOAK, "k");

        assertThat(u.getGoogleSubject()).isEqualTo("g");
        assertThat(u.getAzureSubject()).isEqualTo("a");
        assertThat(u.getKeycloakSubject()).isEqualTo("k");

        assertThat(u.getSubjectForProvider(AuthProvider.GOOGLE)).isEqualTo("g");
        assertThat(u.getSubjectForProvider(AuthProvider.AZURE)).isEqualTo("a");
        assertThat(u.getSubjectForProvider(AuthProvider.KEYCLOAK)).isEqualTo("k");
        assertThat(u.getSubjectForProvider(AuthProvider.METAMASK)).isNull();
    }

    @Test
    @DisplayName("auth provider and migration-status enums expose values")
    void enums() {
        assertThat(AuthProvider.values()).contains(AuthProvider.GOOGLE, AuthProvider.KEYCLOAK);
        assertThat(MigrationStatus.valueOf("MIGRATED")).isEqualTo(MigrationStatus.MIGRATED);
    }
}
