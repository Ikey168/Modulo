# k6 Test Results

This directory contains k6 load test results and analysis outputs.

## 📁 Directory Structure

```
results/
├── *.json                    # Raw k6 test results
├── *-summary.json           # k6 test summaries  
├── comparison-*.json        # Baseline comparison results
└── performance-report.md    # Human-readable reports
```

## 📊 Result Files

### k6 Output Files
- **Format**: JSON with detailed metrics
- **Naming**: `{test-name}-{timestamp}.json`
- **Content**: HTTP metrics, custom metrics, check results
- **Retention**: 30 days (CI/CD), permanent (local)

### Summary Files
- **Format**: JSON summary statistics
- **Naming**: `{test-name}-summary.json`
- **Content**: Aggregated metrics, threshold results
- **Usage**: Quick performance overview

### Comparison Files
- **Format**: JSON analysis results
- **Naming**: `comparison-{timestamp}.json`
- **Content**: Baseline vs current comparison
- **Usage**: Regression detection, SLO validation

## 🎯 Metrics Included

### HTTP Metrics
- `http_req_duration`: Request latency (P50, P95, P99)
- `http_req_failed`: Error rate
- `http_reqs`: Request throughput
- `http_req_connecting`: Connection time

### Custom SLO Metrics
- `slo_read_latency`: Read operation latency
- `slo_write_latency`: Write operation latency
- `slo_sync_latency`: Sync operation latency
- `slo_error_rate`: Error rate for availability SLO

### WebSocket Metrics
- `ws_connection_time`: Connection establishment time
- `ws_message_latency`: Message round-trip latency
- `ws_connection_error_rate`: Connection failure rate

## 🔍 Analysis Tools

### View Results
```bash
# View latest test results
cat results/*.json | jq '.metrics.http_req_duration.values'

# Check SLO compliance  
cat results/comparison-*.json | jq '.summary.slo_compliance'

# View performance trends
ls -la results/*.json | head -10
```

### Generate Reports
```bash
# Run comparison analysis
node scripts/compare-baseline.js

# Save new baseline
node scripts/save-baseline.js
```

## 📈 Understanding Results

### Success Indicators
- All HTTP checks passing (status 200/201/204)
- Latency P95 within SLO thresholds
- Error rate < 0.1% (99.9% availability)
- No regression vs baseline

### Warning Indicators  
- Latency increase 5-15% vs baseline
- Error rate 0.1-1%
- Throughput decrease 5-10%

### Failure Indicators
- SLO threshold violations
- Latency increase >15% vs baseline  
- Error rate >1%
- Throughput decrease >10%

## 🚨 Troubleshooting

### High Latency
1. Check system resources (CPU, memory)
2. Verify database performance
3. Review application logs
4. Check network connectivity

### High Error Rate
1. Check application health endpoints
2. Review error logs and stack traces
3. Verify API authentication
4. Check service dependencies

### Low Throughput
1. Check connection limits
2. Review rate limiting settings
3. Verify load balancer configuration  
4. Check application thread pools

## 🔄 CI/CD Integration

### Artifact Upload
- Results uploaded to GitHub Actions artifacts
- 30-day retention for debugging
- Accessible via workflow run page

### Failure Handling
- Exit code 0: Success, continue pipeline
- Exit code 1: Regressions detected, fail build
- Exit code 2: SLO violations, fail build immediately

### Baseline Updates
- Nightly runs update baselines on success
- Baselines stored with 90-day retention
- Git commit correlation for traceability
