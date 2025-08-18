#!/bin/bash

# 🚀 Deploy Enhanced Observability Stack for Modulo
# Issue #102: Grafana dashboards + Prometheus alerts (golden signals)

set -euo pipefail

# Configuration
NAMESPACE="observability"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBSERVABILITY_DIR="$SCRIPT_DIR/observability"

echo "🔧 Deploying Enhanced Observability Stack..."

# Create namespace if it doesn't exist
echo "📦 Ensuring namespace exists..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply observability components in order
echo "🔍 Deploying Prometheus with enhanced alerting..."
kubectl apply -f "$OBSERVABILITY_DIR/prometheus.yaml"

echo "🚨 Deploying Alertmanager..."
kubectl apply -f "$OBSERVABILITY_DIR/alertmanager.yaml"

echo "📊 Deploying Grafana dashboards..."
kubectl apply -f "$OBSERVABILITY_DIR/grafana-dashboards.yaml"
kubectl apply -f "$OBSERVABILITY_DIR/grafana.yaml"

echo "📈 Deploying Tempo for distributed tracing..."
kubectl apply -f "$OBSERVABILITY_DIR/tempo.yaml"

echo "📋 Deploying Loki for log aggregation..."
kubectl apply -f "$OBSERVABILITY_DIR/loki.yaml"

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."

# Check Prometheus
echo "🔍 Checking Prometheus..."
kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n $NAMESPACE

# Check Alertmanager
echo "🚨 Checking Alertmanager..."
kubectl wait --for=condition=available --timeout=300s deployment/alertmanager -n $NAMESPACE

# Check Grafana
echo "📊 Checking Grafana..."
kubectl wait --for=condition=available --timeout=300s deployment/grafana -n $NAMESPACE

# Check Tempo
echo "📈 Checking Tempo..."
kubectl wait --for=condition=available --timeout=300s deployment/tempo -n $NAMESPACE

# Check Loki
echo "📋 Checking Loki..."
kubectl wait --for=condition=available --timeout=300s deployment/loki -n $NAMESPACE

echo "✅ Enhanced Observability Stack deployed successfully!"

# Display access information
echo ""
echo "🌐 Access Information:"
echo "===================="
echo "Grafana:      http://localhost:3000 (admin/admin)"
echo "Prometheus:   http://localhost:9090"
echo "Alertmanager: http://localhost:9093"
echo "Tempo:        http://localhost:3200"
echo "Loki:         http://localhost:3100"
echo ""
echo "📊 Golden Signals Dashboards:"
echo "- 🚀 Application Performance (Golden Signals)"
echo "- ☕ JVM Performance Monitoring"
echo "- 🗄️ Database Performance"
echo "- 🔗 Sync & Blockchain Operations"
echo ""
echo "🚨 Prometheus Alerts Configured:"
echo "- High Error Rate (>5% critical, >1% warning)"
echo "- High P95 Latency (>1000ms critical, >500ms warning)"
echo "- High CPU/Memory Saturation (>85%)"
echo "- Database Connection Pool Alerts"
echo "- WebSocket Connection Monitoring"
echo "- Blockchain Operation Failures"
echo ""

# Port forwarding commands for local access
echo "🔗 To access services locally, run:"
echo "kubectl port-forward -n $NAMESPACE svc/grafana 3000:3000 &"
echo "kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090 &"
echo "kubectl port-forward -n $NAMESPACE svc/alertmanager 9093:9093 &"
echo "kubectl port-forward -n $NAMESPACE svc/tempo 3200:3200 &"
echo "kubectl port-forward -n $NAMESPACE svc/loki 3100:3100 &"
echo ""

# Test alert firing
echo "🧪 Testing alert configuration..."
echo "To test an alert, you can simulate high error rate:"
echo "curl -X POST http://localhost:8080/api/test/error-rate"
echo ""

echo "🎉 Deployment complete! Golden signals monitoring is now active."
