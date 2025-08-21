package com.modulo.health;

import com.modulo.config.ConfigurationValidator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Test class for ActuatorConfigurationHealthIndicator
 * This test will only run when Spring Boot Actuator classes are available
 */
@ExtendWith(MockitoExtension.class)
class ActuatorConfigurationHealthIndicatorTest {

    @Mock
    private ConfigurationValidator configurationValidator;

    private ActuatorConfigurationHealthIndicator healthIndicator;

    @BeforeEach
    void setUp() {
        healthIndicator = new ActuatorConfigurationHealthIndicator(configurationValidator);
    }

    @Test
    void testHealthWhenConfigurationIsValid() {
        // Arrange
        when(configurationValidator.validateConfiguration()).thenReturn(true);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertEquals(Status.UP, health.getStatus(), "Health should be UP when configuration is valid");
        assertEquals("All configuration properties are valid", health.getDetails().get("status"));
        assertEquals("passed", health.getDetails().get("validation"));

        verify(configurationValidator).validateConfiguration();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testHealthWhenConfigurationIsInvalid() {
        // Arrange
        String errorMessages = "Database Configuration Errors:\n  - Property 'url' must be a valid JDBC URL (current value: 'invalid')\n";
        when(configurationValidator.validateConfiguration()).thenReturn(false);
        when(configurationValidator.getValidationErrors()).thenReturn(errorMessages);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertEquals(Status.DOWN, health.getStatus(), "Health should be DOWN when configuration is invalid");
        assertEquals("Configuration validation failed", health.getDetails().get("status"));
        assertEquals("failed", health.getDetails().get("validation"));
        assertEquals(errorMessages, health.getDetails().get("errors"));

        verify(configurationValidator).validateConfiguration();
        verify(configurationValidator).getValidationErrors();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testHealthWhenValidationThrowsException() {
        // Arrange
        RuntimeException exception = new RuntimeException("Validation error");
        when(configurationValidator.validateConfiguration()).thenThrow(exception);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertEquals(Status.DOWN, health.getStatus(), "Health should be DOWN when validation throws exception");
        assertEquals("Configuration validation error", health.getDetails().get("status"));
        assertEquals("error", health.getDetails().get("validation"));
        assertEquals("Validation error", health.getDetails().get("error"));

        verify(configurationValidator).validateConfiguration();
        verifyNoMoreInteractions(configurationValidator);
    }

    @Test
    void testHealthDetailsStructure() {
        // Arrange
        when(configurationValidator.validateConfiguration()).thenReturn(true);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertTrue(health.getDetails().containsKey("status"), "Health details should contain status");
        assertTrue(health.getDetails().containsKey("validation"), "Health details should contain validation");
        assertFalse(health.getDetails().containsKey("errors"), "Health details should not contain errors when valid");
        assertFalse(health.getDetails().containsKey("error"), "Health details should not contain error when valid");
    }

    @Test
    void testHealthDetailsWhenInvalid() {
        // Arrange
        String errorMessages = "Multiple configuration errors";
        when(configurationValidator.validateConfiguration()).thenReturn(false);
        when(configurationValidator.getValidationErrors()).thenReturn(errorMessages);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertTrue(health.getDetails().containsKey("status"), "Health details should contain status");
        assertTrue(health.getDetails().containsKey("validation"), "Health details should contain validation");
        assertTrue(health.getDetails().containsKey("errors"), "Health details should contain errors when invalid");
        assertFalse(health.getDetails().containsKey("error"), "Health details should not contain error when validation fails normally");
    }

    @Test
    void testHealthDetailsWhenException() {
        // Arrange
        RuntimeException exception = new RuntimeException("Test exception");
        when(configurationValidator.validateConfiguration()).thenThrow(exception);

        // Act
        Health health = healthIndicator.health();

        // Assert
        assertTrue(health.getDetails().containsKey("status"), "Health details should contain status");
        assertTrue(health.getDetails().containsKey("validation"), "Health details should contain validation");
        assertTrue(health.getDetails().containsKey("error"), "Health details should contain error when exception occurs");
        assertFalse(health.getDetails().containsKey("errors"), "Health details should not contain errors when exception occurs");
    }
}
