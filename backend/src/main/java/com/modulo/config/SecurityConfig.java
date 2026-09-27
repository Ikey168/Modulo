package com.modulo.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.SupplierJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.access.BearerTokenAccessDeniedHandler;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The backend's only Spring Security configuration.
 *
 * <p>Every client (web, Electron, Android) signs in with Keycloak through OIDC
 * authorization code + PKCE in the browser/app and calls the API with
 * {@code Authorization: Bearer <access token>}. The backend is therefore a stateless
 * OAuth2 resource server: one filter chain, no HTTP session, no login pages. It behaves
 * the same in every profile; environment differences are properties:</p>
 * <ul>
 *   <li>{@code modulo.security.keycloak.jwk-set-uri}: where to fetch signing keys
 *       (an address reachable from the backend);</li>
 *   <li>{@code modulo.security.keycloak.issuer-uri}: the {@code iss} tokens must carry,
 *       falling back to {@code spring.security.oauth2.resourceserver.jwt.issuer-uri}.</li>
 * </ul>
 * <p>With neither a JWK set nor an issuer configured, every bearer token is rejected
 * (fail closed) and only the public routes answer.</p>
 *
 * <p>Method security ({@code @PreAuthorize}) is enabled here for every profile.</p>
 */
@Configuration
@EnableWebSecurity
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class SecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(SecurityConfig.class);

    /** Routes that answer without a token. Everything else needs a valid bearer token. */
    static final String[] PUBLIC_ROUTES = {
        // Liveness/readiness and actuator. Restrict actuator at the network level
        // (it runs on the separate management port in every shipped profile).
        "/api/health", "/api/health/**", "/api/simple-health", "/api/simple-health/**",
        "/actuator/**", "/api/actuator/**",
        // STOMP authenticates CONNECT itself (OwnedSocketInterceptor).
        "/ws", "/ws/**",
        // Public share links validate their stored grant; plugin-state callbacks carry
        // their own signed token; /api/public holds the Gmail OAuth callback.
        "/api/s/**", "/api/plugin-state/callback/**", "/api/public/**",
        // API documentation.
        "/api-docs", "/api-docs/**", "/swagger-ui", "/swagger-ui/**", "/swagger-ui.html",
        "/error"
    };

    private static RequestMatcher[] publicRoutes() {
        RequestMatcher[] matchers = new RequestMatcher[PUBLIC_ROUTES.length];
        for (int i = 0; i < PUBLIC_ROUTES.length; i++) {
            matchers[i] = AntPathRequestMatcher.antMatcher(PUBLIC_ROUTES[i]);
        }
        return matchers;
    }

    @Value("${modulo.security.keycloak.jwk-set-uri:}")
    private String jwkSetUri;

    @Value("${modulo.security.keycloak.issuer-uri:}")
    private String keycloakIssuerUri;

    @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri:}")
    private String springIssuerUri;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        http
            .authorizeRequests(authz -> authz
                .requestMatchers(publicRoutes()).permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .decoder(jwtDecoder)
                    .jwtAuthenticationConverter(jwtAuthenticationConverter())))
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // CSRF protection is off on purpose. It defends against a browser attaching
            // ambient credentials (cookies) to a forged cross-site request. This chain
            // keeps no session and reads credentials only from the Authorization header,
            // which a browser never adds on its own, so there is nothing to forge. If a
            // cookie-based login is ever added, it needs its own chain with CSRF enabled.
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .headers(headers -> headers
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)))
            .exceptionHandling(ex -> ex
                // 401 with WWW-Authenticate: Bearer for missing or invalid tokens
                // (never a redirect to a login page); 403 for insufficient roles.
                .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint())
                .accessDeniedHandler(new BearerTokenAccessDeniedHandler()));
        return http.build();
    }

    /**
     * Validates Keycloak access tokens. Keys are fetched lazily, so the application
     * starts when Keycloak is unreachable.
     */
    @Bean
    public JwtDecoder jwtDecoder() {
        String issuer = trustedIssuer();
        if (!jwkSetUri.isBlank()) {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri.trim()).build();
            if (!issuer.isBlank()) {
                decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(issuer));
            }
            return decoder;
        }
        if (!issuer.isBlank()) {
            // Discover the JWK set from the issuer on first use.
            return new SupplierJwtDecoder(() -> JwtDecoders.fromIssuerLocation(issuer));
        }
        logger.warn("No modulo.security.keycloak.jwk-set-uri or issuer configured: all bearer tokens are rejected");
        return token -> {
            throw new BadJwtException("No trusted token issuer is configured");
        };
    }

    private String trustedIssuer() {
        if (keycloakIssuerUri != null && !keycloakIssuerUri.isBlank()) {
            return keycloakIssuerUri.trim();
        }
        return springIssuerUri == null ? "" : springIssuerUri.trim();
    }

    /**
     * Maps Keycloak realm roles to authorities. Realm roles are lower case ("admin");
     * {@code @PreAuthorize} checks use upper case ({@code hasRole('ADMIN')}), so each role
     * becomes {@code ROLE_<UPPER>}.
     */
    static Converter<Jwt, ? extends AbstractAuthenticationToken> jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(SecurityConfig::realmRoles);
        return converter;
    }

    static Collection<GrantedAuthority> realmRoles(Jwt jwt) {
        Object realmAccess = jwt.getClaim("realm_access");
        if (!(realmAccess instanceof Map)) {
            return Collections.emptyList();
        }
        Object roles = ((Map<?, ?>) realmAccess).get("roles");
        if (!(roles instanceof List)) {
            return Collections.emptyList();
        }
        return ((List<?>) roles).stream()
            .map(Object::toString)
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)))
            .collect(Collectors.toList());
    }
}
