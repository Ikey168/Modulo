# Chaos Engineering Runbook for Modulo Application

## Overview
This runbook provides operational procedures for chaos engineering experiments in the Modulo Kubernetes application. It includes experiment descriptions, expected behaviors, failure scenarios, and recovery procedures.

## Quick Reference

### Emergency Contacts
- **Platform Team**: #platform-alerts
- **On-Call Engineer**: See PagerDuty rotation
- **Chaos Engineering Lead**: chaos-team@company.com

### Critical Commands
```bash
# Stop all chaos experiments immediately
kubectl delete chaosengine --all -n modulo-chaos

# Check experiment status
kubectl get chaosengine -n modulo-chaos

# View experiment logs
kubectl logs -l experiment=<experiment-name> -n modulo-chaos

# Check application health
kubectl get pods -n modulo
curl http://modulo-backend-service.modulo.svc.cluster.local:8080/api/actuator/health
```

## Experiment Catalog

### 1. Pod Deletion Experiments

#### Backend Pod Deletion (`pod-delete-backend`)
**Purpose**: Test backend service resilience to pod failures
**Duration**: 30 seconds
**Impact**: 50% of backend pods deleted
**Expected Recovery**: < 30 seconds

**Failure Modes**:
- **Symptom**: Backend service completely unavailable
- **Cause**: All pods deleted simultaneously or deployment issues
- **Recovery**: 
  ```bash
  kubectl scale deployment modulo-backend --replicas=3 -n modulo
  kubectl rollout restart deployment modulo-backend -n modulo
  ```

- **Symptom**: Database connection errors
- **Cause**: Connection pool exhaustion during pod restart
- **Recovery**: Restart database pods to reset connections
  ```bash
  kubectl rollout restart deployment postgres -n modulo
  ```

#### Frontend Pod Deletion (`pod-delete-frontend`)
**Purpose**: Test frontend service resilience and load balancer behavior
**Duration**: 30 seconds
**Impact**: 50% of frontend pods deleted
**Expected Recovery**: < 20 seconds

**Failure Modes**:
- **Symptom**: 502/503 errors from ingress
- **Cause**: No healthy frontend pods available
- **Recovery**: Scale up frontend deployment
  ```bash
  kubectl scale deployment modulo-frontend --replicas=3 -n modulo
  ```

#### Database Pod Deletion (`pod-delete-database`)
**Purpose**: Test database persistence and failover
**Duration**: 20 seconds
**Impact**: 100% of database pods (single pod)
**Expected Recovery**: < 60 seconds

**Failure Modes**:
- **Symptom**: Database connection failures persist > 2 minutes
- **Cause**: PVC mount issues or corrupted data
- **Recovery**: 
  ```bash
  # Check PVC status
  kubectl get pvc -n modulo
  # Force pod recreation
  kubectl delete pod -l app=postgres -n modulo
  # If data corruption suspected, restore from backup
  kubectl apply -f database/restore-backup.yaml
  ```

### 2. Network Chaos Experiments

#### Network Latency (`network-latency`)
**Purpose**: Test application performance under network degradation
**Duration**: 60 seconds
**Impact**: 1000ms latency on backend pods
**Expected Behavior**: Response time increase, but service remains available

**Failure Modes**:
- **Symptom**: Request timeouts (> 30s response time)
- **Cause**: Cumulative latency effects
- **Recovery**: 
  ```bash
  # Immediately stop experiment
  kubectl delete chaosengine network-latency-backend -n modulo-chaos
  # Check for stuck network filters
  kubectl exec -it <backend-pod> -n modulo -- netstat -an
  ```

#### Network Loss (`network-loss`)
**Purpose**: Test resilience to packet loss
**Duration**: 30 seconds  
**Impact**: 50% packet loss on database pods
**Expected Behavior**: Connection retries succeed, temporary service degradation

**Failure Modes**:
- **Symptom**: Complete database unavailability
- **Cause**: All connections dropped simultaneously
- **Recovery**: Restart affected pods to reset network stack
  ```bash
  kubectl rollout restart deployment postgres -n modulo
  ```

### 3. Node-Level Chaos

#### Node Drain (`node-drain`)
**Purpose**: Test pod rescheduling and cluster resilience
**Duration**: 60 seconds
**Impact**: Entire node drained and cordoned
**Expected Behavior**: Pods reschedule to healthy nodes

**Failure Modes**:
- **Symptom**: Pods stuck in Pending state
- **Cause**: Insufficient resources on remaining nodes
- **Recovery**: 
  ```bash
  # Uncordon the drained node
  kubectl uncordon <node-name>
  # Check resource availability
  kubectl describe nodes
  # Scale down non-critical workloads if needed
  ```

- **Symptom**: Persistent volumes not attaching to new pods
- **Cause**: PV tied to specific node/zone
- **Recovery**: 
  ```bash
  # Check PV node affinity
  kubectl describe pv <pv-name>
  # Force pod deletion to trigger rescheduling
  kubectl delete pod <stuck-pod> -n modulo --force
  ```

### 4. Resource Exhaustion

#### Memory Hog (`memory-hog`)
**Purpose**: Test application behavior under memory pressure
**Duration**: 120 seconds
**Impact**: 512MB memory consumption on backend pods
**Expected Behavior**: OOM protection triggers, pods restart gracefully

**Failure Modes**:
- **Symptom**: Pods killed by OOMKiller repeatedly
- **Cause**: Memory limits too low or memory leak
- **Recovery**: 
  ```bash
  # Increase memory limits temporarily
  kubectl patch deployment modulo-backend -n modulo -p '{"spec":{"template":{"spec":{"containers":[{"name":"modulo-backend","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
  # Stop memory hog experiment
  kubectl delete chaosengine memory-hog-backend -n modulo-chaos
  ```

#### CPU Hog (`cpu-hog`)
**Purpose**: Test application performance under CPU pressure
**Duration**: 90 seconds
**Impact**: 2 CPU cores consumed on backend pods
**Expected Behavior**: HPA triggers scaling, performance degrades gracefully

**Failure Modes**:
- **Symptom**: HPA not scaling despite high CPU
- **Cause**: Metrics server issues or HPA misconfiguration
- **Recovery**: 
  ```bash
  # Check metrics server
  kubectl top pods -n modulo
  # Manually scale if needed
  kubectl scale deployment modulo-backend --replicas=5 -n modulo
  # Restart metrics server if not working
  kubectl rollout restart deployment metrics-server -n kube-system
  ```

## Monitoring and Alerting

### Key Metrics to Monitor
- **Application Response Time**: < 2s (95th percentile)
- **Error Rate**: < 1% during experiments, < 0.1% during normal operation
- **Pod Restart Count**: Monitor for excessive restarts
- **Resource Utilization**: CPU < 80%, Memory < 80%

### Alert Thresholds
- **Critical**: Error rate > 5% for 2 minutes
- **Warning**: Response time > 5s for 1 minute
- **Info**: Experiment started/completed

### Grafana Dashboard
Access the chaos engineering dashboard at:
`http://chaos-monitoring-service.modulo-chaos.svc.cluster.local:3000`

Default credentials: admin/chaos123

## Pre-Experiment Checklist

1. **Environment Verification**
   - [ ] All application pods running and healthy
   - [ ] Monitoring systems operational
   - [ ] Backup systems verified
   - [ ] On-call engineer notified

2. **Safety Checks**
   - [ ] Production traffic is low (< 50% capacity)
   - [ ] No ongoing deployments
   - [ ] No scheduled maintenance windows
   - [ ] Circuit breakers configured

3. **Rollback Preparation**
   - [ ] Experiment stop procedures documented
   - [ ] Emergency contact list updated
   - [ ] Rollback scripts tested

## Post-Experiment Procedures

1. **Immediate Actions** (within 5 minutes)
   - [ ] Verify all systems returned to normal
   - [ ] Check for any lingering effects
   - [ ] Document any unexpected behaviors

2. **Analysis Phase** (within 24 hours)
   - [ ] Review metrics and logs
   - [ ] Identify improvement opportunities
   - [ ] Update runbooks based on learnings
   - [ ] Share results with team

3. **Follow-up Actions** (within 1 week)
   - [ ] Implement identified improvements
   - [ ] Update monitoring/alerting rules
   - [ ] Schedule follow-up experiments
   - [ ] Update disaster recovery procedures

## Troubleshooting Guide

### Common Issues

#### Experiment Stuck in Running State
```bash
# Check experiment logs
kubectl logs -l app=chaos-exporter -n modulo-chaos

# Force cleanup
kubectl delete chaosengine <experiment-name> -n modulo-chaos --force

# Clean up orphaned resources
kubectl delete pods -l chaosUID -n modulo --force
```

#### Probes Failing
```bash
# Check probe configuration
kubectl describe chaosengine <experiment-name> -n modulo-chaos

# Test probe manually
kubectl run debug --image=curlimages/curl --rm -it -- curl <probe-url>

# Update probe timeout/retry values
kubectl patch chaosengine <experiment-name> -n modulo-chaos --type='merge' -p='{"spec":{"experiments":[{"spec":{"probe":[{"runProperties":{"probeTimeout":60}}]}}]}}'
```

#### Resource Constraints
```bash
# Check chaos namespace resources
kubectl describe namespace modulo-chaos

# Check pod resource usage
kubectl top pods -n modulo-chaos

# Increase resource limits if needed
kubectl patch deployment chaos-operator-ce -n litmus --type='merge' -p='{"spec":{"template":{"spec":{"containers":[{"name":"chaos-operator-ce","resources":{"limits":{"cpu":"500m","memory":"1Gi"}}}]}}}}'
```

## Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

### RTO Targets
- **Pod Failures**: 30 seconds
- **Network Issues**: 60 seconds  
- **Node Failures**: 120 seconds
- **Database Issues**: 300 seconds

### RPO Targets
- **Database**: 5 minutes (continuous backup)
- **Application State**: Real-time (stateless)
- **Configuration**: 24 hours (GitOps)

## Escalation Procedures

### Level 1: Automated Recovery
- Circuit breakers activate
- Health checks trigger pod restarts
- HPA scales resources automatically

### Level 2: On-Call Response
- Manual intervention required
- Contact on-call engineer
- Execute runbook procedures

### Level 3: Team Escalation
- Multiple system failures
- RTO/RPO exceeded
- Engage platform team and management

## Safety Controls

### Circuit Breakers
- **Backend Service**: 50% error rate for 30 seconds
- **Database Connections**: 10 consecutive failures
- **External APIs**: 3 consecutive timeouts

### Rate Limiting
- **Experiment Frequency**: Max 1 per hour per component
- **Concurrent Experiments**: Max 2 active simultaneously
- **Blast Radius**: Max 50% of resources affected

### Kill Switches
```bash
# Emergency stop all experiments
kubectl delete chaosengine --all -n modulo-chaos

# Disable chaos operator
kubectl scale deployment chaos-operator-ce --replicas=0 -n litmus

# Emergency scale up all services
kubectl scale deployment modulo-backend --replicas=5 -n modulo
kubectl scale deployment modulo-frontend --replicas=3 -n modulo
```

## Learning and Improvement

### Experiment Results Template
```markdown
## Experiment: [Name]
**Date**: [Date]
**Duration**: [Duration]
**Hypothesis**: [Expected outcome]

### Results
- **Actual Behavior**: [What happened]
- **Metrics**: [Key measurements]
- **Issues Found**: [Problems identified]

### Actions
- **Immediate Fixes**: [Quick fixes applied]
- **Long-term Improvements**: [Planned improvements]
- **Next Experiments**: [Follow-up tests]
```

### Improvement Tracking
- Monthly chaos engineering review meetings
- Quarterly RTO/RPO target reviews
- Annual disaster recovery plan updates
- Continuous runbook improvements based on experiment learnings

## References

- [LitmusChaos Documentation](https://docs.litmuschaos.io/)
- [Kubernetes Troubleshooting Guide](https://kubernetes.io/docs/tasks/debug-application-cluster/)
- [Prometheus Monitoring Best Practices](https://prometheus.io/docs/practices/)
- [SRE Best Practices](https://sre.google/)
