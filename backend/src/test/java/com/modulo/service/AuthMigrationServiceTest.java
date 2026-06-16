package com.modulo.service;

import com.modulo.entity.User;
import com.modulo.entity.User.AuthProvider;
import com.modulo.entity.User.MigrationStatus;
import com.modulo.repository.jpa.UserRepository;
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
}
