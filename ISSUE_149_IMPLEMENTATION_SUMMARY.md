# 🔍 Audit Logging & Decision Tracing Implementation

> **Issue #149: Comprehensive audit logging and decision tracing for OPA authorization decisions**

This implementation provides a complete audit logging and decision tracing system that meets enterprise security and compliance requirements.

## 🎯 Overview

The audit logging system captures every authorization decision made by OPA, correlates them with distributed traces, and provides comprehensive visibility through structured logs, metrics, and dashboards.

### Key Features

- **📊 Structured Decision Logs**: Every allow/deny decision with full context
- **🔗 Trace Correlation**: Integration with OpenTelemetry for end-to-end tracing  
- **🔒 PII Protection**: Hash sensitive data, exclude request bodies
- **📈 Real-time Monitoring**: Prometheus metrics with Grafana dashboards
- **🔍 Searchable Logs**: Loki and Elasticsearch integration
- **🚨 Alerting**: Automated alerts for suspicious patterns

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Request Flow & Audit Trail                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Client Request → Envoy → OPA → Backend Service                  │
│       ↓            ↓      ↓         ↓                          │
│   Trace Ctx → Headers → Decision → App Logs                     │
│       ↓            ↓      ↓         ↓                          │
│ OpenTelemetry → Audit → Loki → Grafana Dashboard               │
│                Collector  ↓                                     │
│                    ↓   Elasticsearch                            │
│               Prometheus                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 Acceptance Criteria Status

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Structured logging** with request ID, user, action, resource, policy rule, effect | ✅ | `policy/audit_enhanced_authorization.rego` |
| **Correlation** with app traces (trace/span IDs) and searchable logs | ✅ | OpenTelemetry integration, Loki/Elasticsearch |
| **PII-safe** with no sensitive payloads stored | ✅ | Hash emails, sanitize headers, exclude bodies |
| **OpenTelemetry integration** for trace correlation | ✅ | `infra/otel/otel-config.yaml` |
| **Observability** with Loki/Grafana panel for recent denials & top actions | ✅ | Grafana dashboard with comprehensive panels |

## 🚀 Quick Start

### 1. Start the Complete Stack

```bash
# Start all services including audit logging
docker compose up -d

# Wait for services to be ready (takes ~2-3 minutes)
docker compose ps
```

### 2. Run Validation Tests

```bash
# Run comprehensive audit logging tests
./scripts/test-audit-logging.sh

# This will:
# - Test authorization decisions with different user roles
# - Verify audit logs are generated and forwarded
# - Check trace correlation
# - Validate PII protection
# - Generate detailed test report
```

### 3. Access Dashboards

- **Grafana Audit Dashboard**: http://localhost:3000 (admin/admin123)
- **Prometheus Metrics**: http://localhost:9090
- **Jaeger Traces**: http://localhost:16686
- **Audit Collector Health**: http://localhost:8081/v1/health

## 📊 Decision Log Format

Every authorization decision generates a comprehensive audit log:

```json
{
  "decision_id": "dec_1699123456789_a1b2c3d4",
  "timestamp": 1699123456789000000,
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "request_id": "req_1699123456789abcdef",
  "user": {
    "id": "user_12345",
    "username": "john.doe",
    "email": "a1b2c3d4e5f6...", // SHA-256 hashed
    "tenant": "acme-corp",
    "roles": ["workspace_editor"],
    "session_id": "sess_xyz789"
  },
  "request": {
    "method": "POST",
    "path": "/api/v1/notes",
    "resource_type": "notes",
    "resource_id": "",
    "action": "create",
    "workspace": "project-alpha",
    "source_ip": "192.168.1.100"
  },
  "decision": {
    "allow": true,
    "policy_id": "notes_authorization",
    "policy_version": "v1.2.0",
    "rule": "allow_workspace_editor_create_notes",
    "reason": "User john.doe with role workspace_editor can create notes in workspace project-alpha",
    "evaluation_time_ms": 5.2,
    "token_valid": true
  },
  "metadata": {
    "client_ip": "192.168.1.100",
    "user_agent": "b3f4d5e6...", // Hashed for privacy
    "workspace_context": {
      "workspace": "project-alpha",
      "role": "workspace_editor",
      "permission": "create_notes"
    }
  }
}
```

## 🔍 Querying Audit Logs

### Loki Queries (in Grafana)

```bash
# Recent denied requests
{service="opa-audit", decision="false"} 
| json 
| line_format "{{.timestamp}} {{.user.username}} DENIED {{.request.action}} {{.request.resource_type}}:{{.request.resource_id}} - {{.decision.reason}}"

# Find decisions by trace ID
{service="opa-audit"} 
| json 
| trace_id="4bf92f3577b34da6a3ce929d0e0e4736"

# High-privilege action attempts
{service="opa-audit"} 
| json 
| request.action=~"delete|admin|manage"
```

### Prometheus Queries

```bash
# Top denied actions by resource type
topk(10, sum(rate(opa_denied_requests_total[1h])) by (resource_type, action))

# Decision latency percentiles
histogram_quantile(0.95, rate(opa_decision_duration_ms_bucket[5m]))

# User activity patterns
sum(rate(opa_decisions_total[5m])) by (user_id, decision)
```

### Elasticsearch Queries

```json
{
  "query": {
    "bool": {
      "must": [
        {"term": {"decision.allow": false}},
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  },
  "sort": [{"@timestamp": {"order": "desc"}}]
}
```

## 📈 Monitoring & Alerting

### Key Metrics

- `opa_decisions_total`: Total authorization decisions
- `opa_denied_requests_total`: Denied requests by resource/action
- `opa_decision_duration_ms`: Decision evaluation time
- `audit_logs_processed_total`: Audit log processing status

### Automated Alerts

- **High Denial Rate**: >10% denial rate for 2+ minutes
- **Slow Decisions**: >100ms evaluation time (95th percentile)
- **Service Down**: Audit collector unavailable
- **Suspicious Patterns**: Repeated denials from same user
- **Token Issues**: Multiple invalid token failures

## 🔐 Security & Privacy

### PII Protection

- **Email addresses**: SHA-256 hashed before logging
- **Authorization headers**: Stripped from logs  
- **Request bodies**: Excluded entirely
- **User agents**: Hashed to prevent fingerprinting
- **Configurable exclusions**: Additional PII patterns

### Access Control

- Audit logs require authentication to access
- Role-based access to different log levels
- Retention policies for compliance (90 days default)
- Immutable storage with integrity verification

### Compliance Features

- **SOC 2 Type II**: Complete audit trail with timestamps
- **GDPR**: Privacy-by-design with PII hashing
- **HIPAA**: Secure audit logs with access controls
- **Regulatory Export**: JSON/CSV export capabilities

## 🔧 Configuration

### Environment Variables

```bash
# Audit Collector Configuration
LOKI_ENDPOINT=http://loki:3100
ELASTIC_ENDPOINT=http://elasticsearch:9200
AUDIT_RETENTION_DAYS=90
BATCH_SIZE=100

# Alert Thresholds
DENIAL_RATE_THRESHOLD=0.1
SUSPICIOUS_ACTIONS_THRESHOLD=10

# OPA Configuration
AUDIT_SERVICE_TOKEN=your-secure-token
```

### OPA Policy Customization

Edit `policy/audit_enhanced_authorization.rego` to:
- Add new resource types
- Customize audit fields
- Modify PII protection rules
- Add business-specific logic

### Dashboard Customization

Grafana dashboards in `monitoring/grafana/dashboards/` can be customized for:
- Additional metrics visualization
- Custom alert panels
- Tenant-specific views
- Compliance reporting

## 🚨 Troubleshooting

### Common Issues

**No audit logs appearing**
```bash
# Check audit collector status
curl http://localhost:8081/v1/health

# Check OPA configuration
curl http://localhost:8181/health

# Verify service connectivity
docker compose logs audit-collector
```

**Missing metrics in Prometheus**
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metric endpoints
curl http://localhost:8081/metrics
```

**Trace correlation not working**
```bash
# Check OpenTelemetry collector
docker compose logs otel-collector

# Verify Jaeger connectivity
curl http://localhost:16686/api/services
```

### Performance Tuning

```bash
# Increase audit collector batch size
BATCH_SIZE=500

# Adjust log retention
AUDIT_RETENTION_DAYS=30

# Optimize Loki ingestion
# Edit monitoring/loki/loki-config.yaml
ingestion_rate_mb: 32
```

## 📚 Related Documentation

- [PLUGIN_SYSTEM_SUMMARY.md](./PLUGIN_SYSTEM_SUMMARY.md) - Overall system architecture
- [ISSUE_148_IMPLEMENTATION_SUMMARY.md](./ISSUE_148_IMPLEMENTATION_SUMMARY.md) - Admin & operator tools
- [ISSUE_147_IMPLEMENTATION_SUMMARY.md](./ISSUE_147_IMPLEMENTATION_SUMMARY.md) - Role/claim matrix
- [ISSUE_146_IMPLEMENTATION_SUMMARY.md](./ISSUE_146_IMPLEMENTATION_SUMMARY.md) - Policy CI gate

## 🎯 Testing Strategy

### Unit Tests
- Policy rule evaluation
- Audit log formatting
- PII protection functions

### Integration Tests  
- End-to-end authorization flow
- Log forwarding to multiple destinations
- Trace correlation accuracy

### Security Tests
- PII detection and protection
- Access control verification
- Data integrity validation

### Performance Tests
- Decision latency under load
- Log processing throughput
- Storage scalability

## 🔮 Future Enhancements

- **Machine Learning**: Anomaly detection for authorization patterns
- **Export APIs**: Automated compliance reporting
- **Real-time Alerting**: Slack/PagerDuty integration
- **Advanced Analytics**: User behavior analysis
- **Federation**: Multi-cluster audit aggregation

---

## ✅ Summary

This comprehensive audit logging and decision tracing implementation provides:

- **Complete Visibility**: Every authorization decision is logged with full context
- **Enterprise Security**: PII protection, access controls, and compliance features  
- **Operational Excellence**: Real-time monitoring, alerting, and troubleshooting tools
- **Scalable Architecture**: Multiple storage backends and processing pipelines
- **Developer Experience**: Rich dashboards, searchable logs, and trace correlation

The system is production-ready and meets all security, compliance, and operational requirements for enterprise authorization auditing.

**🎉 Issue #149 is now complete with comprehensive audit logging and decision tracing!**
