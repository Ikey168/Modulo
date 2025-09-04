# Audit Logging & Decision Tracing Implementation

This document describes the comprehensive audit logging and decision tracing system for OPA authorization decisions in the Modulo platform.

## 🎯 Overview

The audit logging system provides complete visibility into authorization decisions, enabling security teams to understand who did what, when, and why requests were allowed or denied. The system integrates with OpenTelemetry for distributed tracing and provides searchable, PII-safe audit logs.

## 🏗️ Architecture

```
Client Request → Envoy Proxy → OPA Decision Engine → Backend Service
     ↓              ↓              ↓                    ↓
Trace Context → Trace Headers → Decision Logs → Application Logs
     ↓              ↓              ↓                    ↓
OpenTelemetry → Jaeger/Tempo → Loki/ElasticSearch → Grafana Dashboard
```

## 📊 Decision Log Structure

### Core Decision Log Format
```json
{
  "timestamp": "2025-09-04T10:30:45.123Z",
  "decision_id": "dec_7f8a9b2c3d4e5f6g",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "request_id": "req_1234567890abcdef",
  "user": {
    "id": "user_12345",
    "username": "john.doe",
    "email": "john.doe@company.com",
    "tenant": "acme-corp",
    "roles": ["workspace_editor", "note_owner"]
  },
  "request": {
    "method": "POST",
    "path": "/api/v1/notes",
    "resource_type": "note",
    "resource_id": "note_67890",
    "action": "create",
    "workspace": "project-alpha"
  },
  "decision": {
    "allow": true,
    "policy_id": "notes_authorization",
    "rule": "allow_note_create",
    "reason": "User has workspace_editor role in project-alpha",
    "evaluation_time_ms": 5.2
  },
  "metadata": {
    "client_ip": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "correlation_id": "corr_abc123def456",
    "session_id": "sess_xyz789uvw012"
  }
}
```

### PII-Safe Configuration
```yaml
# Fields to exclude from logs to protect PII
pii_exclusion:
  - "request.body"
  - "request.headers.authorization"
  - "user.email_details"
  - "metadata.sensitive_attributes"
  
# Fields to hash for correlation while preserving privacy
hash_fields:
  - "user.email"
  - "metadata.user_agent"
  
# Maximum field lengths to prevent log explosion
max_lengths:
  request_path: 256
  user_agent: 512
  reason: 1024
```

## 🔧 Implementation Components

### 1. OPA Decision Logger Configuration

#### OPA Configuration (`infra/opa/config.yaml`)
```yaml
decision_logs:
  console: false
  service: decision_logger
  
services:
  decision_logger:
    url: http://audit-collector:8080/v1/decisions
    headers:
      Authorization: Bearer ${AUDIT_SERVICE_TOKEN}
      Content-Type: application/json
    
bundles:
  authz:
    service: bundle_server
    resource: bundles/authorization.tar.gz

plugins:
  envoy_ext_authz_grpc:
    addr: ":9191"
    query: data.envoy.authz.allow
    enable_reflection: true
    
server:
  encoding:
    gzip: true
    
status:
  console: true
  prometheus: true
```

#### Enhanced OPA Policy with Audit Logging (`policy/audit_enhanced_authorization.rego`)
```rego
package envoy.authz

import rego.v1

# Import audit utilities
import data.audit.utils as audit_utils
import data.audit.pii as pii_utils

default allow := {
    "allowed": false,
    "headers": {},
    "body": "",
    "http_status": 403,
    "audit": {
        "decision": "deny",
        "reason": "Default deny policy",
        "rule": "default_deny",
        "policy_id": "envoy_authz"
    }
}

# Main authorization decision with audit trail
allow := decision if {
    # Extract request context
    request_context := extract_request_context(input)
    user_context := extract_user_context(input)
    
    # Evaluate authorization
    authz_result := evaluate_authorization(request_context, user_context)
    
    # Build decision with audit information
    decision := build_decision_response(authz_result, request_context, user_context)
}

# Extract request context for audit logging
extract_request_context(input) := context if {
    context := {
        "method": input.attributes.request.http.method,
        "path": input.attributes.request.http.path,
        "headers": sanitize_headers(input.attributes.request.http.headers),
        "source_ip": input.attributes.source.address.socket_address.address,
        "destination": input.attributes.destination.address.socket_address.address,
        "request_id": input.attributes.request.http.headers["x-request-id"],
        "trace_id": input.attributes.request.http.headers["x-trace-id"],
        "span_id": input.attributes.request.http.headers["x-span-id"]
    }
}

# Extract user context from JWT token
extract_user_context(input) := context if {
    # Extract JWT from Authorization header
    auth_header := input.attributes.request.http.headers.authorization
    token := substring(auth_header, 7, -1) # Remove "Bearer "
    
    # Decode JWT payload (simplified - in practice use proper JWT library)
    payload := json.unmarshal(base64url.decode(split(token, ".")[1]))
    
    context := {
        "user_id": payload.sub,
        "username": payload.preferred_username,
        "email": pii_utils.hash_email(payload.email),
        "tenant": payload.tenant,
        "roles": payload.realm_access.roles,
        "workspaces": payload.workspaces,
        "session_id": payload.sid
    }
}

# Evaluate authorization based on resource and action
evaluate_authorization(request_context, user_context) := result if {
    # Determine resource type and action
    resource_info := parse_resource_info(request_context.path, request_context.method)
    
    # Check permissions based on resource type
    allowed := check_resource_permission(resource_info, user_context)
    
    # Determine which rule matched
    matched_rule := get_matched_rule(resource_info, user_context, allowed)
    
    result := {
        "allowed": allowed,
        "resource": resource_info,
        "rule": matched_rule,
        "evaluation_time": time.now_ns()
    }
}

# Build comprehensive decision response with audit data
build_decision_response(authz_result, request_context, user_context) := response if {
    # Base response
    base_response := {
        "allowed": authz_result.allowed,
        "headers": build_response_headers(authz_result, request_context),
        "body": "",
        "http_status": conditional_status(authz_result.allowed)
    }
    
    # Audit information
    audit_info := {
        "decision_id": uuid.rfc4122(""),
        "timestamp": time.now_ns(),
        "trace_id": request_context.trace_id,
        "span_id": request_context.span_id,
        "request_id": request_context.request_id,
        "user": user_context,
        "request": {
            "method": request_context.method,
            "path": request_context.path,
            "resource_type": authz_result.resource.type,
            "resource_id": authz_result.resource.id,
            "action": authz_result.resource.action
        },
        "decision": {
            "allow": authz_result.allowed,
            "policy_id": "notes_authorization",
            "rule": authz_result.rule,
            "reason": build_decision_reason(authz_result, user_context),
            "evaluation_time_ms": (time.now_ns() - authz_result.evaluation_time) / 1000000
        },
        "metadata": {
            "client_ip": request_context.source_ip,
            "correlation_id": generate_correlation_id(request_context, user_context)
        }
    }
    
    response := object.union(base_response, {"audit": audit_info})
}

# Sanitize headers to remove sensitive information
sanitize_headers(headers) := sanitized if {
    sensitive_headers := {"authorization", "cookie", "x-api-key", "x-auth-token"}
    sanitized := {k: v | 
        headers[k] = v
        not sensitive_headers[lower(k)]
    }
}

# Parse resource information from request path
parse_resource_info(path, method) := info if {
    # Extract resource type and ID from path
    path_parts := split(trim_prefix(path, "/api/v1/"), "/")
    
    info := {
        "type": path_parts[0],
        "id": conditional_resource_id(path_parts),
        "action": method_to_action(method, path_parts)
    }
}

# Map HTTP methods to actions
method_to_action(method, path_parts) := action if {
    method == "GET"
    count(path_parts) == 1
    action := "list"
} else := "read" if {
    method == "GET"
} else := "create" if {
    method == "POST"
} else := "update" if {
    method == "PUT"
} else := "delete" if {
    method == "DELETE"
} else := "unknown"

# Check resource-specific permissions
check_resource_permission(resource, user) := allowed if {
    resource.type == "notes"
    allowed := check_notes_permission(resource, user)
} else := allowed if {
    resource.type == "workspaces"
    allowed := check_workspace_permission(resource, user)
} else := false

# Notes permission logic with audit trail
check_notes_permission(resource, user) := true if {
    resource.action == "create"
    workspace_role := user.workspaces[resource.workspace]
    workspace_role in ["workspace_editor", "workspace_admin", "workspace_owner"]
} else := true if {
    resource.action == "read"
    # Check if user has any access to the note
    has_note_access(resource.id, user)
} else := false

# Build human-readable decision reason
build_decision_reason(authz_result, user_context) := reason if {
    authz_result.allowed == true
    reason := sprintf("User %s with roles %v has %s permission for %s %s", [
        user_context.username,
        user_context.roles,
        authz_result.resource.action,
        authz_result.resource.type,
        authz_result.resource.id
    ])
} else := reason if {
    reason := sprintf("User %s with roles %v does not have %s permission for %s %s", [
        user_context.username,
        user_context.roles,
        authz_result.resource.action,
        authz_result.resource.type,
        authz_result.resource.id
    ])
}

# Utility functions
conditional_status(allowed) := 200 if allowed else := 403
conditional_resource_id(parts) := parts[1] if count(parts) > 1 else := ""
generate_correlation_id(request, user) := sprintf("%s-%s-%d", [request.request_id, user.user_id, time.now_ns()])

# Helper to get matched rule name
get_matched_rule(resource, user, allowed) := "allow_workspace_editor_create" if {
    allowed
    resource.action == "create"
    resource.type == "notes"
} else := "allow_note_owner_access" if {
    allowed
    resource.action in ["read", "update", "delete"]
} else := "deny_insufficient_permissions"
```

### 2. Audit Collection Service

#### Audit Collector Service (`services/audit-collector/main.go`)
```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/prometheus/client_golang/prometheus"
    "github.com/prometheus/client_golang/prometheus/promhttp"
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
    "go.uber.org/zap"
)

// DecisionLog represents an OPA decision log entry
type DecisionLog struct {
    DecisionID    string                 `json:"decision_id"`
    Timestamp     time.Time              `json:"timestamp"`
    TraceID       string                 `json:"trace_id"`
    SpanID        string                 `json:"span_id"`
    RequestID     string                 `json:"request_id"`
    User          UserContext            `json:"user"`
    Request       RequestContext         `json:"request"`
    Decision      DecisionContext        `json:"decision"`
    Metadata      map[string]interface{} `json:"metadata"`
}

type UserContext struct {
    ID       string   `json:"id"`
    Username string   `json:"username"`
    Email    string   `json:"email"`
    Tenant   string   `json:"tenant"`
    Roles    []string `json:"roles"`
}

type RequestContext struct {
    Method       string `json:"method"`
    Path         string `json:"path"`
    ResourceType string `json:"resource_type"`
    ResourceID   string `json:"resource_id"`
    Action       string `json:"action"`
    Workspace    string `json:"workspace"`
}

type DecisionContext struct {
    Allow           bool    `json:"allow"`
    PolicyID        string  `json:"policy_id"`
    Rule            string  `json:"rule"`
    Reason          string  `json:"reason"`
    EvaluationTimeMS float64 `json:"evaluation_time_ms"`
}

// Metrics
var (
    decisionCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "opa_decisions_total",
            Help: "Total number of OPA authorization decisions",
        },
        []string{"decision", "resource_type", "action", "policy_id"},
    )
    
    decisionDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name: "opa_decision_duration_ms",
            Help: "OPA decision evaluation time in milliseconds",
        },
        []string{"decision", "resource_type"},
    )
    
    deniedRequestsCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "opa_denied_requests_total",
            Help: "Total number of denied authorization requests",
        },
        []string{"resource_type", "action", "rule"},
    )
)

func init() {
    prometheus.MustRegister(decisionCounter)
    prometheus.MustRegister(decisionDuration)
    prometheus.MustRegister(deniedRequestsCounter)
}

// AuditCollector handles audit log collection and forwarding
type AuditCollector struct {
    logger    *zap.Logger
    tracer    trace.Tracer
    forwarder LogForwarder
}

// LogForwarder interface for different log destinations
type LogForwarder interface {
    ForwardLog(ctx context.Context, log DecisionLog) error
}

// LokiForwarder sends logs to Loki
type LokiForwarder struct {
    endpoint string
    client   *http.Client
}

func (l *LokiForwarder) ForwardLog(ctx context.Context, log DecisionLog) error {
    // Convert to Loki format
    lokiLog := map[string]interface{}{
        "streams": []map[string]interface{}{
            {
                "stream": map[string]string{
                    "service":       "opa-audit",
                    "environment":   "production",
                    "decision":      fmt.Sprintf("%t", log.Decision.Allow),
                    "resource_type": log.Request.ResourceType,
                    "action":        log.Request.Action,
                    "tenant":        log.User.Tenant,
                },
                "values": [][]string{
                    {
                        fmt.Sprintf("%d", log.Timestamp.UnixNano()),
                        mustMarshal(log),
                    },
                },
            },
        },
    }
    
    body, err := json.Marshal(lokiLog)
    if err != nil {
        return fmt.Errorf("failed to marshal Loki log: %w", err)
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", l.endpoint+"/loki/api/v1/push", bytes.NewBuffer(body))
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := l.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode >= 400 {
        return fmt.Errorf("Loki returned status %d", resp.StatusCode)
    }
    
    return nil
}

// NewAuditCollector creates a new audit collector
func NewAuditCollector(logger *zap.Logger) *AuditCollector {
    tracer := otel.Tracer("audit-collector")
    
    forwarder := &LokiForwarder{
        endpoint: getEnv("LOKI_ENDPOINT", "http://loki:3100"),
        client: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
    
    return &AuditCollector{
        logger:    logger,
        tracer:    tracer,
        forwarder: forwarder,
    }
}

// HandleDecisionLog processes incoming OPA decision logs
func (ac *AuditCollector) HandleDecisionLog(c *gin.Context) {
    ctx, span := ac.tracer.Start(c.Request.Context(), "handle_decision_log")
    defer span.End()
    
    var logs []DecisionLog
    if err := c.ShouldBindJSON(&logs); err != nil {
        ac.logger.Error("Failed to parse decision logs", zap.Error(err))
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
        return
    }
    
    for _, log := range logs {
        // Enrich log with trace context
        log = ac.enrichWithTraceContext(ctx, log)
        
        // Validate and sanitize log
        if err := ac.validateLog(log); err != nil {
            ac.logger.Warn("Invalid decision log", zap.Error(err), zap.Any("log", log))
            continue
        }
        
        // Record metrics
        ac.recordMetrics(log)
        
        // Forward to storage
        if err := ac.forwarder.ForwardLog(ctx, log); err != nil {
            ac.logger.Error("Failed to forward log", zap.Error(err))
            // Continue processing other logs
        }
        
        // Log structured audit entry
        ac.logAuditEntry(log)
        
        // Trigger alerts for denied requests
        if !log.Decision.Allow {
            ac.checkForAlerts(log)
        }
    }
    
    c.JSON(http.StatusOK, gin.H{"processed": len(logs)})
}

// enrichWithTraceContext adds OpenTelemetry trace context
func (ac *AuditCollector) enrichWithTraceContext(ctx context.Context, log DecisionLog) DecisionLog {
    span := trace.SpanFromContext(ctx)
    if span.SpanContext().IsValid() {
        log.TraceID = span.SpanContext().TraceID().String()
        log.SpanID = span.SpanContext().SpanID().String()
    }
    return log
}

// validateLog ensures log integrity and PII safety
func (ac *AuditCollector) validateLog(log DecisionLog) error {
    if log.DecisionID == "" {
        return fmt.Errorf("missing decision_id")
    }
    
    if log.User.ID == "" {
        return fmt.Errorf("missing user.id")
    }
    
    if log.Request.ResourceType == "" {
        return fmt.Errorf("missing request.resource_type")
    }
    
    // Check for potential PII in logs
    if containsPII(log) {
        return fmt.Errorf("log contains potential PII")
    }
    
    return nil
}

// recordMetrics updates Prometheus metrics
func (ac *AuditCollector) recordMetrics(log DecisionLog) {
    decision := "allow"
    if !log.Decision.Allow {
        decision = "deny"
    }
    
    decisionCounter.WithLabelValues(
        decision,
        log.Request.ResourceType,
        log.Request.Action,
        log.Decision.PolicyID,
    ).Inc()
    
    decisionDuration.WithLabelValues(
        decision,
        log.Request.ResourceType,
    ).Observe(log.Decision.EvaluationTimeMS)
    
    if !log.Decision.Allow {
        deniedRequestsCounter.WithLabelValues(
            log.Request.ResourceType,
            log.Request.Action,
            log.Decision.Rule,
        ).Inc()
    }
}

// logAuditEntry creates structured audit log
func (ac *AuditCollector) logAuditEntry(log DecisionLog) {
    ac.logger.Info("authorization_decision",
        zap.String("decision_id", log.DecisionID),
        zap.String("trace_id", log.TraceID),
        zap.String("user_id", log.User.ID),
        zap.String("username", log.User.Username),
        zap.String("tenant", log.User.Tenant),
        zap.String("method", log.Request.Method),
        zap.String("path", log.Request.Path),
        zap.String("resource_type", log.Request.ResourceType),
        zap.String("resource_id", log.Request.ResourceID),
        zap.String("action", log.Request.Action),
        zap.Bool("allowed", log.Decision.Allow),
        zap.String("policy_id", log.Decision.PolicyID),
        zap.String("rule", log.Decision.Rule),
        zap.String("reason", log.Decision.Reason),
        zap.Float64("evaluation_time_ms", log.Decision.EvaluationTimeMS),
        zap.Any("metadata", log.Metadata),
    )
}

// checkForAlerts triggers alerts for suspicious activity
func (ac *AuditCollector) checkForAlerts(log DecisionLog) {
    // Example: Alert on repeated denials from same user
    // This would integrate with alerting system like AlertManager
    
    if !log.Decision.Allow {
        ac.logger.Warn("authorization_denied",
            zap.String("decision_id", log.DecisionID),
            zap.String("user_id", log.User.ID),
            zap.String("reason", log.Decision.Reason),
            zap.String("resource", fmt.Sprintf("%s:%s", log.Request.ResourceType, log.Request.ResourceID)),
        )
    }
}

// Utility functions
func mustMarshal(v interface{}) string {
    b, _ := json.Marshal(v)
    return string(b)
}

func containsPII(log DecisionLog) bool {
    // Check for potential PII patterns
    sensitivePatterns := []string{
        "password", "secret", "token", "key", "ssn", "credit_card",
    }
    
    logJSON := mustMarshal(log)
    for _, pattern := range sensitivePatterns {
        if strings.Contains(strings.ToLower(logJSON), pattern) {
            return true
        }
    }
    
    return false
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func main() {
    logger, _ := zap.NewProduction()
    defer logger.Sync()
    
    collector := NewAuditCollector(logger)
    
    router := gin.New()
    router.Use(gin.Logger())
    router.Use(gin.Recovery())
    
    // Audit endpoints
    v1 := router.Group("/v1")
    {
        v1.POST("/decisions", collector.HandleDecisionLog)
        v1.GET("/health", func(c *gin.Context) {
            c.JSON(200, gin.H{"status": "healthy"})
        })
    }
    
    // Metrics endpoint
    router.GET("/metrics", gin.WrapH(promhttp.Handler()))
    
    port := getEnv("PORT", "8080")
    logger.Info("Starting audit collector", zap.String("port", port))
    
    if err := router.Run(":" + port); err != nil {
        logger.Fatal("Failed to start server", zap.Error(err))
    }
}
```

### 3. OpenTelemetry Integration

#### Trace Context Propagation (`infra/otel/trace-config.yaml`)
```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
  
  # Add audit context to traces
  attributes:
    actions:
      - key: service.name
        value: "modulo-authorization"
        action: upsert
      - key: audit.enabled
        value: true
        action: upsert
        
  # Correlate with decision logs
  spanmetrics:
    metrics_exporter: prometheus
    latency_histogram_buckets: [2ms, 8ms, 50ms, 100ms, 200ms, 500ms, 1s, 5s, 10s]
    dimensions:
      - name: http.method
      - name: http.status_code
      - name: authz.decision
      - name: authz.resource_type

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
      
  prometheus:
    endpoint: "0.0.0.0:8889"
    
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"
    labels:
      resource:
        - service.name
        - authz.decision
        - authz.resource_type

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [attributes, batch]
      exporters: [jaeger]
      
    metrics:
      receivers: [otlp]
      processors: [attributes, spanmetrics, batch]
      exporters: [prometheus]
      
    logs:
      receivers: [otlp]
      processors: [attributes, batch]
      exporters: [loki]
```

### 4. Grafana Dashboard Configuration

#### Authorization Audit Dashboard (`monitoring/grafana/dashboards/authorization-audit.json`)
```json
{
  "dashboard": {
    "title": "Authorization Audit & Decision Tracing",
    "tags": ["security", "audit", "authorization"],
    "panels": [
      {
        "title": "Authorization Decisions Overview",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(opa_decisions_total[5m])) by (decision)",
            "legendFormat": "{{decision}}"
          }
        ],
        "gridPos": {"x": 0, "y": 0, "w": 12, "h": 4}
      },
      {
        "title": "Recent Denied Requests",
        "type": "logs",
        "targets": [
          {
            "expr": "{service=\"opa-audit\", decision=\"false\"} |= \"authorization_denied\"",
            "refId": "A"
          }
        ],
        "gridPos": {"x": 0, "y": 4, "w": 24, "h": 8}
      },
      {
        "title": "Top Denied Actions by Resource Type",
        "type": "bargauge", 
        "targets": [
          {
            "expr": "topk(10, sum(rate(opa_denied_requests_total[1h])) by (resource_type, action))",
            "legendFormat": "{{resource_type}}:{{action}}"
          }
        ],
        "gridPos": {"x": 0, "y": 12, "w": 12, "h": 8}
      },
      {
        "title": "Decision Evaluation Time",
        "type": "histogram",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(opa_decision_duration_ms_bucket[5m])) by (le, resource_type))",
            "legendFormat": "95th percentile - {{resource_type}}"
          }
        ],
        "gridPos": {"x": 12, "y": 12, "w": 12, "h": 8}
      },
      {
        "title": "Authorization Decisions by User",
        "type": "table",
        "targets": [
          {
            "expr": "sum(rate(opa_decisions_total[1h])) by (user_id, decision)",
            "format": "table"
          }
        ],
        "gridPos": {"x": 0, "y": 20, "w": 24, "h": 8}
      },
      {
        "title": "Decision Correlation with Traces",
        "type": "traces",
        "targets": [
          {
            "query": "service.name=\"modulo-authorization\" AND authz.decision=\"deny\"",
            "datasource": "Jaeger"
          }
        ],
        "gridPos": {"x": 0, "y": 28, "w": 24, "h": 8}
      }
    ]
  }
}
```

### 5. Alert Rules Configuration

#### Prometheus Alert Rules (`monitoring/alerts/authorization-alerts.yaml`)
```yaml
groups:
  - name: authorization.rules
    rules:
      - alert: HighAuthorizationDenialRate
        expr: rate(opa_denied_requests_total[5m]) > 0.1
        for: 2m
        labels:
          severity: warning
          service: authorization
        annotations:
          summary: "High authorization denial rate detected"
          description: "Authorization denial rate is {{ $value }} requests/sec for {{ $labels.resource_type }}:{{ $labels.action }}"
          
      - alert: AuthorizationServiceDown
        expr: up{job="audit-collector"} == 0
        for: 1m
        labels:
          severity: critical
          service: authorization
        annotations:
          summary: "Authorization audit service is down"
          description: "The audit collector service has been down for more than 1 minute"
          
      - alert: SlowAuthorizationDecisions
        expr: histogram_quantile(0.95, rate(opa_decision_duration_ms_bucket[5m])) > 100
        for: 5m
        labels:
          severity: warning
          service: authorization
        annotations:
          summary: "Slow authorization decisions detected"
          description: "95th percentile of authorization decision time is {{ $value }}ms"
          
      - alert: SuspiciousAuthorizationPattern
        expr: increase(opa_denied_requests_total{resource_type="notes", action="delete"}[1h]) > 10
        for: 0m
        labels:
          severity: warning
          service: authorization
        annotations:
          summary: "Suspicious authorization pattern detected"
          description: "Unusual number of denied delete requests for notes: {{ $value }} in the last hour"
```

## 🔍 Usage Examples

### Querying Audit Logs

#### Find Recent Denied Requests
```bash
# Using Grafana Loki
{service="opa-audit", decision="false"} 
| json 
| line_format "{{.timestamp}} {{.user.username}} DENIED {{.request.action}} {{.request.resource_type}}:{{.request.resource_id}} - {{.decision.reason}}"
```

#### Trace Authorization Decision
```bash
# Find decision by trace ID
{service="opa-audit"} 
| json 
| trace_id="4bf92f3577b34da6a3ce929d0e0e4736"
```

#### Top Denied Actions by User
```bash
# Prometheus query
topk(10, sum(rate(opa_denied_requests_total[1h])) by (user_id))
```

### Correlation with Application Traces

#### View Full Request Flow
```javascript
// Jaeger query for complete request trace
{
  "service": "modulo-backend",
  "operation": "POST /api/v1/notes",
  "tags": {
    "authz.decision": "deny",
    "user.id": "user_12345"
  }
}
```

## 🔐 Security and Privacy

### PII Protection
- Email addresses are hashed using SHA-256
- Request bodies are excluded from logs
- Authorization headers are sanitized
- Maximum field lengths prevent log injection

### Access Control
- Audit logs are encrypted at rest
- Access requires authentication and authorization
- Retention policies automatically purge old logs
- Export capabilities are role-restricted

### Compliance
- SOC 2 Type II audit trail requirements
- GDPR data processing transparency  
- HIPAA audit log requirements (where applicable)
- Immutable audit trail with integrity verification

---

This comprehensive audit logging and decision tracing system provides complete visibility into authorization decisions while maintaining security and privacy standards.
