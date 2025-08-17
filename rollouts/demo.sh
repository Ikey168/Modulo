#!/bin/bash

# Argo Rollouts Canary Deployment Demo Script

set -e

echo "🚀 Argo Rollouts Canary Deployment Demo"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Check if Argo Rollouts plugin is available
if ! kubectl argo rollouts version &> /dev/null; then
    echo -e "${YELLOW}⚠️  Installing Argo Rollouts kubectl plugin...${NC}"
    curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
    chmod +x ./kubectl-argo-rollouts-linux-amd64
    sudo mv ./kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
fi

# Function to wait for user input
wait_for_input() {
    echo -e "${BLUE}Press Enter to continue...${NC}"
    read
}

# Function to check rollout status
check_rollout_status() {
    echo -e "${BLUE}📊 Current Rollout Status:${NC}"
    kubectl argo rollouts get rollout modulo-api-rollout -n modulo
}

# Function to show canary metrics
show_metrics() {
    echo -e "${BLUE}📈 Canary Metrics:${NC}"
    echo "Success Rate:"
    kubectl exec -n monitoring deployment/prometheus-server -- \
        promtool query instant 'sum(rate(http_requests_total{job="modulo-api-rollout",code!~"5.."}[2m])) / sum(rate(http_requests_total{job="modulo-api-rollout"}[2m]))'
    
    echo "95th Percentile Latency:"
    kubectl exec -n monitoring deployment/prometheus-server -- \
        promtool query instant 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="modulo-api-rollout"}[2m])) by (le))'
}

# Step 1: Apply the rollout configuration
echo -e "${YELLOW}📋 Step 1: Applying Rollout Configuration${NC}"
kubectl apply -f rollouts/

echo -e "${GREEN}✅ Rollout configuration applied${NC}"
wait_for_input

# Step 2: Check initial status
echo -e "${YELLOW}📋 Step 2: Checking Initial Status${NC}"
check_rollout_status
wait_for_input

# Step 3: Start a new deployment with updated image
echo -e "${YELLOW}📋 Step 3: Starting Canary Deployment${NC}"
echo "Updating image to trigger rollout..."
kubectl argo rollouts set image modulo-api-rollout modulo-api=moduloapi:v2.0.0 -n modulo

echo -e "${GREEN}✅ Canary deployment started${NC}"
wait_for_input

# Step 4: Monitor the canary progression
echo -e "${YELLOW}📋 Step 4: Monitoring Canary Progression${NC}"
echo "Watching rollout progress (Ctrl+C to continue script)..."
kubectl argo rollouts get rollout modulo-api-rollout -n modulo -w &
WATCH_PID=$!

sleep 30
kill $WATCH_PID 2>/dev/null || true

check_rollout_status
show_metrics
wait_for_input

# Step 5: Test canary traffic
echo -e "${YELLOW}📋 Step 5: Testing Canary Traffic${NC}"
echo "Testing stable traffic:"
curl -H "Host: api.modulo.local" http://localhost/actuator/health

echo -e "\nTesting canary traffic:"
curl -H "Host: api.modulo.local" -H "X-Canary: true" http://localhost/actuator/health

wait_for_input

# Step 6: Inject errors to test automatic abort
echo -e "${YELLOW}📋 Step 6: Testing Automatic Abort (Injecting Errors)${NC}"
echo "Deploying version with high error rate..."
kubectl argo rollouts set image modulo-api-rollout modulo-api=moduloapi:error-injection -n modulo

echo -e "${RED}🚨 Monitoring for automatic abort due to high error rate...${NC}"
sleep 60

check_rollout_status
show_metrics

# Check if rollout was aborted
if kubectl argo rollouts get rollout modulo-api-rollout -n modulo | grep -q "Degraded"; then
    echo -e "${GREEN}✅ Automatic abort successful! Rollout was aborted due to high error rate${NC}"
else
    echo -e "${YELLOW}⚠️  Rollout still progressing... waiting for abort${NC}"
fi

wait_for_input

# Step 7: Manual rollback
echo -e "${YELLOW}📋 Step 7: Manual Rollback${NC}"
echo "Rolling back to previous stable version..."
kubectl argo rollouts undo modulo-api-rollout -n modulo

check_rollout_status
wait_for_input

# Step 8: Promote a successful canary
echo -e "${YELLOW}📋 Step 8: Successful Canary Promotion${NC}"
echo "Deploying stable version for promotion test..."
kubectl argo rollouts set image modulo-api-rollout modulo-api=moduloapi:v2.1.0 -n modulo

echo "Waiting for canary to reach 20% traffic..."
sleep 60

echo "Manually promoting canary to 100%..."
kubectl argo rollouts promote modulo-api-rollout -n modulo

check_rollout_status
wait_for_input

# Step 9: Clean up
echo -e "${YELLOW}📋 Step 9: Demo Complete${NC}"
echo -e "${GREEN}🎉 Canary deployment demo completed successfully!${NC}"
echo ""
echo "Key features demonstrated:"
echo "✅ Progressive traffic shifting (10% → 20% → 40% → 60% → 80% → 100%)"
echo "✅ Automatic analysis based on success rate and latency"
echo "✅ Automatic abort on high error rate"
echo "✅ Manual promotion and rollback capabilities"
echo "✅ Canary traffic routing with headers"
echo ""
echo "To clean up the demo resources:"
echo "kubectl delete -f rollouts/"
