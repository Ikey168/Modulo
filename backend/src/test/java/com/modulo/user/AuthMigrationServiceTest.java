package com.modulo.user;

import com.modulo.user.User.AuthProvider;
import com.modulo.user.User.MigrationStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("Auth Migration Service Tests")
class AuthMigrationServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private OAuth2User oauth2User;

    @InjectMocks
    private AuthMigrationService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "dualAuthEnabled", false);
        ReflectionTestUtils.setField(service, "defaultProvider", "KEYCLOAK");
        ReflectionTestUtils.setField(service, "migrationGracePeriodDays", 30);

        when(oauth2User.getAttribute("email")).thenReturn("user@example.com");
        when(oauth2User.getAttribute("sub")).thenReturn("subject-123");
        when(oauth2User.getAttribute("name")).thenReturn("Jane Doe");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("creates a new user when none exists")
    void createsNewUser() {
        when(userRepository.findByGoogleSubject("subject-123")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.empty());

        User result = service.processAuthentication(oauth2User, AuthProvider.GOOGLE);

        assertThat(result.getEmail()).isEqualTo("user@example.com");
        assertThat(result.getFirstName()).isEqualTo("Jane");
        assertThat(result.getLastName()).isEqualTo("Doe");
        assertThat(result.getPrimaryAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(result.getMigrationStatus()).isEqualTo(MigrationStatus.MIGRATED);
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("returns existing user found by provider subject")
    void findsUserBySubject() {
        User existing = new User();
        existing.setEmail("user@example.com");
        when(userRepository.findByGoogleSubject("subject-123")).thenReturn(Optional.of(existing));

        User result = service.processAuthentication(oauth2User, AuthProvider.GOOGLE);

        assertThat(result).isSameAs(existing);
        assertThat(result.getLastLoginAt()).isNotNull();
        assertThat(result.getLastOAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    @DisplayName("direct-migrates an existing user matched by email")
    void directMigratesByEmail() {
        User existing = new User();
        existing.setEmail("user@example.com");
        existing.setPrimaryAuthProvider(AuthProvider.KEYCLOAK);
        when(userRepository.findByGoogleSubject("subject-123")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(existing));

        User result = service.processAuthentication(oauth2User, AuthProvider.GOOGLE);

        assertThat(result.getMigrationStatus()).isEqualTo(MigrationStatus.MIGRATED);
        assertThat(result.getPrimaryAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(result.hasAuthProvider(AuthProvider.GOOGLE)).isTrue();
    }

    @Test
    @DisplayName("getDefaultAuthProvider parses the configured value")
    void getDefaultAuthProvider() {
        assertThat(service.getDefaultAuthProvider()).isEqualTo(AuthProvider.KEYCLOAK);

        ReflectionTestUtils.setField(service, "defaultProvider", "not-a-provider");
        assertThat(service.getDefaultAuthProvider()).isEqualTo(AuthProvider.KEYCLOAK);

        ReflectionTestUtils.setField(service, "defaultProvider", "google");
        assertThat(service.getDefaultAuthProvider()).isEqualTo(AuthProvider.GOOGLE);
    }

    @Test
    @DisplayName("isDualAuthEnabled reflects configuration")
    void isDualAuthEnabled() {
        assertThat(service.isDualAuthEnabled()).isFalse();
        ReflectionTestUtils.setField(service, "dualAuthEnabled", true);
        assertThat(service.isDualAuthEnabled()).isTrue();
    }

    @Test
    @DisplayName("review/dual-auth queries delegate to the repository")
    void migrationStatusQueries() {
        User u = new User();
        when(userRepository.findByMigrationStatus(MigrationStatus.MANUAL_REVIEW)).thenReturn(List.of(u));
        when(userRepository.findByMigrationStatus(MigrationStatus.DUAL_AUTH)).thenReturn(List.of(u));

        assertThat(service.getUsersRequiringManualReview()).containsExactly(u);
        assertThat(service.getUsersInDualAuth()).containsExactly(u);
    }

    private static org.springframework.security.oauth2.jwt.Jwt bearer(String subject, String username, String email, boolean verified) {
        return org.springframework.security.oauth2.jwt.Jwt.withTokenValue("t").header("alg", "RS256")
                .issuer("http://localhost:8180/realms/modulo").subject(subject)
                .claim("preferred_username", username).claim("email", email)
                .claim("email_verified", verified).claim("name", "Jane Doe").build();
    }

    @Test
    @DisplayName("bearer provisioning creates a Keycloak user named by preferred_username")
    void bearerProvisioningCreatesUser() {
        when(userRepository.findByKeycloakSubject("kc-1")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.empty());
        when(userRepository.existsByUsername("jane")).thenReturn(false);

        User result = service.provisionFromBearerToken(bearer("kc-1", "jane", "jane@example.com", true));

        assertThat(result.getUsername()).isEqualTo("jane");
        assertThat(result.getEmail()).isEqualTo("jane@example.com");
        assertThat(result.getKeycloakSubject()).isEqualTo("kc-1");
        assertThat(result.getPrimaryAuthProvider()).isEqualTo(AuthProvider.KEYCLOAK);
        assertThat(result.getFirstName()).isEqualTo("Jane");
    }

    @Test
    @DisplayName("bearer provisioning never links an existing account by an unverified email")
    void bearerProvisioningIgnoresUnverifiedEmail() {
        User existing = new User();
        existing.setId(5L);
        existing.setEmail("jane@example.com");
        when(userRepository.findByKeycloakSubject("kc-2")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(existing));
        when(userRepository.existsByUsername("jane")).thenReturn(true);

        User result = service.provisionFromBearerToken(bearer("kc-2", "jane", "jane@example.com", false));

        assertThat(result).isNotSameAs(existing);
        assertThat(result.getEmail()).isNull();
        assertThat(result.getUsername()).isEqualTo("keycloak:kc-2");
        assertThat(existing.getKeycloakSubject()).isNull();
    }

    @Test
    @DisplayName("bearer provisioning links a verified email through the migration rules")
    void bearerProvisioningLinksVerifiedEmail() {
        User existing = new User();
        existing.setId(6L);
        existing.setEmail("jane@example.com");
        existing.setPrimaryAuthProvider(AuthProvider.GOOGLE);
        existing.addAuthProvider(AuthProvider.GOOGLE);
        when(userRepository.findByKeycloakSubject("kc-3")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(existing));
        ReflectionTestUtils.setField(service, "dualAuthEnabled", true);

        User result = service.provisionFromBearerToken(bearer("kc-3", "jane", "jane@example.com", true));

        assertThat(result).isSameAs(existing);
        assertThat(result.getKeycloakSubject()).isEqualTo("kc-3");
        assertThat(result.hasAuthProvider(AuthProvider.GOOGLE)).isTrue();
        assertThat(result.getMigrationStatus()).isEqualTo(MigrationStatus.DUAL_AUTH);
    }
}
