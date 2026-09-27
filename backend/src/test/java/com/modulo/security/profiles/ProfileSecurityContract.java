package com.modulo.security.profiles;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * #533: boots the whole application under one deployed profile and sends real HTTP
 * requests through MockMvc and the security filter chain with RS256-signed tokens.
 *
 * <p>The only test-specific wiring is the token key: the test generates an RSA key pair
 * and replaces the {@link JwtDecoder} with one that trusts that public key and checks
 * the issuer. Everything after signature verification (the filter chain, role mapping,
 * method security, issuer trust, just-in-time provisioning, owner scoping) is the
 * production code. Persistence runs on in-memory H2 so the test needs no Docker; see
 * each subclass for the datasource override.</p>
 *
 * <p>One subclass per profile: surefire runs each test class in its own JVM, and every
 * application context binds the gRPC port.</p>
 */
abstract class ProfileSecurityContract {

    static final String ISSUER = "http://localhost:8180/realms/modulo";
    private static final KeyPair KEYS = generateKeys();

    /** Properties every profile test needs: the trusted issuer. */
    static final String TRUSTED_ISSUER = "modulo.security.keycloak.issuer-uri=" + ISSUER;

    @Autowired MockMvc mvc;
    @Autowired Environment environment;

    /** The profiles this subclass boots; empty for the default profile. */
    abstract List<String> expectedProfiles();

    @TestConfiguration
    static class TestKeys {
        @Bean
        @Primary
        JwtDecoder testJwtDecoder() {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEYS.getPublic()).build();
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
            return decoder;
        }
    }

    @Test
    void bootsTheExpectedProfile() {
        assertThat(environment.getActiveProfiles()).containsExactlyInAnyOrderElementsOf(expectedProfiles());
    }

    @Test
    void anonymousRequestToNotesIs401() throws Exception {
        mvc.perform(get("/api/notes")).andExpect(status().isUnauthorized());
    }

    @Test
    void tokenFromAnotherIssuerIs401() throws Exception {
        String foreign = token("http://evil.example/realms/modulo", "evil-" + UUID.randomUUID(), List.of("admin"));
        mvc.perform(get("/api/notes").header("Authorization", "Bearer " + foreign))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenWithBrokenSignatureIs401() throws Exception {
        String valid = userToken("tampered");
        String payloadTampered = valid.substring(0, valid.indexOf('.') + 1) + "e30" + valid.substring(valid.lastIndexOf('.'));
        mvc.perform(get("/api/notes").header("Authorization", "Bearer " + payloadTampered))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void bearerUserReachesOwnNotesAndNotOthers() throws Exception {
        String owner = userToken("owner");
        String other = userToken("other");

        MvcResult created = mvc.perform(post("/api/notes").header("Authorization", "Bearer " + owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Profile test note\",\"content\":\"private\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        Number id = com.jayway.jsonpath.JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mvc.perform(get("/api/notes/" + id).header("Authorization", "Bearer " + owner))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Profile test note"));
        mvc.perform(get("/api/notes").header("Authorization", "Bearer " + owner))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id").value(org.hamcrest.Matchers.hasItem(id.intValue())));

        mvc.perform(get("/api/notes/" + id).header("Authorization", "Bearer " + other))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/notes").header("Authorization", "Bearer " + other))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem(id.intValue()))));
    }

    @Test
    void nonAdminGets403OnAdminEndpoint() throws Exception {
        mvc.perform(get("/chaos/config").header("Authorization", "Bearer " + userToken("user")))
            .andExpect(status().isForbidden());
    }

    @Test
    void adminReachesAdminEndpoint() throws Exception {
        String admin = token(ISSUER, "admin-" + UUID.randomUUID(), List.of("admin"));
        mvc.perform(get("/chaos/config").header("Authorization", "Bearer " + admin))
            .andExpect(status().is2xxSuccessful());
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/api/health")).andExpect(status().isOk());
    }

    private static String userToken(String name) {
        return token(ISSUER, name + "-" + UUID.randomUUID(), List.of("viewer"));
    }

    static String token(String issuer, String subject, List<String> realmRoles) {
        try {
            Instant now = Instant.now();
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(issuer)
                .subject(subject)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(300)))
                .claim("preferred_username", subject)
                .claim("email", subject + "@example.com")
                .claim("email_verified", true)
                .claim("realm_access", Map.of("roles", realmRoles))
                .build();
            SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.RS256), claims);
            jwt.sign(new RSASSASigner(KEYS.getPrivate()));
            return jwt.serialize();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static KeyPair generateKeys() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
