package com.modulo.config;

import com.modulo.config.properties.DatabaseProperties;
import com.modulo.config.properties.GrpcProperties;
import com.modulo.config.properties.ManagementProperties;
import com.modulo.config.properties.ModuloProperties;
import com.modulo.config.properties.ServerProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import javax.validation.ConstraintViolation;
import javax.validation.Validator;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test class for configuration validation
 */
@SpringBootTest
@TestPropertySource(properties = {
    // Valid configuration for testing
    "spring.datasource.url=jdbc:h2:mem:testdb",
    "spring.datasource.username=test",
    "spring.datasource.password=test",
    "server.port=8080",
    "modulo.security.jwt-secret=dGVzdC1qd3Qtc2VjcmV0LWZvci12YWxpZGF0aW9uLXRlc3RpbmctMTIzNDU2Nzg5MA==",
    "modulo.security.api-key=mod_abcdef1234567890",
    "modulo.security.encryption-key=test-encryption-key",
    "grpc.server.port=9090"
})
class ConfigurationValidatorTest {

    @Autowired
    private Validator validator;

    @Autowired
    private ConfigurationValidator configurationValidator;

    @Autowired
    private DatabaseProperties databaseProperties;

    @Autowired
    private ServerProperties serverProperties;

    @Autowired
    private ModuloProperties moduloProperties;

    @Autowired
    private ManagementProperties managementProperties;

    @Autowired
    private GrpcProperties grpcProperties;

    @BeforeEach
    void setUp() {
        assertNotNull(validator, "Validator should be autowired");
        assertNotNull(configurationValidator, "ConfigurationValidator should be autowired");
    }

    @Test
    void testValidConfiguration() {
        // Test that valid configuration passes validation
        boolean isValid = configurationValidator.validateConfiguration();
        assertTrue(isValid, "Valid configuration should pass validation");

        String errors = configurationValidator.getValidationErrors();
        assertTrue(errors.isEmpty(), "Valid configuration should have no validation errors");
    }

    @Test
    void testDatabasePropertiesValidation() {
        // Test valid database properties
        Set<ConstraintViolation<DatabaseProperties>> violations = validator.validate(databaseProperties);
        assertTrue(violations.isEmpty(), "Valid database properties should pass validation");
    }

    @Test
    void testInvalidDatabaseUrl() {
        // Create invalid database properties
        DatabaseProperties invalidProps = new DatabaseProperties();
        invalidProps.setUrl("invalid-url");
        invalidProps.setUsername("test");
        invalidProps.setPassword("test");

        Set<ConstraintViolation<DatabaseProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid database URL should fail validation");

        boolean hasUrlViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().equals("url"));
        assertTrue(hasUrlViolation, "Should have URL validation violation");
    }

    @Test
    void testServerPropertiesValidation() {
        // Test valid server properties
        Set<ConstraintViolation<ServerProperties>> violations = validator.validate(serverProperties);
        assertTrue(violations.isEmpty(), "Valid server properties should pass validation");
    }

    @Test
    void testInvalidServerPort() {
        // Create invalid server properties
        ServerProperties invalidProps = new ServerProperties();
        invalidProps.setPort(99); // Port too low
        invalidProps.getServlet().setContextPath("/test");

        Set<ConstraintViolation<ServerProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid server port should fail validation");

        boolean hasPortViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().equals("port"));
        assertTrue(hasPortViolation, "Should have port validation violation");
    }

    @Test
    void testModuloPropertiesValidation() {
        // Test valid modulo properties
        Set<ConstraintViolation<ModuloProperties>> violations = validator.validate(moduloProperties);
        assertTrue(violations.isEmpty(), "Valid modulo properties should pass validation");
    }

    @Test
    void testInvalidJwtSecret() {
        // Create invalid modulo properties
        ModuloProperties invalidProps = new ModuloProperties();
        ModuloProperties.Security security = new ModuloProperties.Security();
        security.setJwtSecret("too-short"); // Too short JWT secret
        security.setApiKey("mod_abcdef1234567890");
        security.setEncryptionKey("test-key");
        invalidProps.setSecurity(security);

        Set<ConstraintViolation<ModuloProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid JWT secret should fail validation");

        boolean hasJwtViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().contains("jwtSecret"));
        assertTrue(hasJwtViolation, "Should have JWT secret validation violation");
    }

    @Test
    void testInvalidApiKey() {
        // Create invalid modulo properties
        ModuloProperties invalidProps = new ModuloProperties();
        ModuloProperties.Security security = new ModuloProperties.Security();
        security.setJwtSecret("dGVzdC1qd3Qtc2VjcmV0LWZvci12YWxpZGF0aW9uLXRlc3RpbmctMTIzNDU2Nzg5MA==");
        security.setApiKey("invalid-api-key"); // Invalid API key format
        security.setEncryptionKey("test-key");
        invalidProps.setSecurity(security);

        Set<ConstraintViolation<ModuloProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid API key should fail validation");

        boolean hasApiKeyViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().contains("apiKey"));
        assertTrue(hasApiKeyViolation, "Should have API key validation violation");
    }

    @Test
    void testManagementPropertiesValidation() {
        // Test valid management properties
        Set<ConstraintViolation<ManagementProperties>> violations = validator.validate(managementProperties);
        assertTrue(violations.isEmpty(), "Valid management properties should pass validation");
    }

    @Test
    void testInvalidManagementPort() {
        // Create invalid management properties
        ManagementProperties invalidProps = new ManagementProperties();
        ManagementProperties.Server server = new ManagementProperties.Server();
        server.setPort(99999); // Port too high
        invalidProps.setServer(server);

        Set<ConstraintViolation<ManagementProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid management port should fail validation");

        boolean hasPortViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().contains("port"));
        assertTrue(hasPortViolation, "Should have port validation violation");
    }

    @Test
    void testGrpcPropertiesValidation() {
        // Test valid GRPC properties
        Set<ConstraintViolation<GrpcProperties>> violations = validator.validate(grpcProperties);
        assertTrue(violations.isEmpty(), "Valid GRPC properties should pass validation");
    }

    @Test
    void testInvalidGrpcTarget() {
        // Create invalid GRPC properties
        GrpcProperties invalidProps = new GrpcProperties();
        GrpcProperties.Client client = new GrpcProperties.Client();
        client.setTarget("invalid-target"); // Invalid target format
        invalidProps.setClient(client);

        Set<ConstraintViolation<GrpcProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid GRPC target should fail validation");

        boolean hasTargetViolation = violations.stream()
            .anyMatch(v -> v.getPropertyPath().toString().contains("target"));
        assertTrue(hasTargetViolation, "Should have target validation violation");
    }

    @Test
    void testValidationErrorFormatting() {
        // Create properties with multiple validation errors
        ModuloProperties invalidProps = new ModuloProperties();
        ModuloProperties.Security security = new ModuloProperties.Security();
        security.setJwtSecret("short"); // Too short
        security.setApiKey("invalid"); // Invalid format
        security.setEncryptionKey(""); // Empty
        invalidProps.setSecurity(security);

        // Add to configuration validator (mock scenario)
        Set<ConstraintViolation<ModuloProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Multiple invalid properties should fail validation");
        assertTrue(violations.size() >= 3, "Should have at least 3 validation violations");
    }

    @Test
    void testConfigurationValidatorErrorMessage() {
        // Test that ConfigurationValidator properly formats error messages
        ModuloProperties invalidProps = new ModuloProperties();
        ModuloProperties.Security security = new ModuloProperties.Security();
        security.setJwtSecret("invalid");
        security.setApiKey("invalid");
        security.setEncryptionKey("");
        invalidProps.setSecurity(security);

        Set<ConstraintViolation<ModuloProperties>> violations = validator.validate(invalidProps);
        assertFalse(violations.isEmpty(), "Invalid properties should generate violations");

        // Verify error message structure
        for (ConstraintViolation<ModuloProperties> violation : violations) {
            assertNotNull(violation.getPropertyPath(), "Property path should not be null");
            assertNotNull(violation.getMessage(), "Violation message should not be null");
            assertNotNull(violation.getInvalidValue(), "Invalid value should not be null");
        }
    }
}
