# Plugin Development Guide

## Overview

The Modulo Plugin System allows developers to extend the platform's functionality through standardized APIs and event hooks. This guide covers everything you need to know to develop, test, and deploy plugins for the Modulo platform.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Types](#plugin-types)
3. [Development Setup](#development-setup)
4. [Creating Your First Plugin](#creating-your-first-plugin)
5. [Plugin APIs](#plugin-apis)
6. [Event System](#event-system)
7. [Configuration](#configuration)
8. [Security & Permissions](#security--permissions)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Best Practices](#best-practices)
12. [Examples](#examples)

## Getting Started

### Prerequisites

- Java 11 or higher
- Maven 3.6+
- Basic understanding of Spring Boot (for internal plugins)
- Docker (for external plugins)

### Plugin Development Kit (PDK)

The Plugin Development Kit provides all necessary dependencies and tools:

```xml
<dependency>
    <groupId>com.modulo</groupId>
    <artifactId>plugin-api</artifactId>
    <version>1.0.0</version>
</dependency>
```

## Plugin Types

### Internal Plugins (JAR-based)

**Best for:**
- Lightweight extensions
- Data transformers
- Custom validators
- UI components

**Characteristics:**
- Run within the main application process
- Shared JVM memory
- Direct access to Spring beans
- Faster execution

### External Plugins (gRPC/REST-based)

**Best for:**
- Heavy computational tasks
- AI/ML services
- Third-party integrations
- Language-specific implementations

**Characteristics:**
- Run as independent services
- Process isolation
- Language agnostic
- Horizontal scaling

## Development Setup

### 1. Create Plugin Project

```bash
mkdir my-plugin
cd my-plugin
```

### 2. Maven Project Structure

```
my-plugin/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/example/plugin/
│   │   │       └── MyPlugin.java
│   │   └── resources/
│   │       ├── META-INF/
│   │       │   └── services/
│   │       │       └── com.modulo.plugin.api.Plugin
│   │       └── plugin.yml
│   └── test/
└── README.md
```

### 3. pom.xml Configuration

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>my-plugin</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <modulo.version>1.0.0</modulo.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.modulo</groupId>
            <artifactId>plugin-api</artifactId>
            <version>${modulo.version}</version>
            <scope>provided</scope>
        </dependency>
        
        <!-- Logging -->
        <dependency>
            <groupId>org.slf4j</groupId>
            <artifactId>slf4j-api</artifactId>
            <version>1.7.36</version>
            <scope>provided</scope>
        </dependency>
        
        <!-- Testing -->
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
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
```

## Creating Your First Plugin

### 1. Plugin Implementation

```java
package com.example.plugin;

import com.modulo.plugin.api.*;
import com.modulo.plugin.event.PluginEvent;
import com.modulo.plugin.event.NoteEvent;
import com.modulo.plugin.manager.PluginEventHandler;

import java.util.*;

public class MyPlugin implements Plugin, PluginEventHandler {
    
    private Map<String, Object> config;
    private boolean running = false;
    
    @Override
    public PluginInfo getInfo() {
        return new PluginInfo(
            "my-plugin",
            "1.0.0",
            "My first Modulo plugin",
            "Your Name",
            PluginType.INTERNAL,
            PluginRuntime.JAR
        );
    }
    
    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        this.config = config;
        // Initialization logic here
    }
    
    @Override
    public void start() throws PluginException {
        running = true;
        // Startup logic here
    }
    
    @Override
    public void stop() throws PluginException {
        running = false;
        // Cleanup logic here
    }
    
    @Override
    public HealthCheck healthCheck() {
        return running ? 
            HealthCheck.healthy("Plugin is running") : 
            HealthCheck.unhealthy("Plugin is not running");
    }
    
    @Override
    public List<String> getCapabilities() {
        return Arrays.asList("note.processing");
    }
    
    @Override
    public List<String> getRequiredPermissions() {
        return Arrays.asList("notes.read", "notes.write");
    }
    
    @Override
    public List<String> getSubscribedEvents() {
        return Arrays.asList("note.created", "note.updated");
    }
    
    @Override
    public List<String> getPublishedEvents() {
        return Arrays.asList("note.processed");
    }
    
    @Override
    public void handleEvent(PluginEvent event) {
        if (event instanceof NoteEvent.NoteCreated) {
            // Handle note created event
            NoteEvent.NoteCreated noteCreated = (NoteEvent.NoteCreated) event;
            // Process the note...
        }
    }
}
```

### 2. Service Declaration

Create `src/main/resources/META-INF/services/com.modulo.plugin.api.Plugin`:

```
com.example.plugin.MyPlugin
```

### 3. Plugin Manifest

Create `src/main/resources/plugin.yml`:

```yaml
name: "my-plugin"
version: "1.0.0"
description: "My first Modulo plugin"
author: "Your Name"
type: "internal"
runtime: "jar"

capabilities:
  - "note.processing"

requires:
  apis:
    - "note.read"
    - "note.write"
  permissions:
    - "notes.read"
    - "notes.write"

events:
  subscribe:
    - "note.created"
    - "note.updated"
  publish:
    - "note.processed"

config:
  processing_enabled:
    type: "boolean"
    default: true
    description: "Enable note processing"
  max_content_length:
    type: "integer"
    default: 10000
    description: "Maximum content length to process"
```

## Plugin APIs

### Note API

```java
@Autowired
private NotePluginAPI noteAPI;

// Read operations
Optional<Note> note = noteAPI.findById(1L);
List<Note> notes = noteAPI.findByUserId(userId);
List<Note> searchResults = noteAPI.search(
    new SearchCriteria("search term").withLimit(10)
);

// Write operations
Note newNote = new Note();
newNote.setTitle("Created by plugin");
newNote.setContent("This note was created by a plugin");
Note saved = noteAPI.save(newNote);

// Metadata operations
noteAPI.addMetadata(noteId, Map.of("processed", true, "processor", "my-plugin"));
Map<String, Object> metadata = noteAPI.getMetadata(noteId);
```

### User API

```java
@Autowired
private UserPluginAPI userAPI;

// Get current user
Optional<User> currentUser = userAPI.getCurrentUser();

// Check permissions
boolean canWrite = userAPI.hasPermission("notes.write");
boolean isAdmin = userAPI.hasRole("ADMIN");

// Custom attributes
userAPI.addCustomAttribute("plugin_preference", "value");
Object preference = userAPI.getCustomAttribute("plugin_preference");

// User preferences
UserPreferences prefs = userAPI.getPreferences();
prefs.setPluginSetting("my-plugin", "setting1", "value1");
userAPI.updatePreferences(prefs);
```

## Event System

### Subscribing to Events

```java
@Override
public void handleEvent(PluginEvent event) {
    switch (event.getType()) {
        case "note.created":
            handleNoteCreated((NoteEvent.NoteCreated) event);
            break;
        case "note.updated":
            handleNoteUpdated((NoteEvent.NoteUpdated) event);
            break;
        case "user.logged_in":
            handleUserLogin((UserEvent.UserLoggedIn) event);
            break;
    }
}

private void handleNoteCreated(NoteEvent.NoteCreated event) {
    Note note = event.getNote();
    // Process new note
}
```

### Publishing Events

```java
@Autowired
private PluginEventBus eventBus;

// Publish custom event
PluginEvent customEvent = new CustomEvent("note.processed", processedNote);
eventBus.publish(customEvent);

// Publish asynchronously
eventBus.publishAsync(customEvent);
```

## Configuration

### Configuration Schema

Define configuration schema in `plugin.yml`:

```yaml
config:
  api_key:
    type: "string"
    required: true
    description: "API key for external service"
    sensitive: true
  
  batch_size:
    type: "integer"
    default: 100
    min: 1
    max: 1000
    description: "Batch size for processing"
  
  enabled_features:
    type: "array"
    items:
      type: "string"
      enum: ["feature1", "feature2", "feature3"]
    default: ["feature1"]
    description: "List of enabled features"
  
  processing_rules:
    type: "object"
    properties:
      max_length:
        type: "integer"
        default: 5000
      ignore_patterns:
        type: "array"
        items:
          type: "string"
    description: "Processing rules configuration"
```

### Using Configuration

```java
@Override
public void initialize(Map<String, Object> config) throws PluginException {
    String apiKey = (String) config.get("api_key");
    if (apiKey == null || apiKey.isEmpty()) {
        throw new PluginException("API key is required");
    }
    
    Integer batchSize = (Integer) config.getOrDefault("batch_size", 100);
    
    @SuppressWarnings("unchecked")
    List<String> enabledFeatures = (List<String>) config.get("enabled_features");
    
    // Initialize with configuration
}
```

## Security & Permissions

### Permission System

```java
// Required permissions in plugin
@Override
public List<String> getRequiredPermissions() {
    return Arrays.asList(
        "notes.read",           // Read notes
        "notes.write",          // Create/update notes
        "notes.delete",         // Delete notes
        "users.read",           // Read user information
        "system.events.publish", // Publish system events
        "attachments.read"      // Read attachments
    );
}
```

### Security Best Practices

1. **Principle of Least Privilege**: Request only necessary permissions
2. **Input Validation**: Validate all inputs from external sources
3. **Secure Configuration**: Mark sensitive config as `sensitive: true`
4. **Error Handling**: Don't expose sensitive information in error messages
5. **Logging**: Log security-relevant events for auditing

```java
// Secure input validation
private void validateInput(String input) throws PluginException {
    if (input == null || input.trim().isEmpty()) {
        throw new PluginException("Input cannot be empty");
    }
    
    if (input.length() > MAX_INPUT_LENGTH) {
        throw new PluginException("Input too long");
    }
    
    // Validate against allowed patterns
    if (!ALLOWED_PATTERN.matcher(input).matches()) {
        throw new PluginException("Invalid input format");
    }
}
```

## Testing

### Unit Testing

```java
import org.junit.Test;
import static org.junit.Assert.*;

public class MyPluginTest {
    
    @Test
    public void testPluginInitialization() throws PluginException {
        MyPlugin plugin = new MyPlugin();
        Map<String, Object> config = Map.of(
            "api_key", "test-key",
            "batch_size", 50
        );
        
        plugin.initialize(config);
        plugin.start();
        
        HealthCheck health = plugin.healthCheck();
        assertTrue("Plugin should be healthy", health.isHealthy());
        
        plugin.stop();
    }
    
    @Test
    public void testEventHandling() {
        MyPlugin plugin = new MyPlugin();
        
        Note testNote = new Note();
        testNote.setId(1L);
        testNote.setTitle("Test Note");
        
        NoteEvent.NoteCreated event = new NoteEvent.NoteCreated(testNote);
        plugin.handleEvent(event);
        
        // Verify event was processed correctly
    }
}
```

### Integration Testing

```java
@Test
public void testPluginInstallation() throws Exception {
    // Build plugin JAR
    Path pluginJar = buildPluginJar();
    
    // Install plugin
    String pluginId = pluginManager.installPlugin(
        pluginJar.toString(), 
        Map.of("api_key", "test-key")
    );
    
    // Verify installation
    assertEquals(PluginStatus.ACTIVE, pluginManager.getPluginStatus(pluginId));
    
    // Test functionality
    Plugin plugin = pluginManager.getPlugin(pluginId);
    assertNotNull(plugin);
    assertTrue(plugin.healthCheck().isHealthy());
    
    // Cleanup
    pluginManager.uninstallPlugin(pluginId);
}
```

## Deployment

### Building Plugin

```bash
mvn clean package
```

This creates `target/my-plugin-1.0.0.jar` ready for deployment.

### Installation via API

```bash
curl -X POST http://localhost:8080/api/plugins/install \
  -F "file=@my-plugin-1.0.0.jar" \
  -F 'config={"api_key":"your-key","batch_size":100}' \
  -H "Authorization: Bearer your-token"
```

### Installation via CLI

```bash
# Install plugin
modulo plugin install ./my-plugin-1.0.0.jar

# Configure plugin
modulo plugin config my-plugin api_key=your-key

# Start plugin
modulo plugin start my-plugin

# Check status
modulo plugin status my-plugin
```

## Best Practices

### 1. Error Handling

```java
@Override
public void handleEvent(PluginEvent event) {
    try {
        // Process event
    } catch (Exception e) {
        logger.error("Failed to process event: " + event.getType(), e);
        // Don't rethrow - let other plugins continue
    }
}
```

### 2. Resource Management

```java
private ExecutorService executor;

@Override
public void start() throws PluginException {
    executor = Executors.newFixedThreadPool(
        (Integer) config.getOrDefault("thread_pool_size", 5)
    );
}

@Override
public void stop() throws PluginException {
    if (executor != null) {
        executor.shutdown();
        try {
            if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
                executor.shutdownNow();
            }
        } catch (InterruptedException e) {
            executor.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
```

### 3. Performance Monitoring

```java
@Override
public HealthCheck healthCheck() {
    long startTime = System.currentTimeMillis();
    
    try {
        // Perform health checks
        checkExternalService();
        checkMemoryUsage();
        checkThreadPoolHealth();
        
        long responseTime = System.currentTimeMillis() - startTime;
        return new HealthCheck(
            HealthCheck.Status.HEALTHY,
            "All systems operational",
            responseTime
        );
    } catch (Exception e) {
        return HealthCheck.unhealthy("Health check failed: " + e.getMessage());
    }
}
```

### 4. Configuration Validation

```java
@Override
public void initialize(Map<String, Object> config) throws PluginException {
    validateConfig(config);
    this.config = config;
}

private void validateConfig(Map<String, Object> config) throws PluginException {
    // Validate required fields
    if (!config.containsKey("api_key")) {
        throw new PluginException("api_key is required");
    }
    
    // Validate types and ranges
    Object batchSize = config.get("batch_size");
    if (batchSize != null && !(batchSize instanceof Integer)) {
        throw new PluginException("batch_size must be an integer");
    }
    
    Integer batchSizeInt = (Integer) batchSize;
    if (batchSizeInt != null && (batchSizeInt < 1 || batchSizeInt > 1000)) {
        throw new PluginException("batch_size must be between 1 and 1000");
    }
}
```

## Examples

### Text Summarization Plugin

```java
public class TextSummarizerPlugin implements Plugin, PluginEventHandler {
    
    private SummaryService summaryService;
    
    @Override
    public void initialize(Map<String, Object> config) throws PluginException {
        String modelUrl = (String) config.get("model_url");
        this.summaryService = new SummaryService(modelUrl);
    }
    
    @Override
    public void handleEvent(PluginEvent event) {
        if (event instanceof NoteEvent.NoteCreated) {
            NoteEvent.NoteCreated noteCreated = (NoteEvent.NoteCreated) event;
            Note note = noteCreated.getNote();
            
            if (shouldSummarize(note)) {
                String summary = summaryService.summarize(note.getContent());
                noteAPI.addMetadata(note.getId(), Map.of(
                    "summary", summary,
                    "summarized_by", "text-summarizer-plugin",
                    "summarized_at", LocalDateTime.now()
                ));
            }
        }
    }
    
    private boolean shouldSummarize(Note note) {
        return note.getContent().length() > 1000 && 
               !note.getContent().contains("[NO_SUMMARY]");
    }
}
```

### Data Export Plugin

```java
public class DataExportPlugin implements Plugin {
    
    @Override
    public void handleEvent(PluginEvent event) {
        if (event instanceof SystemEvent.ScheduledTaskExecuted) {
            String taskName = ((SystemEvent.ScheduledTaskExecuted) event).getTaskName();
            if ("daily_export".equals(taskName)) {
                performDailyExport();
            }
        }
    }
    
    private void performDailyExport() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        
        SearchCriteria criteria = new SearchCriteria()
            .withQuery("created:" + yesterday)
            .withLimit(1000);
            
        List<Note> notes = noteAPI.search(criteria);
        
        String exportData = convertToCSV(notes);
        
        // Upload to cloud storage or send via email
        uploadExport(exportData, "notes_" + yesterday + ".csv");
    }
}
```

## Support & Resources

- **Documentation**: https://docs.modulo.com/plugins
- **API Reference**: https://api.modulo.com/plugins
- **Examples**: https://github.com/modulo/plugin-examples
- **Community**: https://community.modulo.com/plugins
- **Support**: plugins@modulo.com

Happy plugin development! 🚀
