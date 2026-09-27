package com.modulo.security;

import com.modulo.entity.User;
import com.modulo.repository.jpa.UserRepository;
import com.modulo.service.AuthMigrationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthenticatedUserServiceTest {
    private static final String ISSUER = "https://identity.example/realms/modulo";
    private UserRepository users;
    private AuthMigrationService provisioning;
    private AuthenticatedUserService service;

    @BeforeEach void setup() {
        users = mock(UserRepository.class);
        provisioning = mock(AuthMigrationService.class);
        // Docker-style configuration: only the Keycloak issuer property is set.
        service = new AuthenticatedUserService(users, provisioning, ISSUER, "");
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test void missingAuthenticationFailsClosed() {
        assertStatus(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(users);
    }
    @Test void anonymousAuthenticationFailsClosed() {
        SecurityContextHolder.getContext().setAuthentication(new AnonymousAuthenticationToken(
                "key", "anonymous", AuthorityUtils.createAuthorityList("ROLE_ANONYMOUS")));
        assertStatus(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(users);
    }
    @Test void unverifiedAuthenticationFailsClosed() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", "password"));
        assertStatus(HttpStatus.UNAUTHORIZED);
    }
    @Test void matchingIssuerUsesSubjectAndNeverEmailOrDisplayName() {
        loginJwt(ISSUER, "subject-a");
        when(users.findByKeycloakSubject("subject-a")).thenReturn(Optional.of(user(17)));
        assertEquals(17, service.requireUserId());
        verify(users).findByKeycloakSubject("subject-a");
        verifyNoMoreInteractions(users);
    }
    @Test void sameSubjectFromAnotherIssuerCannotClaimAccount() {
        loginJwt("https://other.example/realms/modulo", "subject-a");
        assertStatus(HttpStatus.FORBIDDEN);
        verifyNoInteractions(users, provisioning);
    }
    @Test void springIssuerIsTheFallback() {
        service = new AuthenticatedUserService(users, provisioning, "", ISSUER);
        assertEquals(ISSUER, service.trustedIssuer());
        service = new AuthenticatedUserService(users, provisioning, "https://kc.example/realms/modulo", ISSUER);
        assertEquals("https://kc.example/realms/modulo", service.trustedIssuer());
    }
    @Test void absentIssuerConfigurationDoesNotTrustAnyJwt() {
        service = new AuthenticatedUserService(users, provisioning, "", "");
        loginJwt(ISSUER, "subject-a");
        assertStatus(HttpStatus.FORBIDDEN);
        verifyNoInteractions(users, provisioning);
    }
    @Test void firstRequestFromTrustedIssuerProvisionsBySubjectNotEmail() {
        loginJwt(ISSUER, "new-subject");
        when(users.findByKeycloakSubject("new-subject")).thenReturn(Optional.empty());
        when(provisioning.provisionFromBearerToken(any())).thenReturn(user(31));
        assertEquals(31, service.requireUserId());
        verify(provisioning).provisionFromBearerToken(argThat(jwt -> "new-subject".equals(jwt.getSubject())));
        verify(users, never()).findByEmail(any());
        verify(users, never()).findByUsername(any());
    }
    @Test void oauthProvidersHaveSeparateSubjectNamespaces() {
        var principal = new DefaultOAuth2User(AuthorityUtils.createAuthorityList("ROLE_USER"),
                Map.of("sub", "same-subject", "email", "alice@example.com"), "sub");
        SecurityContextHolder.getContext().setAuthentication(
                new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google"));
        when(users.findByGoogleSubject("same-subject")).thenReturn(Optional.of(user(23)));
        assertEquals(23, service.requireUserId());
        verify(users).findByGoogleSubject("same-subject");
        verifyNoMoreInteractions(users);
    }
    @Test void arbitraryAuthenticatedNameDoesNotGrantOwnership() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "alice", "", AuthorityUtils.createAuthorityList("ROLE_USER")));
        assertStatus(HttpStatus.FORBIDDEN);
        verifyNoInteractions(users);
    }
    @Test void trustedLocalUserDetailsResolvesPersistedId() {
        var principal = org.springframework.security.core.userdetails.User.withUsername("alice")
                .password("unused").roles("USER").build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                principal, "", principal.getAuthorities()));
        when(users.findByUsername("alice")).thenReturn(Optional.of(user(42)));
        assertEquals(42, service.requireUserId());
    }
    private void loginJwt(String issuer, String subject) {
        var jwt = Jwt.withTokenValue("test").header("alg", "RS256").issuer(issuer)
                .subject(subject).claim("email", "alice@example.com")
                .claim("preferred_username", "alice").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ROLE_USER")));
    }
    private User user(long id) { User user = new User(); user.setId(id); return user; }
    private void assertStatus(HttpStatus status) {
        assertEquals(status, assertThrows(ResponseStatusException.class, service::requireUserId).getStatusCode());
    }
}
