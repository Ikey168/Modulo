# Plugin System Architecture & API Design

## Overview

The Modulo Plugin System is designed as a microservices-based architecture that allows developers to extend the platform's functionality through standardized APIs and event hooks. The system supports both internal plugins (JAR-based) and external plugins (gRPC-based microservices).

## Architecture Design

### 1. Plugin Types

#### Internal Plugins (JAR-based)
- **Purpose**: Lightweight extensions that run within the main application process
- **Technology**: Spring Boot components, Java interfaces
- **Use Cases**: Data transformers, custom validators, UI components
- **Deployment**: JAR files loaded at runtime

#### External Plugins (gRPC Microservices)
- **Purpose**: Independent services that extend platform functionality
- **Technology**: gRPC for communication, any programming language
- **Use Cases**: AI/ML services, third-party integrations, heavy computational tasks
- **Deployment**: Independent containers/services

### 2. Plugin Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Modulo Core Application                   │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │ Plugin Manager│  │  Event System   │  │ Plugin APIs  │   │
│  │   - Registry  │  │  - Hooks        │  │  - Note API  │   │
│  │   - Lifecycle │  │  - Publishers   │  │  - User API  │   │
│  │   - Discovery │  │  - Subscribers  │  │  - Search API│   │
│  └───────────────┘  └─────────────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Plugin Layer                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐           ┌─────────────────────────┐   │
│  │ Internal Plugins│           │   External Plugins      │   │
│  │ - JAR Libraries │           │   - gRPC Services       │   │
│  │ - Spring Beans  │<--------->│   - REST APIs           │   │
│  │ - Event Handler │           │   - Message Queues      │   │
│  └─────────────────┘           └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Event System & Hooks

#### Core Events
- **Note Events**: `NoteCreated`, `NoteUpdated`, `NoteDeleted`, `NoteShared`
- **User Events**: `UserLoggedIn`, `UserRegistered`, `UserProfileUpdated`
- **System Events**: `ApplicationStarted`, `ApplicationStopping`, `ConfigUpdated`
- **Blockchain Events**: `NoteRegistered`, `IntegrityVerified`, `TransactionCompleted`

#### Hook Points
- **Pre-Processing Hooks**: Validate/transform data before operations
- **Post-Processing Hooks**: React to completed operations
- **Middleware Hooks**: Intercept and modify requests/responses
- **Scheduling Hooks**: Execute periodic tasks

### 4. Plugin APIs

#### Note API
```java
@PluginAPI
public interface NotePluginAPI {
    // CRUD operations
    Optional<Note> findById(Long id);
    Note save(Note note);
    void delete(Long id);
    List<Note> search(SearchCriteria criteria);
    
    // Event hooks
    void onNoteCreated(Note note);
    void onNoteUpdated(Note oldNote, Note newNote);
    void onNoteDeleted(Note note);
}
```

#### User API
```java
@PluginAPI
public interface UserPluginAPI {
    Optional<User> getCurrentUser();
    Optional<User> findByUsername(String username);
    boolean hasPermission(String permission);
    void addCustomAttribute(String key, Object value);
}
```

#### Search API
```java
@PluginAPI
public interface SearchPluginAPI {
    SearchResult search(String query, SearchOptions options);
    void indexContent(String content, String type, Map<String, Object> metadata);
    void addSearchFilter(SearchFilter filter);
}
```

### 5. gRPC Plugin Protocol

#### Plugin Service Definition
```protobuf
syntax = "proto3";

package modulo.plugin.v1;

service PluginService {
  // Plugin lifecycle
  rpc Initialize(InitializeRequest) returns (InitializeResponse);
  rpc Shutdown(ShutdownRequest) returns (ShutdownResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
  
  // Event handling
  rpc HandleEvent(EventRequest) returns (EventResponse);
  
  // API operations
  rpc ProcessNote(ProcessNoteRequest) returns (ProcessNoteResponse);
  rpc Search(SearchRequest) returns (SearchResponse);
  rpc Transform(TransformRequest) returns (TransformResponse);
}
```

### 6. Plugin Configuration

#### Plugin Manifest (plugin.yml)
```yaml
name: "ai-summarizer"
version: "1.0.0"
description: "AI-powered note summarization plugin"
author: "Modulo Team"
type: "external" # internal | external
runtime: "grpc" # jar | grpc | rest

# Plugin metadata
capabilities:
  - "note.processing"
  - "ai.summarization"
  - "content.analysis"

# API requirements
requires:
  apis:
    - "note.read"
    - "note.write"
  permissions:
    - "notes.process"
    - "ai.analyze"

# Event subscriptions
events:
  subscribe:
    - "note.created"
    - "note.updated"
  publish:
    - "note.summarized"
    - "content.analyzed"

# Configuration schema
config:
  ai_model_url:
    type: "string"
    required: true
    description: "URL to AI model endpoint"
  max_content_length:
    type: "integer"
    default: 10000
    description: "Maximum content length to process"

# Resource requirements (for external plugins)
resources:
  memory: "512Mi"
  cpu: "200m"
  storage: "1Gi"

# Health check configuration
health:
  endpoint: "/health"
  interval: "30s"
  timeout: "10s"
```

### 7. Plugin Discovery & Registry

#### Registry Database Schema
```sql
CREATE TABLE plugin_registry (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL, -- internal, external
    runtime VARCHAR(50) NOT NULL, -- jar, grpc, rest
    status VARCHAR(50) NOT NULL, -- active, inactive, error
    endpoint VARCHAR(500), -- for external plugins
    config_schema TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plugin_events (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT REFERENCES plugin_registry(id),
    event_type VARCHAR(255) NOT NULL,
    event_action VARCHAR(50) NOT NULL, -- subscribe, publish
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plugin_permissions (
    id BIGSERIAL PRIMARY KEY,
    plugin_id BIGINT REFERENCES plugin_registry(id),
    permission VARCHAR(255) NOT NULL,
    granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 8. Security Model

#### Plugin Isolation
- **Sandboxing**: External plugins run in isolated containers
- **Permission System**: Fine-grained access control
- **API Rate Limiting**: Prevent abuse of system resources
- **Data Access Control**: Plugins only access permitted data

#### Authentication & Authorization
```java
@Component
public class PluginSecurityManager {
    public boolean hasPermission(String pluginId, String permission);
    public String generatePluginToken(String pluginId);
    public boolean validatePluginToken(String token);
    public void revokePluginAccess(String pluginId);
}
```

### 9. Development Workflow

#### Plugin Development Lifecycle
1. **Design**: Define plugin capabilities and requirements
2. **Implement**: Create plugin following API specifications
3. **Test**: Use plugin SDK for local testing
4. **Package**: Create plugin package with manifest
5. **Deploy**: Install plugin via Plugin Manager
6. **Monitor**: Track plugin performance and health

#### Plugin SDK
- **Java SDK**: For internal plugin development
- **gRPC SDK**: For external plugin development (multi-language)
- **Testing Framework**: Mock APIs and event simulation
- **Documentation Tools**: API reference and examples

### 10. Deployment & Operations

#### Plugin Installation
```bash
# Install from file
modulo plugin install ./my-plugin.jar

# Install from repository
modulo plugin install --repo https://plugins.modulo.com ai-summarizer

# List plugins
modulo plugin list

# Enable/disable plugin
modulo plugin enable ai-summarizer
modulo plugin disable ai-summarizer
```

#### Monitoring & Observability
- **Health Checks**: Regular plugin health monitoring
- **Metrics**: Performance and usage statistics
- **Logging**: Centralized plugin log aggregation
- **Alerting**: Plugin failure notifications

### 11. Plugin Repository

#### Plugin Store Architecture
- **Registry API**: Discover and download plugins
- **Version Management**: Handle plugin updates
- **Security Scanning**: Automated security checks
- **Community Reviews**: User ratings and feedback

### 12. Migration Strategy

#### Phase 1: Core Infrastructure
- Implement Plugin Manager and Registry
- Create basic event system
- Define API interfaces

#### Phase 2: Internal Plugin Support
- JAR-based plugin loading
- Spring Bean integration
- Basic event hooks

#### Phase 3: External Plugin Support
- gRPC service integration
- Container orchestration
- Advanced security features

#### Phase 4: Plugin Ecosystem
- Plugin repository
- Development tools
- Community features

## Benefits

### For Developers
- **Extensibility**: Easy platform customization
- **Flexibility**: Multiple implementation options
- **Reusability**: Share plugins across installations
- **Independence**: Develop in preferred languages

### For Users
- **Customization**: Tailor platform to specific needs
- **Integration**: Connect with existing tools
- **Innovation**: Access to community-developed features
- **Scalability**: Add functionality without core changes

### For Platform
- **Modularity**: Cleaner core architecture
- **Performance**: Offload heavy tasks to external services
- **Maintenance**: Easier updates and bug fixes
- **Community**: Foster ecosystem development

## Next Steps

1. **Implement Core Plugin Manager** (Phase 1)
2. **Create Plugin API Interfaces** (Phase 1)
3. **Build Event System** (Phase 1)
4. **Develop Sample Plugins** (Phase 2)
5. **Create Plugin SDK** (Phase 2)
6. **Document Development Guidelines** (Phase 2)

This architecture provides a solid foundation for a flexible, secure, and scalable plugin system that can grow with the platform's needs.
