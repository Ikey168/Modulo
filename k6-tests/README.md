# 📊 k6 Load Testing Configuration

## 🎯 Test Profiles

### 🚀 Smoke Testing (smoke)
- **Purpose**: Quick validation that the system can handle minimal load
- **VUs**: 1 user
- **Duration**: 30 seconds
- **Use Case**: PR validation, quick sanity checks

### 📈 Normal Load Testing (normal)  
- **Purpose**: Baseline performance under expected production load
- **VUs**: 10 concurrent users
- **Duration**: 5 minutes
- **Use Case**: Nightly baselines, regular performance monitoring

### 🔥 Stress Testing (stress)
- **Purpose**: Push system beyond normal capacity to find breaking points
- **VUs**: 50 concurrent users  
- **Duration**: 2 minutes
- **Use Case**: Capacity planning, resilience testing

## 🎯 SLO-Aligned Thresholds

All k6 tests are configured with thresholds that directly map to our SLOs defined in `docs/SLO_SPECIFICATION.md`:

| SLO Metric | Threshold | k6 Threshold |
|------------|-----------|--------------|
| Read Latency | P95 < 200ms | `slo_read_latency: ['p(95)<200']` |
| Write Latency | P95 < 500ms | `slo_write_latency: ['p(95)<500']` |
| Sync Latency | P95 < 1000ms | `slo_sync_latency: ['p(95)<1000']` |
| Availability | > 99.9% | `slo_error_rate: ['rate<0.001']` |

## 📊 Custom Metrics

### Application Metrics
- `slo_read_latency`: Read operation latency aligned with SLO
- `slo_write_latency`: Write operation latency aligned with SLO  
- `slo_sync_latency`: Blockchain sync latency aligned with SLO
- `slo_error_rate`: Error rate for availability SLO

### WebSocket Metrics
- `ws_connection_time`: Time to establish WebSocket connection
- `ws_message_latency`: Message round-trip latency
- `ws_connection_error_rate`: WebSocket connection failure rate
- `ws_messages_received`: Count of messages received
- `ws_messages_sent`: Count of messages sent

## 🔧 Environment Configuration

### Environment Variables
- `BASE_URL`: HTTP API base URL (default: http://localhost:8080)
- `WS_URL`: WebSocket URL (default: ws://localhost:8080/ws)
- `API_KEY`: Authentication token (default: test-api-key)

### Target Environments
- **Development**: Local Docker environment for PR testing
- **Staging**: Staging environment for nightly baseline runs

## 📁 Test Structure

```
k6-tests/
├── tests/
│   ├── crud-operations.js      # CRUD API load tests
│   ├── sync-operations.js      # Blockchain sync load tests
│   └── websocket-operations.js # WebSocket real-time tests
├── scripts/
│   ├── save-baseline.js        # Save performance baselines
│   └── compare-baseline.js     # Compare against baselines
├── baselines/
│   └── performance-baselines.json # Stored performance baselines
├── results/                    # Test result outputs
└── package.json               # Dependencies and scripts
```

## 🚀 Running Tests

### Local Testing
```bash
cd k6-tests

# Install dependencies
npm install

# Run individual tests
npm run test:crud
npm run test:sync  
npm run test:websocket

# Run all tests
npm run test:all

# Run with specific profiles
k6 run --vus 1 --duration 30s tests/crud-operations.js    # Smoke
k6 run --vus 10 --duration 5m tests/crud-operations.js    # Normal
k6 run --vus 50 --duration 2m tests/crud-operations.js    # Stress
```

### Baseline Management
```bash
# Save current results as baseline
npm run baseline:save

# Compare current results against baseline
npm run baseline:compare
```

## 🔄 CI/CD Integration

### Nightly Performance Testing
- **Schedule**: 2 AM UTC daily
- **Environment**: Staging
- **Profile**: Normal load
- **Artifacts**: Baselines, results, reports
- **Duration**: ~30 minutes

### PR Performance Validation  
- **Trigger**: PR to main with backend/frontend changes
- **Environment**: Development (Docker)
- **Profile**: Smoke testing
- **Failure**: Fails PR on SLO violations or regressions

### Workflow Outputs
- **Test Results**: JSON files with detailed metrics
- **Performance Baseline**: Saved for regression detection
- **Comparison Report**: Analysis vs previous baseline
- **Trend Charts**: Performance over time (future enhancement)

## 📊 Performance Analysis

### Regression Detection
- **Latency Degradation**: >15% increase triggers regression alert
- **Error Rate Increase**: >2% increase triggers regression alert  
- **Throughput Decrease**: >10% decrease triggers regression alert

### SLO Violation Detection
- Tests fail immediately on SLO threshold violations
- More critical than performance regressions
- Blocks PR merges and triggers alerts

### Baseline Evolution
- Nightly runs update baselines on success
- Baselines stored as artifacts with 90-day retention
- Git commit SHA tracking for baseline correlation

## 🎯 Business Impact

### Quality Gates
- **Feature Development**: New features must pass performance tests
- **Deployment Blocking**: SLO violations block deployments
- **Capacity Planning**: Stress test results inform scaling decisions

### Performance Budget
- Each test scenario has defined performance budget
- Budget aligned with SLO error budgets
- Violations consume error budget and trigger alerts

## 🔮 Future Enhancements

### Planned Features
- [ ] Performance trend charts in Grafana
- [ ] Automated scaling tests
- [ ] Geographic load distribution
- [ ] Database-specific performance tests
- [ ] Real user monitoring (RUM) correlation
