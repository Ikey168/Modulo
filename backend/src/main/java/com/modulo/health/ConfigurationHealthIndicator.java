package com.modulo.health;

import com.modulo.config.ConfigurationValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.stereotype.Component;

/**
 * Configuration validation component that can be optionally used as a health indicator.
 * This validates configuration during startup and provides validation status.
 * The health indicator functionality will be enabled when actuator classes are available.
 */
@Component
public class ConfigurationHealthIndicator {

    private static final Logger logger = LoggerFactory.getLogger(ConfigurationHealthIndicator.class);
    
    private final ConfigurationValidator configurationValidator;

    @Autowired
    public ConfigurationHealthIndicator(ConfigurationValidator configurationValidator) {
        this.configurationValidator = configurationValidator;
    }

    /**
     * Validates configuration and returns status information.
     * This can be used by health checks or monitoring systems.
     */
    public ConfigurationStatus getConfigurationStatus() {
        try {
            boolean isValid = configurationValidator.validateConfiguration();

            if (isValid) {
                logger.debug("Configuration validation passed");
                return new ConfigurationStatus(true, "All configuration properties are valid", null);
            } else {
                String errors = configurationValidator.getValidationErrors();
                logger.warn("Configuration validation failed: {}", errors);
                return new ConfigurationStatus(false, "Configuration validation failed", errors);
            }
        } catch (Exception e) {
            logger.error("Configuration validation error", e);
            return new ConfigurationStatus(false, "Configuration validation error: " + e.getMessage(), null);
        }
    }

    /**
     * Simple status class for configuration validation results
     */
    public static class ConfigurationStatus {
        private final boolean valid;
        private final String message;
        private final String errors;

        public ConfigurationStatus(boolean valid, String message, String errors) {
            this.valid = valid;
            this.message = message;
            this.errors = errors;
        }

        public boolean isValid() {
            return valid;
        }

        public String getMessage() {
            return message;
        }

        public String getErrors() {
            return errors;
        }

        @Override
        public String toString() {
            return "ConfigurationStatus{" +
                    "valid=" + valid +
                    ", message='" + message + '\'' +
                    ", errors='" + errors + '\'' +
                    '}';
        }
    }
}
