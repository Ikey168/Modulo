# OpenTelemetry Observability Stack for Modulo

This directory contains the complete observability stack for the Modulo platform, implementing distributed tracing, metrics collection, and log correlation using OpenTelemetry.

## Components

### 1. OpenTelemetry Collector (`otel-collector.yaml`)
- Receives traces, metrics, and logs from applications
- Processes and exports data to backends (Tempo, Prometheus, Loki)
- Configurable pipelines for different data types

### 2. Tempo (Tracing Backend) (`tempo.yaml`)
- Distributed tracing storage and query
- Compatible with Grafana for visualization
- S3-compatible storage for trace data

### 3. Loki (Log Aggregation) (`loki.yaml`)
- Log aggregation and storage
- Integrates with Grafana for log visualization
- Supports log correlation with traces

### 4. Grafana (`grafana.yaml`)
- Unified observability dashboard
- Trace, metrics, and log visualization
- Pre-configured dashboards for Modulo

### 5. Prometheus (`prometheus.yaml`)
- Metrics collection and storage
- Application and infrastructure metrics
- Alerting rules for monitoring

### 6. AlertManager (`alertmanager.yaml`)
- Alert routing and notification
- Integration with Slack, email, PagerDuty
- Escalation policies

## Features

- **Distributed Tracing**: End-to-end request tracing across all services
- **Metrics Collection**: Custom application metrics + infrastructure metrics
- **Log Correlation**: Logs automatically correlated with traces using trace/span IDs
- **Service Map**: Visual representation of service dependencies
- **Performance Monitoring**: Request latency, error rates, throughput
- **Custom Dashboards**: Business-specific metrics and KPIs

## Quick Start

1. Deploy the observability stack:
   ```bash
   kubectl apply -f k8s/observability/
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
