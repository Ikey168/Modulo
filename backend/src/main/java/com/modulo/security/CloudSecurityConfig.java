package com.modulo.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Enhanced Security Configuration for Cloud Deployment
 * Addresses Issue #51: Conduct Security Testing on Cloud Deployment
 */
@Configuration
@EnableWebSecurity
@Profile("cloud")
public class CloudSecurityConfig {

    private static final Logger logger = LoggerFactory.getLogger(CloudSecurityConfig.class);

    @Value("${modulo.security.allowed-origins:http://localhost:3000,https://modulo-app.com}")
    private String[] allowedOrigins;

    @Value("${modulo.security.jwt.secret:#{null}}")
    private String jwtSecret;

    @Value("${modulo.security.rate-limiting.enabled:true}")
    private boolean rateLimitingEnabled;

    @Bean
    public SecurityFilterChain cloudSecurityFilterChain(HttpSecurity http) throws Exception {
        logger.info("Configuring enhanced cloud security");

        http
            // Session management - stateless for cloud deployment
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                .maximumSessions(1)
                .maxSessionsPreventsLogin(false)
            )

            // Enhanced authorization rules
            .authorizeRequests(authz -> authz
                // Public health and monitoring endpoints (with restrictions)
                .antMatchers("/api/health/status", "/api/simple-health").permitAll()
                .antMatchers("/actuator/health", "/actuator/info").permitAll()
                
                // Static resources with cache headers
                .antMatchers("/static/**", "/favicon.ico", "/manifest.json").permitAll()
                .antMatchers("/*.js", "/*.css", "/*.png", "/*.jpg", "/*.gif").permitAll()
                
                // Authentication endpoints
                .antMatchers("/auth/**", "/oauth2/**", "/login/**").permitAll()
                .antMatchers("/api/auth/**", "/api/public/**").permitAll()
                
                // API versioning - restrict older versions
                .antMatchers("/api/v1/**").authenticated()
                .antMatchers("/api/v2/**").authenticated()
                
                // Admin endpoints - require specific roles
                .antMatchers("/api/admin/**", "/actuator/**").hasRole("ADMIN")
                .antMatchers("/api/v2/performance/**").hasAnyRole("ADMIN", "MONITOR")
                
                // Mobile specific endpoints
                .antMatchers("/api/mobile/**").authenticated()
                
                // All other API endpoints require authentication
                .antMatchers("/api/**").authenticated()
                
                // Default deny for everything else
                .anyRequest().denyAll()
            )

            // Enhanced CSRF protection for cloud deployment
            .csrf(csrf -> csrf
                .csrfTokenRepository(org.springframework.security.web.csrf.CookieCsrfTokenRepository.withHttpOnlyFalse())
                .ignoringAntMatchers(
                    "/api/health/**", 
                    "/actuator/health", 
                    "/actuator/info",
                    "/api/auth/mobile/**" // Mobile auth endpoints
                )
            )

            // Enhanced CORS configuration
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Security headers for cloud deployment
            .headers(headers -> headers
                .frameOptions().deny()
                .contentTypeOptions().and()
                .httpStrictTransportSecurity(hstsConfig -> hstsConfig
                    .maxAgeInSeconds(31536000) // 1 year
                    .includeSubdomains(true)
                    .preload(true)
                )
                .referrerPolicy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                .addHeaderWriter(new StaticHeaderWriter("X-Content-Type-Options", "nosniff"))
                .addHeaderWriter(new StaticHeaderWriter("X-Frame-Options", "DENY"))
                .addHeaderWriter(new StaticHeaderWriter("X-XSS-Protection", "1; mode=block"))
                .addHeaderWriter(new StaticHeaderWriter("Strict-Transport-Security", 
                    "max-age=31536000; includeSubDomains; preload"))
                .addHeaderWriter(new StaticHeaderWriter("Content-Security-Policy", 
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' https:; " +
                    "font-src 'self'; " +
                    "object-src 'none'; " +
                    "media-src 'self'; " +
                    "frame-ancestors 'none'"))
                .addHeaderWriter(new StaticHeaderWriter("Permissions-Policy", 
                    "geolocation=(), microphone=(), camera=()"))
            )

            // OAuth2 configuration for cloud
            .oauth2Login(oauth2 -> oauth2
                .loginPage("/login")
                .defaultSuccessUrl("/dashboard", true)
                .failureUrl("/login?error=true")
                .authorizationEndpoint().baseUri("/oauth2/authorize").and()
                .redirectionEndpoint().baseUri("/oauth2/callback/*").and()
            )

            // Enhanced logout configuration
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessUrl("/")
                .invalidateHttpSession(true)
                .deleteCookies("JSESSIONID", "CSRF-TOKEN")
                .clearAuthentication(true)
            )

            // Exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    logger.warn("Unauthorized access attempt: {} from {}", 
                              request.getRequestURI(), request.getRemoteAddr());
                    response.sendError(401, "Unauthorized");
                })
                .accessDeniedHandler((request, response, accessDeniedException) -> {
                    logger.warn("Access denied: {} from {}", 
                              request.getRequestURI(), request.getRemoteAddr());
                    response.sendError(403, "Forbidden");
                })
            );

        // Add rate limiting filter if enabled
        if (rateLimitingEnabled) {
            http.addFilterBefore(rateLimitingFilter(), UsernamePasswordAuthenticationFilter.class);
        }

        logger.info("Cloud security configuration completed successfully");
        return http.build();
    }

    /**
     * CORS configuration for cloud deployment
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Allowed origins from configuration
        configuration.setAllowedOriginPatterns(Arrays.asList(allowedOrigins));
        
        // Allowed methods
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        
        // Allowed headers
        configuration.setAllowedHeaders(Arrays.asList(
            "Authorization", "Content-Type", "X-Requested-With", "accept", "Origin", 
            "Access-Control-Request-Method", "Access-Control-Request-Headers", "X-CSRF-TOKEN"
        ));
        
        // Exposed headers
        configuration.setExposedHeaders(Arrays.asList(
            "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "X-CSRF-TOKEN"
        ));
        
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        
        return source;
    }

    /**
     * Rate limiting filter for API protection
     */
    @Bean
    public RateLimitingFilter rateLimitingFilter() {
        return new RateLimitingFilter();
    }

    /**
     * Security audit logger
     */
    @Bean
    public SecurityAuditLogger securityAuditLogger() {
        return new SecurityAuditLogger();
    }
}
