package com.modulo.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Validates Keycloak (OIDC) bearer tokens on API requests so the front-end's
 * access tokens are trusted by the backend.
 *
 * <p>This is opt-in: the chain only activates when
 * {@code modulo.security.keycloak.jwk-set-uri} is set. The {@link JwtDecoder}
 * is built from the JWK set URI lazily (keys are fetched on first use), so the
 * application still boots when Keycloak is unreachable. It is scoped to requests
 * that carry an {@code Authorization: Bearer} header and runs at higher
 * precedence than the default session/login chain, which continues to handle
 * browser (non-bearer) requests.
 */
@Configuration
@ConditionalOnProperty(prefix = "modulo.security.keycloak", name = "jwk-set-uri")
public class ResourceServerSecurityConfig {

    @Value("${modulo.security.keycloak.jwk-set-uri}")
    private String jwkSetUri;

    @Value("${modulo.security.keycloak.issuer-uri:}")
    private String issuerUri;

    @Bean
    @Order(1)
    public SecurityFilterChain resourceServerFilterChain(HttpSecurity http) throws Exception {
        http
            .requestMatcher(bearerTokenMatcher())
            .authorizeRequests(authz -> authz.anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder())
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(csrf -> csrf.disable())
            .cors(cors -> {});
        return http.build();
    }

    /** Only handle requests that present a bearer token; everything else falls through to the session chain. */
    private RequestMatcher bearerTokenMatcher() {
        return request -> {
            String header = request.getHeader(HttpHeaders.AUTHORIZATION);
            return header != null && header.regionMatches(true, 0, "Bearer ", 0, 7);
        };
    }

    private JwtDecoder jwtDecoder() {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        if (issuerUri != null && !issuerUri.trim().isEmpty()) {
            decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuerUri));
        }
        return decoder;
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            Object realmAccess = jwt.getClaim("realm_access");
            if (!(realmAccess instanceof Map)) {
                return Collections.emptyList();
            }
            Object roles = ((Map<?, ?>) realmAccess).get("roles");
            if (!(roles instanceof List)) {
                return Collections.emptyList();
            }
            Collection<GrantedAuthority> authorities = ((List<?>) roles).stream()
                .map(Object::toString)
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
            return authorities;
        });
        return converter;
    }
}
