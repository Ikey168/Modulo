package com.modulo.health;

import com.modulo.config.ConfigurationValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuator.health.Health;
import org.springframework.boot.actuator.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.stereotype.Component;

/**
 * Health indicator that checks if all configuration properties are valid.
 * This prevents the application from reporting as healthy when configuration is invalid.
 * Only enabled when actuator health classes are available.
 */
@Component
@ConditionalOnClass(HealthIndicator.class)
public class ConfigurationHealthIndicator implements HealthIndicator {

    private final ConfigurationValidator configurationValidator;

    @Autowired
    public ConfigurationHealthIndicator(ConfigurationValidator configurationValidator) {
        this.configurationValidator = configurationValidator;
    }

    @Override
    public Health health() {
        try {
            boolean isValid = configurationValidator.validateConfiguration();

            if (isValid) {
                return Health.up()
                        .withDetail("status", "All configuration properties are valid")
                        .withDetail("validation", "passed")
                        .build();
            } else {
                String errors = configurationValidator.getValidationErrors();
                return Health.down()
                        .withDetail("status", "Configuration validation failed")
                        .withDetail("validation", "failed")
                        .withDetail("errors", errors)
                        .build();
            }
        } catch (Exception e) {
            return Health.down()
                    .withDetail("status", "Configuration validation error")
                    .withDetail("validation", "error")
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
