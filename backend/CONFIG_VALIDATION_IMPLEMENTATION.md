# Configuration Schema Validation Implementation

This document describes the implementation of configuration schema validation for the Modulo application, ensuring fail-fast behavior on missing or invalid environment variables with sensible defaults.

## Overview

The configuration validation system provides:
- **Fail-fast startup**: Application fails immediately if configuration is invalid
- **Comprehensive validation**: All configuration properties are validated using JSR-303 annotations
- **Health check integration**: Configuration validation is included in application health checks
- **Detailed error messages**: Clear error messages for debugging configuration issues
- **Sensible defaults**: Reasonable default values for optional configuration properties

## Architecture

### Core Components

1. **Configuration Properties Classes**: Type-safe configuration classes with validation annotations
2. **ConfigurationValidator**: Central validation component that validates all configurations
3. **ConfigurationHealthIndicator**: Health check that prevents the app from reporting healthy with invalid config
4. **ValidationConfig**: Bean configuration for JSR-303 validator

### Configuration Properties Classes

#### DatabaseProperties (`com.modulo.config.properties.DatabaseProperties`)
- Validates JDBC URL format and required credentials
- Supports H2, PostgreSQL, and SQLite with appropriate validation patterns
- Connection pool settings with reasonable min/max constraints

#### ServerProperties (`com.modulo.config.properties.ServerProperties`)
- Validates server port ranges (1024-65535)
- Context path format validation
- Servlet configuration validation

#### ModuloProperties (`com.modulo.config.properties.ModuloProperties`)
- **Security**: JWT secrets, API keys, encryption settings with format validation
- **Features**: Feature flags for enabling/disabling application capabilities
- **Performance**: Thread pools, timeouts, cache settings with reasonable limits
- **Integrations**: Blockchain and external API configuration

#### ManagementProperties (`com.modulo.config.properties.ManagementProperties`)
- Actuator endpoint configuration
- Metrics and monitoring settings
- Health check timeouts and thresholds

#### GrpcProperties (`com.modulo.config.properties.GrpcProperties`)
- GRPC server and client configuration
- Message size limits and connection settings
- TLS/security configuration

## Validation Features

### JSR-303 Annotations Used

- `@NotNull`: Required fields
- `@NotBlank`: Non-empty strings
- `@Pattern`: Regex validation for formats (URLs, addresses, etc.)
- `@Min`/`@Max`: Numeric range validation
- `@Valid`: Nested object validation

### Custom Validation Rules

- **JDBC URL Validation**: Ensures proper database connection strings
- **Port Range Validation**: Network ports within valid ranges
- **Security Key Validation**: JWT secrets and API keys follow required formats
- **Network Address Validation**: IP addresses and hostnames
- **File Path Validation**: Configuration file paths when applicable

## Implementation Details

### Startup Validation

```java
@EventListener(ApplicationReadyEvent.class)
public void validateConfigurationOnStartup() {
    // Validates all configuration properties
    // Throws IllegalStateException if validation fails
    // Logs detailed error messages for debugging
}
```

### Health Check Integration

```java
@Component
public class ConfigurationHealthIndicator implements HealthIndicator {
    // Returns Health.down() if configuration is invalid
    // Prevents application from reporting as healthy with bad config
}
```

### Error Handling

The system provides detailed error messages including:
- Property path (e.g., `security.jwtSecret`)
- Validation message (e.g., "must be at least 32 characters")
- Current invalid value (sanitized for security)

## Configuration Examples

### Valid Configuration (application.yml)

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/modulo
    username: ${DB_USERNAME:modulo}
    password: ${DB_PASSWORD:password}
  
server:
  port: ${SERVER_PORT:8080}
  servlet:
    context-path: ${CONTEXT_PATH:/api}

modulo:
  security:
    jwt-secret: ${JWT_SECRET}  # Must be base64, 32+ chars
    api-key: ${API_KEY}        # Must start with 'mod_'
    encryption-key: ${ENCRYPTION_KEY}
  features:
    enable-blockchain: ${ENABLE_BLOCKCHAIN:true}
    enable-grpc: ${ENABLE_GRPC:true}
  performance:
    max-file-size-mb: ${MAX_FILE_SIZE:10}
    thread-pool-size: ${THREAD_POOL_SIZE:10}

management:
  server:
    port: ${MANAGEMENT_PORT:8081}
  endpoints:
    web:
      exposure: "health,info,metrics,prometheus"

grpc:
  server:
    port: ${GRPC_PORT:9090}
```

### Environment Variables

Required environment variables:
```bash
# Security (required)
JWT_SECRET="dGVzdC1qd3Qtc2VjcmV0LWZvci12YWxpZGF0aW9uLXRlc3RpbmctMTIzNDU2Nzg5MA=="
API_KEY="mod_abcdef1234567890"
ENCRYPTION_KEY="your-encryption-key-here"

# Database (required for production)
DB_USERNAME="modulo"
DB_PASSWORD="secure-password"

# Optional with sensible defaults
SERVER_PORT="8080"
MANAGEMENT_PORT="8081"
GRPC_PORT="9090"
ENABLE_BLOCKCHAIN="true"
MAX_FILE_SIZE="10"
```

## Error Examples

### Invalid JDBC URL
```
❌ Database configuration validation failed:
  • Property 'url' must be a valid JDBC URL starting with jdbc:: current value = 'invalid-url'
```

### Invalid JWT Secret
```
❌ Modulo configuration validation failed:
  • Property 'security.jwtSecret' must be a valid base64 string with minimum 32 characters: current value = 'too-short'
```

### Invalid API Key Format
```
❌ Modulo configuration validation failed:
  • Property 'security.apiKey' must start with 'mod_' followed by at least 16 alphanumeric characters: current value = 'invalid-key'
```

## Testing

### Unit Tests

The implementation includes comprehensive unit tests:

- **ConfigurationValidatorTest**: Tests all validation scenarios
- **ConfigurationHealthIndicatorTest**: Tests health check behavior
- **Individual Properties Tests**: Validates each configuration class

### Test Coverage

- ✅ Valid configuration scenarios
- ✅ Invalid configuration scenarios  
- ✅ Missing required fields
- ✅ Out-of-range values
- ✅ Invalid format patterns
- ✅ Health check integration
- ✅ Error message formatting

## Benefits

1. **Early Error Detection**: Configuration errors are caught at startup, not runtime
2. **Clear Error Messages**: Developers get specific guidance on fixing configuration issues
3. **Type Safety**: Configuration is strongly typed with compile-time checking
4. **Health Integration**: Prevents applications from appearing healthy with bad configuration
5. **Documentation**: Configuration schema serves as living documentation
6. **Security**: Sensitive values are masked in logs and error messages

## Usage

### Development
1. Set required environment variables
2. Start the application
3. Check logs for validation results
4. Fix any configuration errors reported

### Production
1. Configure all required environment variables
2. Application will fail to start if configuration is invalid
3. Health checks will report DOWN if configuration becomes invalid
4. Monitor health endpoints for configuration issues

### Debugging
1. Check application startup logs for validation messages
2. Use `/actuator/health` endpoint to check configuration health
3. Review error messages for specific property validation failures
4. Verify environment variables match required patterns

This implementation ensures that configuration errors are caught early and provide clear guidance for resolution, improving the overall reliability and maintainability of the Modulo application.
