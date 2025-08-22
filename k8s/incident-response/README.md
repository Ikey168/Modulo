# Incident Response and On-Call System

This directory contains the incident response infrastructure including on-call paging, status page, and postmortem processes.

## Components

### 1. On-Call Paging System
- **PagerDuty Integration**: Service definitions, schedules, and escalation policies
- **Alert Routing**: Prometheus AlertManager integration with PagerDuty
- **Escalation Policies**: Multi-tier escalation with automatic handoff

### 2. Status Page
- **Public Status Page**: Real-time system status for users
- **Synthetic Monitoring**: Automated health checks and status updates
- **Incident Communication**: Automated status updates during incidents

### 3. Postmortem Process
- **Blameless Postmortem Template**: Structured incident analysis
- **Tabletop Drills**: Regular incident response training
- **Documentation**: Process guides and runbooks

## Deployment

1. **Configure PagerDuty API Keys**:
   ```bash
   kubectl create secret generic pagerduty-secrets \
     --from-literal=api-key="YOUR_PAGERDUTY_API_KEY" \
     --from-literal=routing-key="YOUR_ROUTING_KEY" \
     -n incident-response
   ```

2. **Deploy Incident Response Infrastructure**:
   ```bash
   ./deploy.sh
   ```

3. **Configure Status Page**:
   - Access status page at: `https://status.modulo.example.com`
   - Configure synthetic checks in `03-status-page.yaml`

## On-Call Schedule

### Primary Schedule
- **Week 1-2**: DevOps Team Lead
- **Week 3-4**: Senior SRE
- **Backup**: Platform Team Manager

### Escalation Policy
1. **Level 1**: Primary on-call (immediate notification)
2. **Level 2**: Secondary on-call (after 15 minutes)
3. **Level 3**: Manager escalation (after 30 minutes)
4. **Level 4**: Executive escalation (after 1 hour)

## Alert Thresholds

### Critical Alerts (Page Immediately)
- Service downtime > 2 minutes
- Error rate > 10%
- Response time > 5 seconds
- Database connection failures
- Payment processing failures

### Warning Alerts (Slack Only)
- Error rate > 5%
- Response time > 3 seconds
- High memory/CPU usage (>80%)
- Disk space low (<20%)

## Testing

### Test Page Delivery
```bash
# Test PagerDuty integration
kubectl exec -it deploy/incident-manager -n incident-response -- \
  python test_paging.py
```

### Status Page Validation
- Verify synthetic checks are running
- Test incident creation and status updates
- Validate public accessibility

## Postmortem Process

1. **Immediate Response** (during incident)
   - Acknowledge alert in PagerDuty
   - Update status page
   - Begin incident response

2. **Post-Incident Analysis** (within 24 hours)
   - Use postmortem template
   - Schedule blameless review meeting
   - Document lessons learned

3. **Follow-up Actions** (within 1 week)
   - Implement preventive measures
   - Update runbooks
   - Share learnings with team

## Monitoring Metrics

- **MTTR (Mean Time to Repair)**: Target < 30 minutes
- **MTTA (Mean Time to Acknowledge)**: Target < 5 minutes
- **Availability**: Target 99.9% uptime
- **Page Success Rate**: Target 100% delivery

## Resources

- [PagerDuty Console](https://modulo.pagerduty.com)
- [Status Page](https://status.modulo.example.com)
- [Incident Response Runbook](./docs/incident-response-runbook.md)
- [Postmortem Templates](./docs/postmortem-template.md)
