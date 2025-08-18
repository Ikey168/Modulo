# 🚀 Enhanced Observability Stack for Modulo

This directory contains the enhanced observability stack for the Modulo platform, implementing **Golden Signals monitoring**, comprehensive alerting, and distributed tracing using OpenTelemetry.

## 🎯 Golden Signals Implementation

The Four Golden Signals are fully implemented across all dashboards and alerts:

1. **🔥 Error Rate**: HTTP error rate monitoring with 1% warning / 5% critical thresholds
2. **⚡ Latency**: P95 response time monitoring with 500ms warning / 1000ms critical thresholds  
3. **🌊 Traffic**: Request rate monitoring with traffic analysis
4. **⭐ Saturation**: CPU, memory, and resource utilization monitoring with 85% thresholds

## 📊 Dashboard Suite

### 1. 🚀 Application Performance Dashboard
**File:** `dashboards/app-performance.json`

**Golden Signals Overview:**
- Request rate (req/sec) with traffic thresholds
- Error rate percentage with color-coded alerts
- P95 latency in milliseconds with performance bands
- CPU saturation percentage with resource alerts

**Additional Metrics:**
- Request metrics by endpoint
- Response time percentiles (P50, P95, P99)
- Business metrics (notes operations, WebSocket connections)

### 2. ☕ JVM Performance Dashboard  
**File:** `dashboards/jvm-performance.json`

**Memory Management:**
- Heap usage percentage with GC pressure indicators
- Non-heap usage for metaspace monitoring
- Memory area breakdown (Eden, Survivor, Old Gen)

**Garbage Collection:**
- GC time distribution across collectors
- GC frequency analysis
- GC pause time impact

**Threading & Resources:**
- Thread state distribution
- Class loading metrics
- File descriptor usage
- CPU usage (process vs system)

### 3. 🗄️ Database Performance Dashboard
**File:** `dashboards/database-performance.json`

**Connection Pool Monitoring:**
- HikariCP pool usage percentage
- Active vs idle connection tracking
- Connection acquisition timing (P50, P95, P99)
- Connection creation and timeout rates

**Query Performance:**
- Database query duration distribution
- Query rate by operation type
- Slow query detection

### 4. 🔗 Sync & Blockchain Dashboard
**File:** `dashboards/sync-blockchain.json`

**WebSocket Activity:**
- Active connection count with scaling alerts
- Message flow rates (in/out)
- Connection health monitoring

**Blockchain Operations:**
- Transaction success rate percentage
- Transaction rate tracking
- Operation status distribution (success/failed/pending)

**Sync Operations:**
- Pending operation backlog monitoring
- Sync completion rates
- Network status tracking
- Offline storage operation metrics

## 🚨 Enhanced Alerting System

### Prometheus Configuration
**File:** `prometheus.yaml`

**Golden Signal Alerts:**
- `HighErrorRate`: >5% error rate (critical)
- `ModerateErrorRate`: >1% error rate (warning)
- `HighLatencyP95`: >1000ms P95 latency (critical)
- `ModerateLatencyP95`: >500ms P95 latency (warning)
- `HighCPUSaturation`: >85% CPU usage (critical)
- `HighMemorySaturation`: >85% memory usage (critical)

**Infrastructure Alerts:**
- Service availability monitoring
- Pod restart rate tracking
- Disk space utilization

**Business Logic Alerts:**
- WebSocket connection limits
- Blockchain operation failures
- Sync operation backlogs

### Alertmanager Configuration
**File:** `alertmanager.yaml`

**Alert Routing:**
- Critical alerts: Immediate notification
- Warning alerts: 5-minute grouping
- Severity-based routing with webhook integration
- Alert inhibition rules to prevent spam

**Notification Channels:**
- Configurable webhook endpoints
- Slack/Teams integration ready
- Email notification support

## 🛠️ Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Grafana** | 10.1.5 | Dashboard visualization and alerting UI |
| **Prometheus** | 2.47.2 | Metrics collection and alerting engine |
| **Alertmanager** | 0.26.0 | Alert routing and notification management |
| **Tempo** | latest | Distributed tracing with OpenTelemetry |
| **Loki** | latest | Log aggregation and correlation |
| **OpenTelemetry Collector** | 0.89.0 | Metrics, traces, and logs collection |

## 🚀 Quick Deployment

### 1. Deploy Complete Stack
```bash
cd k8s
./deploy-observability.sh
```

### 2. Access Services
```bash
# Port forwarding for local access
kubectl port-forward -n observability svc/grafana 3000:3000 &
kubectl port-forward -n observability svc/prometheus 9090:9090 &
kubectl port-forward -n observability svc/alertmanager 9093:9093 &
kubectl port-forward -n observability svc/tempo 3200:3200 &
kubectl port-forward -n observability svc/loki 3100:3100 &
```

### 3. Dashboard Access
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Tempo**: http://localhost:3200  
- **Loki**: http://localhost:3100

## 🧪 Testing & Validation

### Test Alert Firing
```bash
# Simulate high error rate
curl -X POST http://localhost:8080/api/test/error-rate

# Simulate high latency
curl -X POST http://localhost:8080/api/test/latency

# Check alert status
curl http://localhost:9093/api/v1/alerts
```

### Validate Dashboards
1. Open Grafana: http://localhost:3000
2. Navigate to dashboards:
   - 🚀 Application Performance - Golden Signals
   - ☕ JVM Performance Monitoring
   - 🗄️ Database Performance
   - 🔗 Sync & Blockchain Operations
3. Verify data is flowing (may take 1-2 minutes for metrics)

### Test Distributed Tracing
1. Generate some API traffic
2. Open Grafana → Explore → Tempo
3. Search for traces by service name: `modulo-backend`
4. Examine trace correlation across services
   ```

2. Access Grafana:
   ```bash
   kubectl port-forward svc/grafana 3000:3000 -n observability
   # Visit http://localhost:3000 (admin/admin)
   ```

3. View traces in Tempo:
   - Grafana → Explore → Tempo → Query traces

4. Check metrics in Prometheus:
   ```bash
   kubectl port-forward svc/prometheus 9090:9090 -n observability
   # Visit http://localhost:9090
   ```

## Configuration

The stack is configured to:
- Sample 10% of traces in production (configurable)
- Retain traces for 7 days
- Collect metrics every 15 seconds
- Store logs for 30 days
- Alert on high error rates and latency

## Integration

Applications automatically instrument and send telemetry data when:
1. OpenTelemetry Java agent is attached
2. Environment variables are configured
3. Application includes OpenTelemetry SDK

See `../02-api-configmap.yaml` for environment configuration.
