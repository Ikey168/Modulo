package com.modulo.config;

import com.modulo.config.properties.DatabaseProperties;
import com.modulo.config.properties.GrpcProperties;
import com.modulo.config.properties.ManagementProperties;
import com.modulo.config.properties.ModuloProperties;
import com.modulo.config.properties.ServerProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.validation.ConstraintViolation;
import javax.validation.Validator;
import java.util.Set;

/**
 * Configuration validator that validates all configuration properties at startup
 * and provides detailed error messages for any validation failures.
 */
@Component
@EnableConfigurationProperties({
    DatabaseProperties.class,
    ServerProperties.class,
    ModuloProperties.class,
    ManagementProperties.class,
    GrpcProperties.class
})
public class ConfigurationValidator {

    private static final Logger logger = LoggerFactory.getLogger(ConfigurationValidator.class);

    private final Validator validator;
    private final DatabaseProperties databaseProperties;
    private final ServerProperties serverProperties;
    private final ModuloProperties moduloProperties;
    private final ManagementProperties managementProperties;
    private final GrpcProperties grpcProperties;

    @Autowired
    public ConfigurationValidator(
            Validator validator,
            DatabaseProperties databaseProperties,
            ServerProperties serverProperties,
            ModuloProperties moduloProperties,
            ManagementProperties managementProperties,
            GrpcProperties grpcProperties) {
        this.validator = validator;
        this.databaseProperties = databaseProperties;
        this.serverProperties = serverProperties;
        this.moduloProperties = moduloProperties;
        this.managementProperties = managementProperties;
        this.grpcProperties = grpcProperties;
    }

    /**
     * Validates all configuration properties when the application is ready.
     * This ensures that any configuration errors are caught early in the startup process.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void validateConfigurationOnStartup() {
        logger.info("Starting configuration validation...");

        boolean isValid = true;

        // Validate database properties
        isValid &= validateAndLog("Database", databaseProperties);

        // Validate server properties
        isValid &= validateAndLog("Server", serverProperties);

        // Validate modulo-specific properties
        isValid &= validateAndLog("Modulo", moduloProperties);

        // Validate management properties
        isValid &= validateAndLog("Management", managementProperties);

        // Validate GRPC properties
        isValid &= validateAndLog("GRPC", grpcProperties);

        if (isValid) {
            logger.info("✅ All configuration properties are valid");
            logConfigurationSummary();
        } else {
            logger.error("❌ Configuration validation failed - application startup should be aborted");
            throw new IllegalStateException("Configuration validation failed. Check the logs above for detailed error messages.");
        }
    }

    /**
     * Validates a configuration properties object and logs any violations.
     *
     * @param configName the name of the configuration group for logging
     * @param config the configuration object to validate
     * @return true if valid, false if there are violations
     */
    private boolean validateAndLog(String configName, Object config) {
        Set<ConstraintViolation<Object>> violations = validator.validate(config);

        if (violations.isEmpty()) {
            logger.debug("✅ {} configuration is valid", configName);
            return true;
        }

        logger.error("❌ {} configuration validation failed:", configName);
        for (ConstraintViolation<Object> violation : violations) {
            logger.error("  • Property '{}' {}: current value = '{}'",
                    violation.getPropertyPath(),
                    violation.getMessage(),
                    violation.getInvalidValue());
        }

        return false;
    }

    /**
     * Logs a summary of the current configuration for debugging purposes.
     * Sensitive values are masked.
     */
    private void logConfigurationSummary() {
        logger.info("Configuration Summary:");
        logger.info("├── Database: {}", databaseProperties);
        logger.info("├── Server: {}", serverProperties);
        logger.info("├── Management: {}", managementProperties);
        logger.info("├── GRPC: {}", grpcProperties);
        logger.info("└── Modulo: {}", moduloProperties);
    }

    /**
     * Manually validates configuration properties.
     * This can be used for testing or explicit validation.
     *
     * @return true if all configurations are valid, false otherwise
     */
    public boolean validateConfiguration() {
        boolean isValid = true;

        isValid &= validator.validate(databaseProperties).isEmpty();
        isValid &= validator.validate(serverProperties).isEmpty();
        isValid &= validator.validate(moduloProperties).isEmpty();
        isValid &= validator.validate(managementProperties).isEmpty();
        isValid &= validator.validate(grpcProperties).isEmpty();

        return isValid;
    }

    /**
     * Gets detailed validation errors for all configuration properties.
     *
     * @return a formatted string containing all validation errors, or empty string if valid
     */
    public String getValidationErrors() {
        StringBuilder errors = new StringBuilder();

        addValidationErrors(errors, "Database", databaseProperties);
        addValidationErrors(errors, "Server", serverProperties);
        addValidationErrors(errors, "Modulo", moduloProperties);
        addValidationErrors(errors, "Management", managementProperties);
        addValidationErrors(errors, "GRPC", grpcProperties);

        return errors.toString();
    }

    /**
     * Adds validation errors for a specific configuration object to the StringBuilder.
     */
    private void addValidationErrors(StringBuilder errors, String configName, Object config) {
        Set<ConstraintViolation<Object>> violations = validator.validate(config);

        if (!violations.isEmpty()) {
            errors.append(configName).append(" Configuration Errors:\n");
            for (ConstraintViolation<Object> violation : violations) {
                errors.append("  - Property '")
                      .append(violation.getPropertyPath())
                      .append("' ")
                      .append(violation.getMessage())
                      .append(" (current value: '")
                      .append(violation.getInvalidValue())
                      .append("')\n");
            }
            errors.append("\n");
        }
    }
}
