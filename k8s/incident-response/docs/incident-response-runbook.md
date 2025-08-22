# Incident Response Runbook

## Overview

This runbook provides step-by-step procedures for responding to incidents in the Modulo platform. It covers detection, escalation, communication, and resolution procedures.

## Incident Severity Levels

### Critical (P0)
- **Definition:** Complete service outage or data loss
- **Response Time:** Immediate (< 5 minutes)
- **Escalation:** Page on-call immediately, notify management
- **Examples:**
  - API completely down
  - Data corruption or loss
  - Security breach
  - Payment processing failure

### High (P1)
- **Definition:** Major service degradation affecting many users
- **Response Time:** < 15 minutes
- **Escalation:** Page on-call, notify team lead
- **Examples:**
  - High error rates (>10%)
  - Significant performance degradation
  - Login system down
  - Database connection issues

### Medium (P2)
- **Definition:** Minor service degradation or single component failure
- **Response Time:** < 1 hour
- **Escalation:** Slack notification, assignable during business hours
- **Examples:**
  - Elevated error rates (5-10%)
  - Minor performance issues
  - Non-critical feature unavailable
  - Monitoring system alerts

### Low (P3)
- **Definition:** Minor issues with minimal user impact
- **Response Time:** < 4 hours
- **Escalation:** Create ticket, handle during business hours
- **Examples:**
  - Documentation issues
  - Minor UI glitches
  - Non-urgent maintenance needs

## Incident Response Process

### 1. Detection and Acknowledgment

#### When an Alert Fires:
1. **Acknowledge the alert** in PagerDuty within 5 minutes
2. **Check the status page** and monitoring dashboards
3. **Verify the issue** by attempting to reproduce
4. **Assess severity** using the criteria above

#### Initial Assessment Checklist:
- [ ] Can users access the main application?
- [ ] Are critical APIs responding?
- [ ] Is data being processed correctly?
- [ ] Are payments working?
- [ ] How many users are affected?

### 2. Initial Response

#### For P0/P1 Incidents:
1. **Update status page** with initial information
2. **Create incident channel** in Slack (#incident-YYYYMMDD-brief-description)
3. **Notify stakeholders** via established communication channels
4. **Begin investigation** following troubleshooting procedures

#### Communication Template:
```
🚨 INCIDENT ALERT - P[0/1]
Title: [Brief description]
Status: Investigating
Impact: [User/service impact]
ETA: [If known]
Updates: Every 15 minutes or when status changes
Incident Channel: #incident-YYYYMMDD-description
```

### 3. Investigation and Diagnosis

#### Investigation Steps:
1. **Check recent deployments**
   ```bash
   kubectl get events --sort-by='.firstTimestamp'
   kubectl logs -l app=modulo-api --tail=100
   ```

2. **Review monitoring dashboards**
   - Grafana: System metrics, application metrics
   - Prometheus: Active alerts and their history
   - Status page: Service health checks

3. **Check infrastructure status**
   ```bash
   kubectl get nodes
   kubectl get pods --all-namespaces
   kubectl top nodes
   kubectl top pods --all-namespaces
   ```

4. **Review database health**
   ```bash
   kubectl exec -it postgres-0 -- psql -U postgres -c "SELECT version();"
   kubectl logs postgres-0 --tail=50
   ```

#### Common Issues Troubleshooting:

##### API Service Down
1. Check pod status: `kubectl get pods -l app=modulo-api`
2. Check logs: `kubectl logs -l app=modulo-api --tail=100`
3. Check resource usage: `kubectl describe pod [pod-name]`
4. Check service/ingress: `kubectl get svc,ingress`

##### Database Issues
1. Check PostgreSQL logs: `kubectl logs postgres-0`
2. Check connections: `kubectl exec -it postgres-0 -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"`
3. Check disk space: `kubectl exec -it postgres-0 -- df -h`

##### High Error Rate
1. Check application logs for error patterns
2. Review recent deployments for correlation
3. Check external service dependencies
4. Monitor error rate trend in Grafana

##### Performance Issues
1. Check CPU/memory usage across nodes and pods
2. Review database query performance
3. Check network latency and throughput
4. Review recent configuration changes

### 4. Resolution and Communication

#### Resolution Steps:
1. **Apply fix** following established change procedures
2. **Verify resolution** using monitoring and manual testing
3. **Update status page** with resolution status
4. **Communicate resolution** to stakeholders

#### Resolution Verification Checklist:
- [ ] Primary service functionality restored
- [ ] Error rates back to normal levels
- [ ] Response times within acceptable range
- [ ] No new related alerts firing
- [ ] Status page shows all systems operational

#### Communication Update Template:
```
✅ INCIDENT RESOLVED - P[0/1]
Title: [Brief description]
Status: Resolved
Resolution: [Brief description of fix]
Duration: [Total incident duration]
Next Steps: Postmortem scheduled for [date/time]
```

### 5. Post-Incident Activities

#### Immediate (Within 1 hour):
- [ ] Update final status page message
- [ ] Close incident channel after summary
- [ ] Begin collecting timeline data
- [ ] Schedule postmortem meeting

#### Within 24 hours:
- [ ] Complete postmortem draft
- [ ] Identify immediate action items
- [ ] Implement urgent preventive measures

#### Within 1 week:
- [ ] Conduct blameless postmortem review
- [ ] Finalize action items with owners and dates
- [ ] Share lessons learned with team
- [ ] Update runbooks and documentation

## Emergency Contacts

### On-Call Escalation
1. **Primary On-Call:** [Check PagerDuty schedule]
2. **Secondary On-Call:** [Check PagerDuty schedule]
3. **Manager Escalation:** [Manager contact]
4. **Executive Escalation:** [Executive contact]

### Key Personnel
- **DevOps Lead:** [Contact info]
- **Backend Lead:** [Contact info]
- **Frontend Lead:** [Contact info]
- **Database Admin:** [Contact info]
- **Security Lead:** [Contact info]

### External Vendors
- **Cloud Provider:** [Support contact]
- **CDN Provider:** [Support contact]
- **Payment Processor:** [Support contact]
- **Email Service:** [Support contact]

## Tools and Resources

### Monitoring and Alerting
- **Grafana:** https://grafana.modulo.example.com
- **Prometheus:** https://prometheus.modulo.example.com
- **PagerDuty:** https://modulo.pagerduty.com
- **Status Page:** https://status.modulo.example.com

### Infrastructure
- **Kubernetes Dashboard:** https://k8s-dashboard.modulo.example.com
- **Cloud Console:** [Cloud provider console]
- **CI/CD Pipeline:** [Pipeline URL]

### Communication
- **Incident Slack Channel:** #incidents
- **Team Slack Channel:** #devops
- **Status Page Admin:** [Admin URL]

### Documentation
- **Architecture Docs:** [Documentation URL]
- **Deployment Procedures:** [Procedure docs]
- **Configuration Management:** [Config repo]

## Quick Reference Commands

### Kubernetes Debugging
```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes
kubectl get events --sort-by=.metadata.creationTimestamp

# Check application pods
kubectl get pods -o wide
kubectl describe pod [pod-name]
kubectl logs [pod-name] --previous

# Check services and ingress
kubectl get svc,ingress
kubectl describe ingress [ingress-name]

# Check resource usage
kubectl top nodes
kubectl top pods --all-namespaces
```

### Database Debugging
```bash
# Connect to database
kubectl exec -it postgres-0 -- psql -U postgres

# Check database status
kubectl exec -it postgres-0 -- psql -U postgres -c "SELECT version();"
kubectl exec -it postgres-0 -- psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"

# Check disk space
kubectl exec -it postgres-0 -- df -h
```

### Log Analysis
```bash
# Application logs
kubectl logs -l app=modulo-api --tail=100 -f
kubectl logs -l app=modulo-frontend --tail=100 -f

# System logs
kubectl logs -n kube-system -l k8s-app=kube-dns
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
```

## Escalation Procedures

### When to Escalate
- Unable to resolve P0 incident within 30 minutes
- Unable to resolve P1 incident within 1 hour
- Incident requires specialized expertise
- Multiple systems affected
- Security implications identified

### How to Escalate
1. **Update PagerDuty** with escalation request
2. **Call manager directly** for urgent situations
3. **Post in #incidents** with @channel for team assistance
4. **Contact external vendors** if infrastructure issue

### External Escalation
- **Cloud Provider:** For infrastructure issues
- **Payment Processor:** For payment-related incidents
- **Security Team:** For security incidents
- **Legal/Compliance:** For data breach situations

## Training and Preparation

### Regular Drills
- **Monthly tabletop exercises**
- **Quarterly failover tests**
- **Annual disaster recovery tests**

### Skills Development
- **Incident response training** for all on-call personnel
- **Tool familiarity sessions**
- **Postmortem review meetings**

### Documentation Maintenance
- **Monthly runbook reviews**
- **Quarterly escalation contact updates**
- **Annual procedure validation**
