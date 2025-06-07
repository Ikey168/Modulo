# Build stage
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace/app

# Set JAVA_HOME
ENV JAVA_HOME=/opt/java/openjdk

# Copy maven wrapper and pom.xml first for better layer caching
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Download dependencies
RUN ./mvnw dependency:go-offline

# Copy source code
COPY src src

# Build application
RUN ./mvnw clean install -DskipTests
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

# Runtime stage
FROM eclipse-temurin:21-jre-jammy

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (recommended for Azure)
RUN useradd -ms /bin/bash springuser
WORKDIR /home/springuser

VOLUME /tmp

# Copy application from build stage
COPY --from=build /workspace/app/target/*.jar app.jar
COPY --from=build /workspace/app/target/dependency /app/dependency

# Set permissions
RUN chown -R springuser:springuser /home/springuser && \
    chmod -R 755 /home/springuser

USER springuser

# Expose default Spring Boot port
EXPOSE 8080

# Healthcheck for container
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Define entry point with JVM optimization for containers
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=70.0", "-jar", "app.jar"]