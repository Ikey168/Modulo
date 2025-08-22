package com.modulo.health;

import com.modulo.config.ConfigurationValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test class for ConfigurationHealthIndicator
 */
@ExtendWith(MockitoExtension.class)
class ConfigurationHealthIndicatorTest {

    @Mock
    private ConfigurationValidator configurationValidator;

    private ConfigurationHealthIndicator healthIndicator;

    @BeforeEach
    void setUp() {
        healthIndicator = new ConfigurationHealthIndicator(configurationValidator);
    }

    @Test
    void testStatusWhenConfigurationIsValid() {
        // Arrange
        when(configurationValidator.validateConfiguration()).thenReturn(true);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();

        // Assert
        assertTrue(status.isValid(), "Status should be valid when configuration is valid");
        assertEquals("All configuration properties are valid", status.getMessage());
        assertNull(status.getErrors());

        verify(configurationValidator).validateConfiguration();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testStatusWhenConfigurationIsInvalid() {
        // Arrange
        String errorMessages = "Database Configuration Errors:\n  - Property 'url' must be a valid JDBC URL (current value: 'invalid')\n";
        when(configurationValidator.validateConfiguration()).thenReturn(false);
        when(configurationValidator.getValidationErrors()).thenReturn(errorMessages);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();

        // Assert
        assertFalse(status.isValid(), "Status should be invalid when configuration is invalid");
        assertEquals("Configuration validation failed", status.getMessage());
        assertEquals(errorMessages, status.getErrors());

        verify(configurationValidator).validateConfiguration();
        verify(configurationValidator).getValidationErrors();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testStatusWhenValidationThrowsException() {
        // Arrange
        RuntimeException exception = new RuntimeException("Validation error");
        when(configurationValidator.validateConfiguration()).thenThrow(exception);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();

        // Assert
        assertFalse(status.isValid(), "Status should be invalid when validation throws exception");
        assertEquals("Configuration validation error: Validation error", status.getMessage());
        assertNull(status.getErrors());

        verify(configurationValidator).validateConfiguration();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testStatusStructure() {
        // Arrange
        when(configurationValidator.validateConfiguration()).thenReturn(true);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();

        // Assert
        assertNotNull(status.getMessage(), "Status should contain message");
        assertTrue(status.isValid(), "Status should be valid");
        assertNull(status.getErrors(), "Status should not contain errors when valid");
    }

    @Test
    void testStatusWhenInvalid() {
        // Arrange
        String errorMessages = "Multiple configuration errors";
        when(configurationValidator.validateConfiguration()).thenReturn(false);
        when(configurationValidator.getValidationErrors()).thenReturn(errorMessages);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();

        // Assert
        assertNotNull(status.getMessage(), "Status should contain message");
        assertFalse(status.isValid(), "Status should be invalid");
        assertNotNull(status.getErrors(), "Status should contain errors when invalid");
        assertEquals(errorMessages, status.getErrors());
    }

    @Test
    void testStatusToString() {
        // Arrange
        when(configurationValidator.validateConfiguration()).thenReturn(true);

        // Act
        ConfigurationHealthIndicator.ConfigurationStatus status = healthIndicator.getConfigurationStatus();
        String toString = status.toString();

        // Assert
        assertTrue(toString.contains("valid=true"), "toString should contain validity status");
        assertTrue(toString.contains("message="), "toString should contain message");
        assertTrue(toString.contains("ConfigurationStatus{"), "toString should contain class name");
    }
}
