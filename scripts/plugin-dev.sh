#!/bin/bash

# Plugin Development and Deployment Script
# This script helps with plugin development workflow

set -e

PLUGIN_NAME="sample-logging-plugin"
PLUGIN_VERSION="1.0.0"
PLUGIN_DIR="plugins/${PLUGIN_NAME}"
BUILD_DIR="target"
API_URL="http://localhost:8080/api/plugins"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to create sample plugin project
create_sample_plugin() {
    log_info "Creating sample plugin project: ${PLUGIN_NAME}"
    
    mkdir -p "${PLUGIN_DIR}/src/main/java/com/modulo/plugin/sample"
    mkdir -p "${PLUGIN_DIR}/src/main/resources/META-INF/services"
    mkdir -p "${PLUGIN_DIR}/src/test/java"
    
    # Create pom.xml
    cat > "${PLUGIN_DIR}/pom.xml" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.modulo.plugins</groupId>
    <artifactId>sample-logging-plugin</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <!-- Plugin API (provided by platform) -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>1.7.36</version>
            <scope>provided</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.8.1</version>
            </plugin>
            
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>3.2.4</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                        <configuration>
                            <createDependencyReducedPom>false</createDependencyReducedPom>
                        </configuration>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
EOF
    
    # Create service declaration
    echo "com.modulo.plugin.sample.SampleLoggingPlugin" > "${PLUGIN_DIR}/src/main/resources/META-INF/services/com.modulo.plugin.api.Plugin"
    
    # Create plugin manifest
    cat > "${PLUGIN_DIR}/src/main/resources/plugin.yml" << 'EOF'
name: "sample-logging-plugin"
version: "1.0.0"
description: "A sample plugin that logs note events and provides statistics"
author: "Modulo Team"
type: "internal"
runtime: "jar"

capabilities:
  - "event.logging"
  - "note.statistics"
  - "activity.monitoring"

requires:
  apis:
    - "note.read"
  permissions:
    - "notes.read"
    - "system.events.subscribe"

events:
  subscribe:
    - "note.created"
    - "note.updated"
    - "note.deleted"
    - "note.shared"
    - "note.viewed"
  publish:
    - "statistics.updated"

config:
  log_level:
    type: "string"
    default: "INFO"
    enum: ["DEBUG", "INFO", "WARN", "ERROR"]
    description: "Logging level for plugin events"
  
  stats_interval:
    type: "integer"
    default: 10
    min: 1
    max: 100
    description: "Interval for logging statistics (number of events)"
EOF
    
    log_info "Sample plugin project created in ${PLUGIN_DIR}"
}

# Function to build plugin
build_plugin() {
    log_info "Building plugin: ${PLUGIN_NAME}"
    
    if [[ ! -d "${PLUGIN_DIR}" ]]; then
        log_error "Plugin directory not found: ${PLUGIN_DIR}"
        exit 1
    fi
    
    cd "${PLUGIN_DIR}"
    
    # Copy the plugin implementation from the main project
    cp "../../backend/src/main/java/com/modulo/plugin/sample/SampleLoggingPlugin.java" \
       "src/main/java/com/modulo/plugin/sample/" 2>/dev/null || log_warn "Plugin source not found, using template"
    
    # Build with Maven
    mvn clean package -q
    
    if [[ $? -eq 0 ]]; then
        log_info "Plugin built successfully: target/${PLUGIN_NAME}-${PLUGIN_VERSION}.jar"
    else
        log_error "Plugin build failed"
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to install plugin via API
install_plugin() {
    log_info "Installing plugin via API"
    
    local jar_file="${PLUGIN_DIR}/target/${PLUGIN_NAME}-${PLUGIN_VERSION}.jar"
    
    if [[ ! -f "${jar_file}" ]]; then
        log_error "Plugin JAR not found: ${jar_file}"
        log_info "Run: $0 build first"
        exit 1
    fi
    
    local config='{"log_level":"INFO","stats_interval":10}'
    
    local response=$(curl -s -X POST "${API_URL}/install" \
        -F "file=@${jar_file}" \
        -F "config=${config}" \
        -H "Content-Type: multipart/form-data" \
        2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | grep -q '"success":true'
        if [[ $? -eq 0 ]]; then
            log_info "Plugin installed successfully"
            echo "${response}"
        else
            log_error "Plugin installation failed"
            echo "${response}"
            exit 1
        fi
    else
        log_error "Failed to connect to API"
        exit 1
    fi
}

# Function to uninstall plugin
uninstall_plugin() {
    log_info "Uninstalling plugin: ${PLUGIN_NAME}"
    
    local response=$(curl -s -X DELETE "${API_URL}/${PLUGIN_NAME}" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | grep -q '"success":true'
        if [[ $? -eq 0 ]]; then
            log_info "Plugin uninstalled successfully"
        else
            log_error "Plugin uninstallation failed"
            echo "${response}"
        fi
    else
        log_error "Failed to connect to API"
    fi
}

# Function to check plugin status
status_plugin() {
    log_info "Checking plugin status: ${PLUGIN_NAME}"
    
    local response=$(curl -s -X GET "${API_URL}/${PLUGIN_NAME}/status" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | python3 -m json.tool 2>/dev/null || echo "${response}"
    else
        log_error "Failed to connect to API"
    fi
}

# Function to list all plugins
list_plugins() {
    log_info "Listing all plugins"
    
    local response=$(curl -s -X GET "${API_URL}" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | python3 -m json.tool 2>/dev/null || echo "${response}"
    else
        log_error "Failed to connect to API"
    fi
}

# Function to start plugin
start_plugin() {
    log_info "Starting plugin: ${PLUGIN_NAME}"
    
    local response=$(curl -s -X POST "${API_URL}/${PLUGIN_NAME}/start" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | grep -q '"success":true'
        if [[ $? -eq 0 ]]; then
            log_info "Plugin started successfully"
        else
            log_error "Plugin start failed"
            echo "${response}"
        fi
    else
        log_error "Failed to connect to API"
    fi
}

# Function to stop plugin
stop_plugin() {
    log_info "Stopping plugin: ${PLUGIN_NAME}"
    
    local response=$(curl -s -X POST "${API_URL}/${PLUGIN_NAME}/stop" 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        echo "${response}" | grep -q '"success":true'
        if [[ $? -eq 0 ]]; then
            log_info "Plugin stopped successfully"
        else
            log_error "Plugin stop failed"
            echo "${response}"
        fi
    else
        log_error "Failed to connect to API"
    fi
}

# Function to show usage
usage() {
    cat << EOF
Plugin Development and Deployment Script

Usage: $0 <command>

Commands:
    create      Create sample plugin project
    build       Build plugin JAR
    install     Install plugin via API
    uninstall   Uninstall plugin via API
    start       Start plugin
    stop        Stop plugin
    status      Check plugin status
    list        List all plugins
    dev         Development workflow (build + install + start)
    clean       Clean build artifacts

Examples:
    $0 create           # Create sample plugin project
    $0 build            # Build plugin JAR
    $0 dev              # Build, install, and start plugin
    $0 status           # Check plugin status
    $0 list             # List all plugins

Environment Variables:
    API_URL             Plugin API URL (default: http://localhost:8080/api/plugins)
    PLUGIN_NAME         Plugin name (default: sample-logging-plugin)
    PLUGIN_VERSION      Plugin version (default: 1.0.0)
EOF
}

# Function for development workflow
dev_workflow() {
    log_info "Running development workflow"
    build_plugin
    install_plugin
    start_plugin
    status_plugin
}

# Function to clean build artifacts
clean() {
    log_info "Cleaning build artifacts"
    
    if [[ -d "${PLUGIN_DIR}/target" ]]; then
        rm -rf "${PLUGIN_DIR}/target"
        log_info "Cleaned ${PLUGIN_DIR}/target"
    fi
}

# Main script logic
case "${1:-}" in
    create)
        create_sample_plugin
        ;;
    build)
        build_plugin
        ;;
    install)
        install_plugin
        ;;
    uninstall)
        uninstall_plugin
        ;;
    start)
        start_plugin
        ;;
    stop)
        stop_plugin
        ;;
    status)
        status_plugin
        ;;
    list)
        list_plugins
        ;;
    dev)
        dev_workflow
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        log_error "Unknown command: ${1:-}"
        echo
        usage
        exit 1
        ;;
esac
