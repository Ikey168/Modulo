# 🔍 Health Endpoints & Kubernetes Probes

This document describes the health monitoring endpoints implemented in Modulo for synthetic monitoring and Kubernetes probe integration.

## 📊 Overview

Modulo provides comprehensive health endpoints that serve multiple purposes:
- **Kubernetes Health Probes**: Liveness, readiness, and startup probes
- **Synthetic Monitoring**: External uptime and availability monitoring
- **Observability**: Detailed health status for debugging and monitoring
- **SLO Validation**: Service level objective compliance checking

## 🔗 Health Endpoints

### 1. Spring Boot Actuator Endpoints

#### `/api/actuator/health`
**Purpose**: Overall application health status
**Used by**: Kubernetes startup probe, synthetic monitoring
**Response**:
```json
{
  "status": "UP",
  "components": {
    "db": {"status": "UP"},
    "diskSpace": {"status": "UP"},
    "ping": {"status": "UP"}
  }
}
```

#### `/api/actuator/health/liveness`
**Purpose**: Pod liveness check for Kubernetes
**Used by**: Kubernetes liveness probe
**Response**:
```json
{
  "status": "UP",
  "groups": ["liveness"]
}
```

#### `/api/actuator/health/readiness`
**Purpose**: Service readiness for traffic routing
**Used by**: Kubernetes readiness probe
**Response**:
```json
{
  "status": "UP",
  "groups": ["readiness"]
}
```

### 2. Custom Health Endpoints (`/api/health`)

#### `/api/health`
**Purpose**: Simple health check for uptime monitoring
**Used by**: Synthetic monitoring, load balancers
**Response**:
```json
{
  "status": "UP",
  "application": "modulo",
  "timestamp": 1692361200000,
  "version": "1.0.0"
}
```

#### `/api/health/detailed`
**Purpose**: Comprehensive health status with component details
**Used by**: Detailed monitoring, debugging
**Response**:
```json
{
  "status": "UP",
  "application": "modulo",
  "timestamp": 1692361200000,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "UP",
      "message": "Database connection healthy",
      "driver": "PostgreSQL JDBC Driver",
      "url": "jdbc:postgresql://localhost:5432/modulodb"
    },
    "network": {
      "status": "UP",
      "online": true,
      "message": "Network service operational"
    },
    "sync": {
      "status": "UP",
      "message": "Sync service available"
    },
    "memory": {
      "status": "UP",
      "used_memory_mb": 256,
      "max_memory_mb": 1024,
      "memory_usage_percent": 25.0,
      "message": "Memory usage healthy"
    }
  }
}
```

#### `/api/health/ready`
**Purpose**: Custom readiness check with detailed validation
**Used by**: Advanced readiness monitoring
**Response**:
```json
{
  "status": "UP",
  "ready": true,
  "checks": {
    "database": "ready"
  },
  "timestamp": 1692361200000
}
```

#### `/api/health/live`
**Purpose**: Custom liveness check
**Used by**: Advanced liveness monitoring
**Response**:
```json
{
  "status": "UP",
  "alive": true,
  "timestamp": 1692361200000
}
```

#### `/api/health/uptime`
**Purpose**: Application uptime information
**Used by**: Monitoring dashboards, uptime tracking
**Response**:
```json
{
  "status": "UP",
  "uptime_ms": 3600000,
  "uptime_seconds": 3600,
  "uptime_minutes": 60,
  "uptime_hours": 1,
  "start_time": 1692357600000,
  "current_time": 1692361200000
}
```

## 🚢 Kubernetes Integration

### Pod Specification

```yaml
spec:
  containers:
  - name: api-container
    image: modulo-backend:latest
    ports:
    - containerPort: 8080
    
    # Startup probe - allows slow startup
    startupProbe:
      httpGet:
        path: /api/actuator/health
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 12  # Allow up to 2 minutes for startup
    
    # Liveness probe - restarts pod if unhealthy
    livenessProbe:
      httpGet:
        path: /api/actuator/health/liveness
        port: 8080
      initialDelaySeconds: 120
      periodSeconds: 15
      timeoutSeconds: 5
      failureThreshold: 3
    
    # Readiness probe - removes from service if not ready
    readinessProbe:
      httpGet:
        path: /api/actuator/health/readiness
        port: 8080
      initialDelaySeconds: 60
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3
```

### Probe Behavior

| Probe Type | Success | Failure | Kubernetes Action |
|------------|---------|---------|-------------------|
| **Startup** | App started | App failed to start | Kill pod and restart |
| **Liveness** | App alive | App deadlocked/crashed | Kill pod and restart |
| **Readiness** | App ready for traffic | App not ready | Remove from service endpoints |

## 🔍 Synthetic Monitoring Integration

### Uptime Probe Script

The synthetic monitoring validates all critical endpoints:

```javascript
// Critical path validation
let livenessResponse = http.get(`${BASE_URL}/api/actuator/health/liveness`);
let readinessResponse = http.get(`${BASE_URL}/api/actuator/health/readiness`);
let healthResponse = http.get(`${BASE_URL}/api/actuator/health`);

// SLO validation
check(livenessResponse, {
  'liveness probe responds': (r) => r.status === 200,
  'liveness status UP': (r) => r.json('status') === 'UP',
});
```

### Monitoring Frequency

| Environment | Frequency | Endpoints Checked |
|-------------|-----------|-------------------|
| **Production** | Every 30 seconds | All health endpoints |
| **Staging** | Every 60 seconds | All health endpoints |
| **Development** | Every 5 minutes | Basic health only |

## 📊 Health Check Components

### Database Health

**What it checks**:
- Database connection validity
- Query execution capability
- Connection pool status

**Failure scenarios**:
- Database connection lost
- Connection pool exhausted
- Database credentials invalid
- Database server unavailable

### Network Service Health

**What it checks**:
- Network connectivity status
- External service availability
- API endpoint reachability

**Failure scenarios**:
- Network interface down
- DNS resolution failure
- External service unavailable

### Sync Service Health

**What it checks**:
- Blockchain connectivity
- Sync service availability
- Background process status

**Failure scenarios**:
- Blockchain node unreachable
- Sync process crashed
- Configuration errors

### Memory Health

**What it checks**:
- JVM memory usage
- Heap utilization
- Garbage collection metrics

**Failure scenarios**:
- Memory usage > 90%
- OutOfMemoryError risk
- Memory leaks detected

## 🚨 Health Status Codes

| HTTP Status | Health Status | Meaning | Action Required |
|-------------|---------------|---------|-----------------|
| **200** | UP | Service healthy | None |
| **503** | DOWN | Service unhealthy | Immediate investigation |
| **500** | ERROR | Health check failed | Check application logs |
| **404** | N/A | Endpoint not found | Check configuration |

## 🔧 Configuration

### Spring Boot Properties

```properties
# Actuator endpoints
management.endpoints.web.exposure.include=health,info,metrics,prometheus
management.endpoints.web.base-path=/actuator
management.endpoint.health.show-details=always

# Health probes for Kubernetes
management.endpoint.health.probes.enabled=true
management.health.livenessstate.enabled=true
management.health.readinessstate.enabled=true

# Security
management.endpoint.health.show-components=always
management.endpoint.health.status.order=DOWN,OUT_OF_SERVICE,UP,UNKNOWN
```

### Kubernetes ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  # Health check intervals
  HEALTH_CHECK_INTERVAL: "30"
  HEALTH_TIMEOUT: "5"
  
  # Actuator configuration
  MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE: "health,info,metrics,prometheus"
  MANAGEMENT_ENDPOINT_HEALTH_SHOW_DETAILS: "always"
  MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED: "true"
```

## 🛠️ Troubleshooting

### Common Issues

**Health endpoint returns 503**:
1. Check application logs for startup errors
2. Verify database connectivity
3. Check resource utilization (CPU, memory)
4. Validate configuration

**Kubernetes pod keeps restarting**:
1. Check liveness probe configuration
2. Review startup time requirements
3. Verify health endpoint accessibility
4. Check application startup logs

**Service not receiving traffic**:
1. Check readiness probe status
2. Verify service endpoint configuration
3. Review application readiness state
4. Check network connectivity

### Debugging Commands

```bash
# Check health endpoints directly
curl -i http://localhost:8080/api/actuator/health
curl -i http://localhost:8080/api/actuator/health/liveness
curl -i http://localhost:8080/api/actuator/health/readiness

# Kubernetes health status
kubectl get pods -o wide
kubectl describe pod <pod-name>
kubectl logs <pod-name> --previous

# Check service endpoints
kubectl get endpoints
kubectl describe service <service-name>
```

## 📈 Monitoring & Alerting

### Metrics

The health endpoints provide metrics for monitoring:
- **Response time**: Time to execute health checks
- **Success rate**: Percentage of successful health checks
- **Component status**: Individual component health states

### Alerts

Recommended alerts:
- Health endpoint response time > 5 seconds
- Health check failure rate > 1%
- Any component status DOWN for > 1 minute
- Kubernetes probe failures

### Integration

Health endpoints integrate with:
- **Prometheus**: Metrics scraping and alerting
- **Grafana**: Health status dashboards
- **PagerDuty**: Critical health alerts
- **Synthetic Monitoring**: External uptime validation

## 🎯 Best Practices

1. **Probe Timing**: Set appropriate timeouts and intervals
2. **Graceful Degradation**: Health checks should fail fast
3. **Component Independence**: Health checks should not affect performance
4. **Meaningful Status**: Provide actionable health information
5. **Monitoring Integration**: Connect health status to observability systems
6. **Documentation**: Keep health check behavior documented and updated
