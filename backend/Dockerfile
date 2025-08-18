# Build stage - Multi-arch compatible with Java 11
FROM eclipse-temurin:11-jdk AS build
WORKDIR /workspace/app

# Set JAVA_HOME for Java 11
ENV JAVA_HOME=/opt/java/openjdk

# Install Maven in a single optimized layer with better mirror
RUN apt-get update && \
    apt-get install -y --no-install-recommends maven && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    mkdir -p /root/.m2 && \
    echo '<settings><mirrors><mirror><id>central</id><url>https://repo1.maven.org/maven2</url><mirrorOf>central</mirrorOf></mirror></mirrors></settings>' > /root/.m2/settings.xml

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies using Maven (use parallel downloads and offline mode)
RUN mvn dependency:go-offline -T 2C --batch-mode --quiet

# Copy source code
COPY src src

# Build application with optimizations (parallel build, skip tests, quiet mode)
RUN mvn clean install -DskipTests -T 2C --batch-mode --quiet -Dmaven.compiler.source=11 -Dmaven.compiler.target=11

# Runtime stage - Multi-arch with enhanced security (Java 11 for consistency)
FROM eclipse-temurin:11-jre-jammy

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

# Set JVM options for better container performance and Java 11 compatibility
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0 -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom -Dspring.profiles.active=production"

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /home/springuser/app/app.jar"]