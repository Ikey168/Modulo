# Chaos Engineering Implementation for Modulo

## Overview

This directory contains chaos engineering experiments and infrastructure for testing the resilience of the Modulo application using LitmusChaos. The implementation includes pod kill experiments, network latency injection, node drain scenarios, and resource exhaustion tests.

## Quick Start

```bash
# Install LitmusChaos
kubectl apply -f 00-litmus-operator.yaml

# Create chaos namespace and RBAC
kubectl apply -f 01-chaos-namespace.yaml
kubectl apply -f 02-chaos-rbac.yaml

# Deploy chaos experiments
kubectl apply -f experiments/

# Monitor experiments
kubectl get chaosengines -A
kubectl get chaosresults -A
```

## Available Experiments

### Pod-Level Chaos
1. **Pod Deletion** (`pod-delete-*.yaml`)
   - Backend pod deletion: Tests backend service resilience
   - Frontend pod deletion: Tests load balancer and frontend resilience  
   - Database pod deletion: Tests data persistence and recovery

### Network-Level Chaos
2. **Network Latency** (`network-latency.yaml`)
   - Injects network latency to test performance degradation scenarios

3. **Network Loss** (`network-loss.yaml`)
   - Injects packet loss to test connection resilience and retry mechanisms

### Node-Level Chaos
4. **Node Drain** (`node-drain.yaml`)
   - Drains nodes to test pod rescheduling and cluster resilience

### Resource Exhaustion
5. **Memory Hog** (`memory-hog.yaml`)
   - Consumes memory to test OOM protection and scaling behavior

6. **CPU Hog** (`cpu-hog.yaml`)
   - Consumes CPU to test autoscaling and performance degradation

### 3. Node Chaos
- **node-drain.yaml**: Tests node evacuation scenarios
- **node-cpu-hog.yaml**: Tests high CPU usage
- **node-memory-hog.yaml**: Tests memory pressure

### 4. Resource Chaos
- **pod-memory-hog.yaml**: Tests memory exhaustion
- **pod-cpu-hog.yaml**: Tests CPU exhaustion
- **disk-fill.yaml**: Tests disk space exhaustion

## RPO/RTO Targets

- **Recovery Point Objective (RPO)**: 5 minutes
- **Recovery Time Objective (RTO)**: 2 minutes
- **Mean Time to Recovery (MTTR)**: < 5 minutes

## Monitoring and Observability

### Grafana Dashboard
A dedicated Grafana dashboard is available for monitoring chaos experiments:

```bash
# Access the dashboard
kubectl port-forward service/chaos-monitoring-service 3000:3000 -n modulo-chaos
# Open http://localhost:3000 (admin/chaos123)
```

### Key Metrics Monitored
- Experiment status and duration
- Application response times during chaos
- Pod restart counts and recovery times
- Resource utilization (CPU/Memory) during stress tests
- Error rates and availability metrics

### Prometheus Integration
The monitoring setup integrates with your existing Prometheus instance and provides:
- Real-time experiment status tracking
- Application performance metrics during chaos
- Resource consumption monitoring
- Automated alerting for experiment failures

## Safety Measures

- Experiments run in isolated namespaces
- Resource quotas prevent cluster-wide impact
- Automatic experiment termination after timeout
- Health checks prevent cascading failures

## Usage Examples

```bash
# Run a single experiment
kubectl apply -f experiments/pod-delete-backend.yaml

# Monitor experiment progress
kubectl logs -f -l name=chaos-operator -n litmus

# Check experiment results
kubectl get chaosresult pod-delete-backend -o yaml

# Cleanup experiments
kubectl delete chaosengines --all -n modulo-chaos
```
