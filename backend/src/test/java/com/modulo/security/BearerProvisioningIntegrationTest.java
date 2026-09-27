package com.modulo.security;

import com.modulo.user.User;
import com.modulo.user.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * #531: with the docker-style configuration (only {@code modulo.security.keycloak.issuer-uri}
 * set, no Spring resource-server issuer), a bearer token from that issuer resolves to a
 * user and provisions it on first use. Runs on the test profile's in-memory H2.
 */
@SpringBootTest
@TestPropertySource(properties = {
    "modulo.security.keycloak.issuer-uri=" + BearerProvisioningIntegrationTest.ISSUER,
    "spring.security.oauth2.resourceserver.jwt.issuer-uri="
})
class BearerProvisioningIntegrationTest {
    static final String ISSUER = "http://localhost:8180/realms/modulo";

    @Autowired AuthenticatedUserService service;
    @Autowired UserRepository users;

    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void firstRequestProvisionsAndLaterRequestsReuseTheAccount() {
        login(token(ISSUER, "kc-subject-1", "provision-one", "one@example.com", true));
        long first = service.requireUserId();

        User stored = users.findByKeycloakSubject("kc-subject-1").orElseThrow();
        assertThat(stored.getId()).isEqualTo(first);
        assertThat(stored.getUsername()).isEqualTo("provision-one");
        assertThat(stored.getEmail()).isEqualTo("one@example.com");
        assertThat(stored.getPrimaryAuthProvider()).isEqualTo(User.AuthProvider.KEYCLOAK);

        login(token(ISSUER, "kc-subject-1", "provision-one", "one@example.com", true));
        assertThat(service.requireUserId()).isEqualTo(first);
    }

    @Test
    void differentSubjectsGetDifferentAccounts() {
        login(token(ISSUER, "kc-subject-a", "owner-a", "a@example.com", true));
        long a = service.requireUserId();
        login(token(ISSUER, "kc-subject-b", "owner-b", "b@example.com", true));
        long b = service.requireUserId();
        assertThat(a).isNotEqualTo(b);
    }

    @Test
    void tokenFromAnotherIssuerIsRejectedAndNotProvisioned() {
        login(token("http://evil.example/realms/modulo", "kc-subject-x", "intruder", "x@example.com", true));
        assertThatThrownBy(service::requireUserId)
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThat(users.findByKeycloakSubject("kc-subject-x")).isEmpty();
    }

    @Test
    void unverifiedEmailNeverAdoptsAnExistingAccount() {
        User existing = new User();
        existing.setUsername("victim");
        existing.setEmail("victim@example.com");
        existing = users.save(existing);

        login(token(ISSUER, "kc-subject-attacker", "attacker", "victim@example.com", false));
        long resolved = service.requireUserId();

        assertThat(resolved).isNotEqualTo(existing.getId());
        User reloaded = users.findById(existing.getId()).orElseThrow();
        assertThat(reloaded.getKeycloakSubject()).isNull();
        assertThat(users.findByKeycloakSubject("kc-subject-attacker").orElseThrow().getEmail()).isNull();
    }

    private static Jwt token(String issuer, String subject, String username, String email, boolean verified) {
        return Jwt.withTokenValue("token").header("alg", "RS256").issuer(issuer).subject(subject)
            .claim("preferred_username", username).claim("email", email)
            .claim("email_verified", verified).build();
    }

    private static void login(Jwt jwt) {
        SecurityContextHolder.getContext().setAuthentication(
            new JwtAuthenticationToken(jwt, AuthorityUtils.createAuthorityList("ROLE_USER")));
    }
}
