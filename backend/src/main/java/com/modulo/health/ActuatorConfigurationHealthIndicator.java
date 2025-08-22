package com.modulo.health;

import com.modulo.config.ConfigurationValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.stereotype.Component;

/**
 * Spring Boot Actuator health indicator for configuration validation.
 * This will only be active when actuator classes are on the classpath.
 */
@Component
@ConditionalOnClass(HealthIndicator.class)
public class ActuatorConfigurationHealthIndicator implements HealthIndicator {

    private final ConfigurationValidator configurationValidator;

    @Autowired
    public ActuatorConfigurationHealthIndicator(ConfigurationValidator configurationValidator) {
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
