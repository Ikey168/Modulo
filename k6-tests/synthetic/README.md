# 🔍 Synthetic User Journey Monitoring

This directory contains k6 scripts for synthetic monitoring of the Modulo application, implementing comprehensive uptime monitoring and user journey validation.

## 📊 Overview

Synthetic monitoring provides:
- **Continuous uptime monitoring** with 99.9% SLO validation
- **End-to-end user journey testing** (login → create note → sync → search)
- **Real-time availability alerts** with SLO violation detection
- **Performance baseline tracking** for critical user paths

## 🎯 SLO Compliance

| Metric | SLO Target | Monitoring |
|--------|------------|------------|
| Application Uptime | > 99.9% | Every 5 seconds via health probes |
| Journey Success Rate | > 99.9% | Every 5 minutes during business hours |
| Response Time P95 | < 2000ms | Continuous monitoring |
| Journey Duration P95 | < 10000ms | User flow validation |

## 📁 Structure

```
synthetic/
├── user-journey.js      # Comprehensive end-to-end user journey
├── uptime-probe.js      # High-frequency uptime monitoring
└── README.md           # This documentation
```

## 🧪 Test Scripts

### 1. Uptime Probe (`uptime-probe.js`)

**Purpose**: Continuous availability monitoring with high-frequency probes

**Features**:
- Liveness probe validation (`/api/actuator/health/liveness`)
- Readiness probe validation (`/api/actuator/health/readiness`)
- Overall health check (`/api/actuator/health`)
- 12 probes per minute (every 5 seconds)
- SLO violation detection

**Usage**:
```bash
# Local monitoring
npm run synthetic:uptime

# Production monitoring
npm run monitor:uptime -- --env TARGET_URL=https://api.modulo.app

# Custom environment
k6 run --env TARGET_URL=https://staging-api.modulo.app synthetic/uptime-probe.js
```

### 2. User Journey (`user-journey.js`)

**Purpose**: End-to-end user experience validation

**Journey Steps**:
1. 🔍 **System Health Check** - Verify all health endpoints
2. 🌐 **Frontend Availability** - Check frontend accessibility
3. 🔐 **Authentication Flow** - Validate OAuth2 endpoints
4. 📝 **Note Creation** - Test core note functionality
5. 🔄 **Sync Operation** - Validate blockchain sync
6. 🔍 **Search Functionality** - Test search capabilities
7. 🔌 **WebSocket Connection** - Real-time feature validation
8. 📊 **Observability Check** - Metrics endpoint validation

**Usage**:
```bash
# Local journey testing
npm run synthetic:journey

# Production journey monitoring
npm run monitor:journey -- --env TARGET_URL=https://api.modulo.app --env FRONTEND_URL=https://modulo.app

# Extended monitoring (30 minutes)
k6 run --env TARGET_URL=https://api.modulo.app --env FRONTEND_URL=https://modulo.app synthetic/user-journey.js
```

## 🤖 Automated Monitoring

### GitHub Actions Workflow

The synthetic monitoring runs automatically via GitHub Actions:

**Schedule**:
- **Business Hours** (9 AM - 6 PM UTC, Mon-Fri): Every 5 minutes
- **Off Hours & Weekends**: Every 15 minutes
- **Post-Deployment**: Immediate validation after deployments

**Triggers**:
```yaml
# Scheduled monitoring
schedule:
  - cron: '*/5 9-18 * * 1-5'     # Every 5 min during business hours
  - cron: '*/15 0-8,19-23 * * *' # Every 15 min off hours
  - cron: '*/15 * * * 0,6'       # Every 15 min weekends

# Post-deployment validation
workflow_run:
  workflows: ["🚀 Deploy to Staging", "🚀 Deploy to Production"]
  types: [completed]

# Manual execution
workflow_dispatch: # Manual trigger with environment selection
```

### Manual Execution

**Via GitHub Actions**:
1. Go to Actions tab → "🔍 Synthetic User Journey Monitoring"
2. Click "Run workflow"
3. Select environment (staging/production)
4. Choose test type (uptime_probe/full_journey/extended_monitoring)
5. Set duration (default: 5 minutes)

**Local Execution**:
```bash
# Quick uptime check
npm run synthetic:uptime

# Full journey validation
npm run synthetic:journey

# Extended monitoring session
k6 run --duration 30m synthetic/user-journey.js
```

## 📊 Metrics & Alerting

### Custom Metrics

**Uptime Monitoring**:
- `probe_success_rate`: Overall uptime percentage
- `probe_response_time`: Health endpoint response times
- `probe_failures`: Count of failed probes
- `probe_attempts`: Total probe attempts

**Journey Monitoring**:
- `synthetic_journey_success_rate`: End-to-end success rate
- `synthetic_journey_duration`: Complete journey time
- `synthetic_login_duration`: Authentication flow time
- `synthetic_note_creation_duration`: Note creation time
- `synthetic_sync_duration`: Sync operation time
- `synthetic_search_duration`: Search functionality time

### SLO Thresholds

```javascript
thresholds: {
  // Uptime Requirements
  'probe_success_rate': ['rate>0.999'],           // 99.9% uptime
  'synthetic_journey_success_rate': ['rate>0.999'], // 99.9% journey success
  
  // Performance Requirements
  'probe_response_time': ['p(95)<2000'],          // 95% of probes < 2s
  'synthetic_journey_duration': ['p(95)<10000'],  // 95% of journeys < 10s
  'synthetic_login_duration': ['p(95)<2000'],     // Login < 2s
  'synthetic_note_creation_duration': ['p(95)<1000'], // Note creation < 1s
  'synthetic_sync_duration': ['p(95)<3000'],      // Sync < 3s
  'synthetic_search_duration': ['p(95)<1000'],    // Search < 1s
  
  // HTTP Requirements
  'http_req_failed': ['rate<0.001'],              // <0.1% HTTP failures
  'http_req_duration': ['p(95)<5000'],            // 95% of requests < 5s
}
```

### Alerting

**Automatic Alerts**:
- **SLO Violations**: Workflow fails if uptime < 99.9% or journey success < 99.9%
- **Performance Degradation**: Alerts when P95 response times exceed thresholds
- **Service Unavailability**: Immediate alert on health endpoint failures

**Alert Channels**:
- GitHub Actions workflow failure notifications
- Artifact uploads with detailed monitoring results
- Integration ready for PagerDuty, Slack, or other alerting systems

## 🔧 Configuration

### Environment Variables

```bash
# Target URLs
TARGET_URL=https://api.modulo.app           # Backend API URL
FRONTEND_URL=https://modulo.app             # Frontend application URL

# Test Configuration
K6_DURATION=5m                              # Test duration
K6_VUS=1                                    # Virtual users (for synthetic monitoring, keep at 1)
K6_RATE=12                                  # Requests per minute for uptime probes
```

### Test Profiles

**Uptime Probe Profile**:
- 1 VU (virtual user)
- 12 requests per minute (every 5 seconds)
- Continuous monitoring
- Focus on availability and basic response times

**Journey Profile**:
- 1 VU per scenario
- 1 journey per minute
- Comprehensive end-to-end testing
- Focus on user experience and functionality

**Extended Monitoring Profile**:
- Both uptime and journey testing
- Longer duration (30+ minutes)
- Comprehensive reporting
- Post-deployment validation

## 📈 Results & Reports

### Artifacts

Each monitoring run generates:
- **JSON Results**: Detailed metrics and timings
- **Summary Reports**: Human-readable status summaries
- **SLO Reports**: Compliance status and violations

### Retention

- **Uptime Results**: 30 days retention
- **Journey Results**: 30 days retention
- **Summary Reports**: 90 days retention

### Analysis

```bash
# View latest results
ls -la k6-tests/results/

# Analyze specific run
cat k6-tests/results/uptime-monitoring-20250818-120000.json | jq '.metrics'

# Check SLO compliance
cat k6-tests/results/synthetic-journey-20250818-120000.json | jq '.metrics.synthetic_journey_success_rate.values.rate'
```

## 🚨 Troubleshooting

### Common Issues

**High Failure Rate**:
1. Check application health endpoints
2. Verify network connectivity
3. Review application logs
4. Check resource utilization

**Slow Response Times**:
1. Monitor application performance
2. Check database connection health
3. Review system resources
4. Analyze application metrics

**SLO Violations**:
1. Immediate investigation required
2. Check application status
3. Review recent deployments
4. Escalate to on-call team

### Debugging

```bash
# Run with verbose output
k6 run --verbose synthetic/uptime-probe.js

# Run single iteration for debugging
k6 run --iterations 1 synthetic/user-journey.js

# Check health endpoints manually
curl -i http://localhost:8080/api/actuator/health/liveness
curl -i http://localhost:8080/api/actuator/health/readiness
curl -i http://localhost:8080/api/actuator/health
```

## 🔗 Integration

### Kubernetes Health Checks

The synthetic monitoring validates the same endpoints used by Kubernetes:

```yaml
livenessProbe:
  httpGet:
    path: /api/actuator/health/liveness
    port: 8080

readinessProbe:
  httpGet:
    path: /api/actuator/health/readiness
    port: 8080

startupProbe:
  httpGet:
    path: /api/actuator/health
    port: 8080
```

### Observability Integration

- **Prometheus Metrics**: Health check results exported to Prometheus
- **Grafana Dashboards**: Uptime and performance visualization
- **Alert Manager**: SLO violation alerting
- **Distributed Tracing**: Journey correlation with application traces

## 📚 Best Practices

1. **Keep Synthetic Tests Simple**: Focus on critical user paths
2. **Monitor Continuously**: Don't wait for users to report issues
3. **Set Realistic SLOs**: Based on business requirements and technical capabilities
4. **Alert on Trends**: Not just individual failures
5. **Validate After Deployments**: Immediate post-deployment checks
6. **Regular Review**: Update tests as application evolves

## 🎯 Success Metrics

- **Uptime Visibility**: Real-time awareness of service availability
- **Proactive Issue Detection**: Catch problems before users do
- **SLO Compliance**: Measurable service level achievement
- **Mean Time to Detection (MTTD)**: Reduced from user reports to automated detection
- **User Experience Validation**: Continuous validation of critical user journeys
