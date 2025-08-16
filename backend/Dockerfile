# Build stage - Multi-arch compatible
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace/app

# Set JAVA_HOME
ENV JAVA_HOME=/opt/java/openjdk

# Copy maven wrapper and pom.xml first for better layer caching
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .

# Make mvnw executable and download dependencies
RUN chmod +x ./mvnw && ./mvnw dependency:go-offline

# Copy source code
COPY src src

# Build application with optimizations
RUN ./mvnw clean install -DskipTests -Dmaven.compiler.release=21
RUN mkdir -p target/dependency && (cd target/dependency; jar -xf ../*.jar)

# Runtime stage - Multi-arch with enhanced security
FROM eclipse-temurin:21-jre-jammy

# Install required packages and clean up in single layer for efficiency
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create non-root user with specific UID/GID for consistency across platforms
RUN groupadd -r -g 1001 springuser && \
    useradd -r -g springuser -u 1001 -m -d /home/springuser -s /bin/bash springuser

# Set working directory
WORKDIR /home/springuser

# Create necessary directories with proper permissions
RUN mkdir -p /home/springuser/app /tmp/spring-boot && \
    chown -R springuser:springuser /home/springuser /tmp/spring-boot

# Copy application from build stage with proper ownership
COPY --from=build --chown=springuser:springuser /workspace/app/target/*.jar /home/springuser/app/app.jar

# Switch to non-root user early
USER springuser

# Set up volume for temporary files
VOLUME ["/tmp"]

# Expose port
EXPOSE 8080

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Set JVM options for better container performance and security
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0 -XX:+UseG1GC -XX:+UnlockExperimentalVMOptions -XX:+UseZGC -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=production"

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /home/springuser/app/app.jar"]

# Define entry point with JVM optimization for containers
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=70.0", "-jar", "app.jar"]