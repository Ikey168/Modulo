# OpenTelemetry Implementation for Modulo Backend

This document describes the comprehensive OpenTelemetry observability implementation for the Modulo platform, providing distributed tracing, metrics collection, and log correlation.

## Overview

The implementation includes:
- **Distributed Tracing**: End-to-end request tracing across all services
- **Custom Metrics**: Business-specific metrics using Micrometer + Prometheus
- **Log Correlation**: Automatic trace/span ID injection into logs
- **Automatic Instrumentation**: Aspect-based tracing for services and repositories
- **Kubernetes Integration**: Complete observability stack deployment

## Architecture

```
Application Layer
├── Controllers (HTTP endpoints)
├── Services (Business logic)
└── Repositories (Data access)
       ↓
OpenTelemetry SDK
├── Tracing (distributed traces)
├── Metrics (custom + JVM metrics)
└── Logging (with trace correlation)
       ↓
OpenTelemetry Collector
├── Receives telemetry data
├── Processes and enriches
└── Routes to backends
       ↓
Observability Backends
├── Tempo (traces)
├── Prometheus (metrics)
├── Loki (logs)
└── Grafana (visualization)
```

## Features Implemented

### 1. Distributed Tracing

#### Automatic Instrumentation
- HTTP requests/responses (Spring WebMVC)
- Database queries (JDBC + Hibernate)
- WebSocket connections and messages
- gRPC calls
- Service method calls (via AOP)

#### Manual Tracing
- `TracingService` for custom spans
- `@Traced` annotation for method-level tracing
- Manual span creation and attribute setting
- Event recording with custom attributes

#### Example Usage
```java
@Service
public class NoteService {
    
    @Traced("note.create")  // Automatic tracing
    public Note createNote(Note note) {
        // Business logic here
        return note;
    }
    
    public void complexOperation() {
        // Manual tracing
        tracingService.traceFunction("note.complex_operation", () -> {
            // Complex business logic
            tracingService.addAttribute("complexity", "high");
            tracingService.addEvent("processing_started");
            // ... processing ...
            tracingService.addEvent("processing_completed");
            return result;
        });
    }
}
```

### 2. Custom Metrics

#### Business Metrics
- Note operations (created, updated, deleted)
- User activities (login, logout)
- WebSocket connections and messages
- Blockchain transactions
- API errors and performance

#### Performance Metrics
- HTTP request duration (percentiles)
- Database query timing
- Custom operation timing
- Error rates and counts

#### Example Usage
```java
@RestController
public class NoteController {
    
    @PostMapping("/notes")
    public Note createNote(@RequestBody Note note) {
        Note created = noteService.createNote(note);
        
        // Record custom metrics
        observabilityService.recordNoteCreated(created.getId(), created.getUserId());
        
        return created;
    }
}
```

### 3. Log Correlation

#### Automatic Correlation
- Trace ID and Span ID automatically added to MDC
- Structured logging with JSON format
- Log level configuration per environment
- Custom log patterns with trace context

#### Log Format
```json
{
  "@timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "thread": "http-nio-8080-exec-1",
  "logger": "com.modulo.service.NoteService",
  "message": "Note created successfully",
  "traceId": "1234567890abcdef1234567890abcdef",
  "spanId": "abcdef1234567890",
  "service": "modulo-backend",
  "version": "1.0.0"
}
```

### 4. Aspect-Based Tracing

#### Automatic Service Tracing
All `@Service` classes are automatically traced:
```java
@Service
public class NoteService {
    // All public methods automatically traced
    public Note findById(String id) { ... }
    public List<Note> findByUser(String userId) { ... }
}
```

#### Repository Tracing
All `@Repository` classes are automatically traced with database context:
```java
@Repository
public interface NoteRepository extends JpaRepository<Note, String> {
    // All methods automatically traced with db.* attributes
}
```

#### Custom Tracing Control
```java
@Service
public class SomeService {
    
    @Traced("custom.operation.name")
    public void customOperation() { ... }
    
    @NoTrace  // Exclude from automatic tracing
    public void utilityMethod() { ... }
}
```

## Configuration

### Application Properties

#### Development (application-dev.properties)
```properties
# High sampling for development
otel.traces.sampler.arg=1.0
otel.exporter.otlp.endpoint=http://localhost:4317

# Debug logging
logging.level.io.opentelemetry=DEBUG
```

#### Production (application-kubernetes.properties)
```properties
# Lower sampling for production
otel.traces.sampler.arg=0.1
otel.exporter.otlp.endpoint=http://otel-collector.observability.svc.cluster.local:4317

# Production logging
logging.level.io.opentelemetry=INFO
```

### Environment Variables

#### Kubernetes Deployment
```yaml
env:
- name: OTEL_SERVICE_NAME
  value: "modulo-backend"
- name: OTEL_TRACES_EXPORTER
  value: "otlp"
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "http://otel-collector.observability.svc.cluster.local:4317"
```

## Observability Stack

### Components

1. **OpenTelemetry Collector**
   - Receives telemetry data from applications
   - Processes and enriches data
   - Routes to appropriate backends

2. **Tempo**
   - Distributed tracing storage
   - Grafana integration for trace exploration
   - 7-day retention policy

3. **Prometheus**
   - Metrics collection and storage
   - Alerting rules configuration
   - Service discovery for Kubernetes

4. **Loki**
   - Log aggregation and storage
   - 30-day retention policy
   - Grafana integration for log exploration

5. **Grafana**
   - Unified observability dashboard
   - Pre-configured dashboards
   - Data source correlation

### Deployment

```bash
# Deploy complete observability stack
kubectl apply -f k8s/observability/

# Access Grafana
kubectl port-forward svc/grafana 3000:3000 -n observability
# Visit http://localhost:3000 (admin/admin)

# Access Prometheus
kubectl port-forward svc/prometheus 9090:9090 -n observability
# Visit http://localhost:9090
```

## Dashboards and Monitoring

### Pre-configured Dashboards

1. **Modulo Overview**
   - Request rate and error rate
   - Response time percentiles
   - Active user connections
   - Business metrics

2. **HTTP Performance**
   - Request duration distributions
   - Error rate by endpoint
   - Traffic patterns

3. **Database Performance**
   - Query duration and frequency
   - Connection pool metrics
   - Slow query identification

4. **WebSocket Metrics**
   - Connection counts
   - Message rates
   - Session duration

### Alerts Configuration

```yaml
# High error rate alert
- alert: HighErrorRate
  expr: rate(modulo_api_errors_total[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "High error rate detected"

# High latency alert
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m])) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High latency detected"
```

## Demo Endpoints

The implementation includes demo endpoints for testing observability features:

```bash
# Generate traces
curl http://localhost:8080/api/v1/observability/demo/traces

# Test error handling
curl "http://localhost:8080/api/v1/observability/demo/errors?shouldFail=true"

# Generate metrics
curl http://localhost:8080/api/v1/observability/demo/metrics

# Performance testing
curl "http://localhost:8080/api/v1/observability/demo/performance?delayMs=500"
```

## Troubleshooting

### Common Issues

1. **Traces not appearing**
   - Check OpenTelemetry Collector logs
   - Verify OTLP endpoint configuration
   - Check sampling configuration

2. **Metrics missing**
   - Verify Prometheus scraping configuration
   - Check application `/actuator/prometheus` endpoint
   - Verify Kubernetes service discovery

3. **Log correlation not working**
   - Check Logback configuration
   - Verify MDC instrumentation is enabled
   - Check log format configuration

### Debugging Commands

```bash
# Check OpenTelemetry Collector logs
kubectl logs deployment/otel-collector -n observability

# Check application metrics endpoint
curl http://localhost:8080/actuator/prometheus

# Verify trace export
kubectl logs deployment/spring-boot-api -n modulo | grep -i trace

# Check Grafana data sources
kubectl port-forward svc/grafana 3000:3000 -n observability
# Go to Configuration > Data Sources
```

## Performance Considerations

### Sampling Strategies

- **Development**: 100% sampling for debugging
- **Production**: 10% sampling to balance observability and performance
- **Critical paths**: Always sample important business operations

### Resource Usage

- **Memory overhead**: ~50-100MB per application instance
- **CPU overhead**: ~2-5% additional CPU usage
- **Network overhead**: Compressed OTLP export reduces bandwidth

### Best Practices

1. Use appropriate sampling rates for each environment
2. Implement custom metrics for business KPIs
3. Use structured logging with trace correlation
4. Monitor the observability stack itself
5. Set up alerting for critical application metrics

## Integration Examples

### Service Integration
```java
@Service
@RequiredArgsConstructor
public class NoteService {
    private final ObservabilityService observabilityService;
    
    public Note createNote(Note note) {
        return observabilityService.recordNoteSaveOperation(note.getId(), () -> {
            Note saved = noteRepository.save(note);
            observabilityService.recordNoteCreated(saved.getId(), saved.getUserId());
            return saved;
        });
    }
}
```

### Controller Integration
```java
@RestController
@RequiredArgsConstructor
public class NoteController {
    
    @PostMapping("/notes")
    @Traced("api.notes.create")
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        try {
            Note created = noteService.createNote(note);
            return ResponseEntity.ok(created);
        } catch (Exception e) {
            observabilityService.recordApiError("/api/notes", "creation_error", e.getMessage());
            throw e;
        }
    }
}
```

This comprehensive OpenTelemetry implementation provides complete observability for the Modulo platform, enabling effective monitoring, debugging, and performance optimization.
