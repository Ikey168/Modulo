# Performance Baselines

This directory stores performance baselines for regression detection and SLO compliance validation.

## 📊 Baseline Structure

### Baseline File Format
```json
{
  "metadata": {
    "created": "2025-08-18T02:00:00Z",
    "version": "1.0.0",
    "environment": "staging",
    "git_commit": "abc123def",
    "slo_thresholds": {
      "read_latency_p95": 200,
      "write_latency_p95": 500,
      "sync_latency_p95": 1000,
      "availability": 99.9
    }
  },
  "baselines": {
    "read_latency_p95": {
      "min": 120,
      "max": 180,
      "avg": 150,
      "p50": 145,
      "p95": 170,
      "p99": 175,
      "samples": 100
    }
  },
  "slo_compliance": {
    "read_latency_p95": {
      "threshold": 200,
      "baseline_p95": 170,
      "compliant": true,
      "margin": 30
    }
  }
}
```

## 🎯 SLO Baseline Mapping

| Baseline Metric | SLO Threshold | Purpose |
|-----------------|---------------|---------|
| `read_latency_p95` | 200ms | Read operation performance |
| `write_latency_p95` | 500ms | Write operation performance |
| `sync_latency_p95` | 1000ms | Blockchain sync performance |
| `availability` | 99.9% | Overall service reliability |
| `websocket_latency_p95` | 200ms | Real-time feature performance |

## 🔄 Baseline Management

### Creation Process
1. **Nightly Runs**: Automated baseline creation from staging tests
2. **Success Criteria**: Tests must pass SLO thresholds
3. **Data Aggregation**: Multiple test runs combined for statistical validity
4. **Version Control**: Git commit tracking for correlation

### Update Strategy
- **Frequency**: Nightly for successful test runs
- **Validation**: New baselines must meet SLO requirements
- **Rollback**: Previous baselines preserved for comparison
- **Retention**: 90-day retention in CI/CD artifacts

## 📈 Regression Detection

### Threshold Configuration
```javascript
const REGRESSION_THRESHOLDS = {
  latency_degradation: 15,    // % increase considered regression
  error_rate_increase: 2,     // % increase considered regression  
  throughput_decrease: 10,    // % decrease considered regression
};
```

### Analysis Process
1. **Current vs Baseline**: Compare latest results to baseline P95
2. **Trend Analysis**: Evaluate performance direction over time
3. **SLO Validation**: Ensure current performance meets SLOs
4. **Regression Flagging**: Identify performance degradations

## 🚨 Compliance Monitoring

### SLO Compliance Checking
- **Green**: Performance well within SLO margins (>10% headroom)
- **Yellow**: Performance approaching SLO limits (5-10% margin)
- **Red**: SLO violations or <5% margin

### Alert Triggers
- **Critical**: SLO threshold violations
- **Warning**: Performance regressions >15%
- **Info**: New baselines established

## 🔧 Baseline Operations

### Manual Baseline Creation
```bash
# Generate baseline from current results
cd k6-tests
node scripts/save-baseline.js
```

### Baseline Comparison
```bash
# Compare current results against baseline
node scripts/compare-baseline.js
```

### Baseline Analysis
```bash
# View baseline statistics
cat baselines/performance-baselines.json | jq '.baselines'

# Check SLO compliance
cat baselines/performance-baselines.json | jq '.slo_compliance'
```

## 📊 Historical Data

### Baseline Evolution
- Track how baselines change over time
- Correlate with application changes
- Identify performance trends

### Version Correlation  
```json
{
  "metadata": {
    "git_commit": "abc123def",
    "created": "2025-08-18T02:00:00Z"
  }
}
```

### Performance Trends
- Weekly/monthly baseline comparisons
- Long-term performance trajectory
- Capacity planning insights

## 🔮 Future Enhancements

### Planned Features
- [ ] Multiple environment baselines (dev, staging, prod)
- [ ] A/B testing baseline comparisons
- [ ] Automated baseline drift detection
- [ ] Integration with Grafana for visualization
- [ ] Performance prediction modeling

### Integration Opportunities
- **Grafana Dashboards**: Baseline trend visualization
- **Prometheus**: Real-time baseline comparison
- **Alertmanager**: Baseline violation alerts
- **GitHub**: PR performance impact analysis
