# Azure Application Insights Setup

## Overview
This project uses Azure Application Insights for monitoring. The configuration has been updated to use the Azure Application Insights Java Agent instead of Spring Boot starter dependencies.

## Maven Dependencies
The following dependency is included for Spring Boot Actuator integration:
```xml
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-azure-monitor</artifactId>
</dependency>
```

## Agent Setup
To enable Application Insights monitoring, you need to:

1. Download the Application Insights Java Agent from:
   https://github.com/microsoft/ApplicationInsights-Java/releases

2. Add the agent to your JVM startup arguments:
   ```bash
   -javaagent:path/to/applicationinsights-agent-3.x.x.jar
   ```

3. Configure the connection string either via:
   - Environment variable: `APPLICATIONINSIGHTS_CONNECTION_STRING`
   - System property: `-Dapplicationinsights.connection.string=your_connection_string`
   - Configuration file: `applicationinsights.json`

## Docker Setup
When running in Docker/Kubernetes, ensure the agent JAR is available in the container and the JVM arguments include the agent configuration.

## Environment Variables
Set the following environment variables in your deployment:
- `APPLICATIONINSIGHTS_CONNECTION_STRING`: Your Application Insights connection string from Azure Portal

## Configuration Files
The agent can be configured via `applicationinsights.json` file. Place it in the same directory as your JAR file or specify the path.

Example `applicationinsights.json`:
```json
{
  "connectionString": "${APPLICATIONINSIGHTS_CONNECTION_STRING}",
  "sampling": {
    "percentage": 100
  },
  "instrumentation": {
    "logging": {
      "level": "INFO"
    }
  }
}
```
