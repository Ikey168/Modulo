# syntax=docker/dockerfile:1
# Java bytecode is architecture independent; build once on the native builder.
FROM --platform=$BUILDPLATFORM maven:3.9.9-eclipse-temurin-17@sha256:f58d59b6273e785ac0a4477f6e9b5ba1d7731c75b906c0f7b34076f1851318cc AS build
WORKDIR /workspace/app

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies using Maven (use parallel downloads and offline mode)
RUN mvn dependency:go-offline -T 2C --batch-mode --quiet

# Copy source code
COPY src src

# Build application with optimizations (parallel build, skip tests, quiet mode)
RUN mvn clean install -DskipTests -T 2C --batch-mode --quiet -Dmaven.compiler.source=17 -Dmaven.compiler.target=17

# Runtime stage - Multi-arch with enhanced security (Java 17 for consistency)
FROM eclipse-temurin:17-jre-jammy@sha256:e17d77fb030dd4b642dc078d048a5fb9efcb3676ee20305d905949105a6ccd5a

# Temurin includes curl and CA certificates; fail if the base contract changes.
RUN command -v curl

# Local document extraction used by Document Inbox and attachment text review.
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr && rm -rf /var/lib/apt/lists/*

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
    CMD curl -f http://localhost:8080/api/health || exit 1

# Set JVM options for better container performance and Java 11 compatibility
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0 -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"

ENV SPRING_PROFILES_ACTIVE=production
ENV SERVER_SERVLET_CONTEXT_PATH=/

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /home/springuser/app/app.jar"]