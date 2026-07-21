# script-sandbox plugin workload (#393) — build from the REPO ROOT context:
#   docker build -f services/script-sandbox-plugin/Dockerfile .
# (the service compiles the shared sandbox engine sources from backend/ and
# the contract stubs from plugin-contract/, so it needs the wider context).
# Multi-arch compatible: Temurin publishes arm64 (Pi path, #386); the whole
# stack is pure JVM — no JNI.

FROM eclipse-temurin:17-jdk AS build
RUN apt-get update && apt-get install -y --no-install-recommends maven && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace

# Reactor skeleton: root + module poms (backend/smart-contracts poms are
# needed only so the reactor parses; their sources are not built).
COPY pom.xml ./
COPY plugin-contract/pom.xml plugin-contract/
COPY backend/pom.xml backend/
COPY smart-contracts/pom.xml smart-contracts/
COPY services/script-sandbox-plugin/pom.xml services/script-sandbox-plugin/

# Sources the service actually consumes
COPY backend/src/main/proto backend/src/main/proto
COPY backend/src/main/java/com/modulo/blueprint/sandbox backend/src/main/java/com/modulo/blueprint/sandbox
COPY plugin-contract/README.md plugin-contract/
COPY services/script-sandbox-plugin/src services/script-sandbox-plugin/src

RUN mvn -q -pl services/script-sandbox-plugin -am package -DskipTests

FROM eclipse-temurin:17-jre-jammy
RUN groupadd -g 1001 sandbox && useradd -u 1001 -g sandbox -s /usr/sbin/nologin sandbox
COPY --from=build /workspace/services/script-sandbox-plugin/target/script-sandbox-plugin-*.jar /app/app.jar
USER sandbox
EXPOSE 9090
ENV PORT=9090 SANDBOX_ENGINE=wasm
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
