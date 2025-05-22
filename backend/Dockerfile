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
VOLUME /tmp

# Copy application from build stage
COPY --from=build /workspace/app/target/*.jar app.jar
COPY --from=build /workspace/app/target/dependency /app/dependency

# Define entry point
ENTRYPOINT ["java", "-jar", "app.jar"]