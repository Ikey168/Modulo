# Tabletop Drill #1: Database Connection Failure

## Drill Overview

**Date:** [To be scheduled]  
**Duration:** 60 minutes  
**Participants:** DevOps team, Backend team, On-call engineers  
**Facilitator:** [Incident Response Lead]  
**Drill Type:** Database failure scenario  

### Objectives
- Test incident response procedures for database failures
- Validate escalation and communication processes
- Identify gaps in monitoring and alerting
- Practice blameless postmortem process

## Scenario Description

### Initial Conditions
- **Time:** Monday, 2:30 PM UTC (peak traffic time)
- **System State:** Normal operations, all systems green
- **Recent Changes:** Database minor version upgrade completed 2 hours ago
- **Current Load:** 70% of normal peak capacity

### The Incident

**2:30 PM:** Multiple alerts start firing:
- PostgreSQL connection timeouts
- API error rate spike to 45%
- User login failures
- Payment processing errors

**Symptoms Observed:**
- Users unable to log in
- Existing sessions still work but can't perform database operations
- Status page showing degraded performance
- Customer support tickets increasing rapidly

### Technical Details
- **Root Cause:** PostgreSQL max_connections limit reached due to connection leak in new code
- **Affected Services:** All services requiring database access
- **User Impact:** ~80% of users affected, unable to perform key actions
- **Data Integrity:** No data loss, but new data not being persisted

## Drill Execution

### Phase 1: Detection and Initial Response (10 minutes)

#### Inject 1: Alerts Start Firing
**Facilitator says:** "PagerDuty alert: Critical - Database connection failures detected. Who acknowledges this alert and what are your immediate actions?"

**Expected Actions:**
- [ ] Primary on-call acknowledges alert within 5 minutes
- [ ] Check monitoring dashboards (Grafana/Prometheus)
- [ ] Verify issue by attempting to reproduce
- [ ] Update status page with "Investigating" status
- [ ] Create incident Slack channel

**Discussion Points:**
- How quickly was the alert acknowledged?
- What information was needed that wasn't immediately available?
- Was the severity assessment correct?

#### Inject 2: Status Page Decision
**Facilitator says:** "You've confirmed the issue affects user logins and payments. Customer support is getting calls. What's your status page update?"

**Expected Response:**
- Update status page with specific impact
- Set up communication cadence
- Notify internal stakeholders

### Phase 2: Investigation and Diagnosis (15 minutes)

#### Inject 3: Initial Investigation
**Facilitator says:** "Show me your investigation approach. Walk through the steps you'd take to diagnose this database issue."

**Expected Actions:**
- [ ] Check database connection metrics
- [ ] Review PostgreSQL logs
- [ ] Check for recent deployments/changes
- [ ] Verify database server health (CPU, memory, disk)
- [ ] Check connection pool configurations

**Technical Information Provided:**
```
Database logs show:
FATAL: sorry, too many clients already
FATAL: remaining connection slots are reserved for non-replication superuser connections
```

**Connection metrics show:**
- Current connections: 100/100 (max_connections)
- Idle connections: 85
- Active connections: 15

#### Inject 4: Hypothesis Formation
**Facilitator says:** "Based on the evidence, what's your working hypothesis and next steps?"

**Expected Hypothesis:**
- Connection leak preventing new connections
- Recent deployment potentially introduced the issue
- Need to either restart services or increase connection limit

### Phase 3: Resolution and Communication (15 minutes)

#### Inject 5: Resolution Options
**Facilitator says:** "You have three options: 1) Restart all API pods, 2) Increase max_connections and restart PostgreSQL, 3) Kill idle connections. What's your choice and why?"

**Discussion Points:**
- Risk assessment of each option
- Time to implement each solution
- Potential for making the problem worse

#### Inject 6: Implementation Challenges
**Facilitator says:** "You chose to restart API pods. During restart, you notice pods are taking 3 minutes to become ready, and error rate spikes to 90%. What do you do?"

**Expected Response:**
- Monitor pod startup progress
- Consider rolling back if startup issues persist
- Communicate extended downtime estimate
- Have rollback plan ready

#### Inject 7: Partial Recovery
**Facilitator says:** "API pods are back up, error rate dropped to 15% but still above normal 2%. Connection count is now 65/100. What's your next action?"

**Expected Actions:**
- Continue monitoring for stability
- Investigate remaining errors
- Plan for proper fix deployment
- Update status page with partial recovery

### Phase 4: Post-Incident Process (15 minutes)

#### Inject 8: Incident Resolution
**Facilitator says:** "Error rate is back to normal, connections stable at 45/100. All services operational. What are your post-incident steps?"

**Expected Actions:**
- [ ] Update status page to "All systems operational"
- [ ] Close incident communication
- [ ] Begin collecting timeline data
- [ ] Schedule postmortem meeting
- [ ] Document immediate lessons learned

#### Inject 9: Root Cause Investigation
**Facilitator says:** "In the postmortem, you discover a new ORM query wasn't closing connections properly. What preventive actions would you implement?"

**Expected Preventive Actions:**
- Code review checklist update
- Database connection monitoring alerts
- Connection pool configuration review
- Automated testing for connection leaks

## Drill Evaluation

### Phase 5: Debrief and Lessons Learned (5 minutes)

#### Questions for Discussion:
1. **Detection:** How could we have detected this issue sooner?
2. **Response:** What worked well in our response process?
3. **Communication:** Was our communication effective and timely?
4. **Tools:** What tools or information were missing during the incident?
5. **Process:** What process improvements should we make?

#### Success Criteria Evaluation:
- [ ] Alert acknowledged within 5 minutes ✅/❌
- [ ] Status page updated within 10 minutes ✅/❌
- [ ] Incident channel created and used effectively ✅/❌
- [ ] Correct diagnosis reached within 20 minutes ✅/❌
- [ ] Resolution implemented within 45 minutes ✅/❌
- [ ] Post-incident process initiated correctly ✅/❌

## Action Items Template

| Priority | Action Item | Owner | Due Date | Notes |
|----------|-------------|-------|----------|-------|
| P1 | [Improvement identified during drill] | [Name] | [Date] | [Context] |
| P2 | [Process enhancement] | [Name] | [Date] | [Context] |
| P3 | [Tool/monitoring improvement] | [Name] | [Date] | [Context] |

## Drill Metrics

### Response Time Metrics
- **Time to Acknowledge:** _____ minutes (Target: <5 minutes)
- **Time to Status Update:** _____ minutes (Target: <10 minutes)
- **Time to Diagnosis:** _____ minutes (Target: <20 minutes)
- **Time to Resolution:** _____ minutes (Target: <45 minutes)

### Communication Metrics
- **Status Page Updates:** _____ (Target: Every 15 minutes)
- **Stakeholder Notifications:** _____ (Target: Within 10 minutes)
- **Internal Communication:** Effective/Needs Improvement

### Technical Metrics
- **Tools Used Effectively:** _____/_____ (List tools)
- **Information Gaps Identified:** _____ (List gaps)
- **False Starts/Wrong Paths:** _____ (Count and describe)

## Follow-up Activities

### Immediate (Within 24 hours):
- [ ] Distribute drill summary to all participants
- [ ] Create action items in project management system
- [ ] Update incident response procedures based on learnings

### Short-term (Within 1 week):
- [ ] Implement high-priority improvements
- [ ] Schedule follow-up drill to test improvements
- [ ] Share learnings with broader engineering team

### Long-term (Within 1 month):
- [ ] Complete all action items
- [ ] Update monitoring and alerting based on drill insights
- [ ] Plan next tabletop drill scenario

## Facilitator Notes

### Pre-Drill Preparation:
- [ ] Review current incident response procedures
- [ ] Prepare realistic technical details and logs
- [ ] Set up timer for each phase
- [ ] Prepare evaluation criteria

### During Drill:
- [ ] Keep time boundaries strict
- [ ] Encourage realistic decision-making
- [ ] Note both good practices and improvement areas
- [ ] Don't provide solutions too quickly

### Post-Drill:
- [ ] Facilitate honest discussion about challenges
- [ ] Focus on process improvements, not individual performance
- [ ] Ensure action items are specific and assignable
- [ ] Schedule regular follow-up on improvements

## Additional Drill Scenarios

### Future Drill Ideas:
1. **API Gateway Failure:** Complete loss of external connectivity
2. **Storage System Failure:** Database corruption and backup restoration
3. **Security Incident:** Detected breach requiring immediate response
4. **Multi-Region Outage:** Cloud provider region failure
5. **Payment Processing Failure:** Third-party payment system outage
6. **Load Balancer Failure:** Traffic routing and failover challenges

### Drill Frequency:
- **Tabletop Drills:** Monthly
- **Technical Drills:** Quarterly  
- **Full-Scale Exercises:** Bi-annually

## Resources

### Drill Materials:
- Realistic log files and error messages
- Monitoring dashboard screenshots
- Timeline templates
- Communication templates

### Reference Materials:
- Current incident response runbook
- Escalation contact list
- Tool access and login information
- Recent real incident postmortems
