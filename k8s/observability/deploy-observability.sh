#!/bin/bash

# Deploy OpenTelemetry Observability Stack for Modulo
# This script sets up the complete observability infrastructure

set -e

echo "🔍 Deploying OpenTelemetry Observability Stack for Modulo..."

# Create observability namespace if it doesn't exist
echo "📦 Creating observability namespace..."
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: observability
  labels:
    name: observability
EOF

# Deploy components in order
echo "🚀 Deploying OpenTelemetry Collector..."
kubectl apply -f k8s/observability/otel-collector.yaml

echo "📊 Deploying Tempo (Tracing Backend)..."
kubectl apply -f k8s/observability/tempo.yaml

echo "📈 Deploying Prometheus (Metrics)..."
kubectl apply -f k8s/observability/prometheus.yaml

echo "📝 Deploying Loki (Logs)..."
kubectl apply -f k8s/observability/loki.yaml

echo "📊 Deploying Grafana (Visualization)..."
kubectl apply -f k8s/observability/grafana.yaml

# Wait for deployments to be ready
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/otel-collector -n observability
kubectl wait --for=condition=available --timeout=300s deployment/tempo -n observability
kubectl wait --for=condition=available --timeout=300s deployment/prometheus -n observability
kubectl wait --for=condition=available --timeout=300s deployment/loki -n observability
kubectl wait --for=condition=available --timeout=300s deployment/grafana -n observability

echo "✅ OpenTelemetry Observability Stack deployed successfully!"
echo ""
echo "🔗 Access URLs (using port-forward):"
echo "   Grafana:    kubectl port-forward svc/grafana 3000:3000 -n observability"
echo "               http://localhost:3000 (admin/admin)"
echo ""
echo "   Prometheus: kubectl port-forward svc/prometheus 9090:9090 -n observability"
echo "               http://localhost:9090"
echo ""
echo "   Tempo:      Integrated with Grafana for trace exploration"
echo "   Loki:       Integrated with Grafana for log exploration"
echo ""
echo "📊 Pre-configured Dashboards:"
echo "   - Modulo Overview (application metrics)"
echo "   - HTTP Request Performance"
echo "   - Database Performance"
echo "   - WebSocket Metrics"
echo "   - Error Tracking"
echo ""
echo "🔍 Observability Features:"
echo "   ✓ Distributed tracing with OpenTelemetry"
echo "   ✓ Application metrics with Prometheus"
echo "   ✓ Log correlation with trace IDs"
echo "   ✓ Service dependency mapping"
echo "   ✓ Performance monitoring"
echo "   ✓ Error rate tracking"
echo "   ✓ Custom business metrics"
echo ""
echo "💡 Next Steps:"
echo "   1. Deploy/redeploy your applications to enable OpenTelemetry instrumentation"
echo "   2. Check Grafana dashboards for metrics and traces"
echo "   3. Explore traces in Tempo through Grafana"
echo "   4. Set up alerts in Prometheus for monitoring"
