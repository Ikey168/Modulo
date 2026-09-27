package com.modulo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;

/**
 * Enforces {@code @PreAuthorize} and friends in every profile.
 *
 * <p>Method security used to be switched on only by the {@code oidc}-profile security
 * configuration, so under the {@code docker} profile that every deployment runs, the
 * {@code hasRole('ADMIN')} checks on the plugin, auth-migration, marketplace-trust and
 * chaos endpoints were silently ignored. This is the only place it is enabled.</p>
 */
@Configuration
@EnableGlobalMethodSecurity(prePostEnabled = true)
public class MethodSecurityConfig {
}
