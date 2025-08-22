# Blameless Postmortem Template

## Incident Summary

**Incident ID:** [AUTO-GENERATED-ID]  
**Date:** [YYYY-MM-DD]  
**Time:** [HH:MM UTC - HH:MM UTC]  
**Duration:** [X hours Y minutes]  
**Severity:** [Critical/High/Medium/Low]  
**Status:** [Investigating/Identified/Monitoring/Resolved]

### Impact
- **Services Affected:** [List of affected services]
- **Users Affected:** [Number/percentage of users]
- **Revenue Impact:** [If applicable]
- **SLA Breach:** [Yes/No - details if yes]

### Summary
[Brief, high-level description of what happened]

---

## Timeline

### Detection
- **First Alert:** [Time] - [Alert description]
- **Escalation:** [Time] - [Who was notified]
- **Acknowledgment:** [Time] - [Who acknowledged]

### Investigation & Response
| Time (UTC) | Action | Person | Notes |
|------------|--------|---------|-------|
| [HH:MM] | [Action taken] | [Name] | [Additional context] |
| [HH:MM] | [Action taken] | [Name] | [Additional context] |
| [HH:MM] | [Action taken] | [Name] | [Additional context] |

### Resolution
- **Fix Applied:** [Time] - [Description of fix]
- **Service Restored:** [Time] - [Confirmation of restoration]
- **All Clear:** [Time] - [Final confirmation]

---

## Root Cause Analysis

### Contributing Factors
1. **Immediate Cause:** [What directly caused the incident]
2. **Root Cause:** [Underlying issue that allowed the immediate cause]
3. **Contributing Factors:** [Other factors that made the incident worse or delayed resolution]

### 5 Whys Analysis
1. **Why did [incident] happen?** 
   - [Answer]
2. **Why did [answer 1] happen?**
   - [Answer]
3. **Why did [answer 2] happen?**
   - [Answer]
4. **Why did [answer 3] happen?**
   - [Answer]
5. **Why did [answer 4] happen?**
   - [Answer - This should be the root cause]

---

## What Went Well

### Detection
- [What worked well in detecting the issue]
- [Effective monitoring/alerting]

### Response
- [Effective response actions]
- [Good communication]
- [Quick escalation]

### Recovery
- [Effective recovery actions]
- [Good coordination]

---

## What Went Wrong

### Detection
- [Delayed detection issues]
- [Missing alerts/monitoring]

### Response
- [Ineffective response actions]
- [Communication problems]
- [Delayed escalation]

### Recovery
- [Slow recovery actions]
- [Coordination issues]

---

## Action Items

| Priority | Action Item | Owner | Due Date | Status |
|----------|-------------|-------|----------|--------|
| P0 | [Critical action to prevent recurrence] | [Name] | [Date] | [Open/In Progress/Done] |
| P1 | [Important improvement] | [Name] | [Date] | [Open/In Progress/Done] |
| P2 | [Nice to have improvement] | [Name] | [Date] | [Open/In Progress/Done] |

### Categories of Actions
- **Prevent:** Actions to prevent this specific incident from happening again
- **Detect:** Improvements to detection and monitoring
- **Respond:** Improvements to incident response process
- **Recover:** Improvements to recovery procedures

---

## Lessons Learned

### Technical Lessons
- [Technical insights gained]
- [Architecture improvements needed]
- [Code/configuration changes needed]

### Process Lessons
- [Process improvements needed]
- [Communication improvements]
- [Escalation improvements]

### Cultural Lessons
- [Cultural changes needed]
- [Training needs identified]
- [Documentation improvements]

---

## Supporting Information

### Metrics
- **MTTR (Mean Time to Repair):** [Duration]
- **MTTA (Mean Time to Acknowledge):** [Duration]
- **MTTD (Mean Time to Detect):** [Duration]

### External Communication
- [Status page updates sent]
- [Customer notifications]
- [Social media posts]

### Related Incidents
- [Links to related incidents]
- [Pattern analysis]

---

## Appendices

### Appendix A: Logs and Screenshots
[Attach relevant logs, screenshots, graphs]

### Appendix B: Communication Log
[Copy of important communications during incident]

### Appendix C: Technical Details
[Detailed technical information for reference]

---

## Sign-off

**Prepared by:** [Name] - [Date]  
**Reviewed by:** [Name] - [Date]  
**Approved by:** [Name] - [Date]

**Participants in Review:**
- [Name] - [Role]
- [Name] - [Role]
- [Name] - [Role]

---

## Template Usage Notes

### Filling Out This Template
1. **Be Honest:** Focus on facts, not blame
2. **Be Specific:** Use exact times, specific actions
3. **Be Actionable:** Every identified issue should have an action item
4. **Be Timely:** Complete within 48 hours of incident resolution

### Blameless Culture Guidelines
- Focus on systems and processes, not individuals
- Assume good intent from all participants
- Encourage learning and improvement
- Share lessons learned across teams
- Celebrate honest failure reports

### Review Process
1. **Initial Draft:** Incident commander creates draft within 24 hours
2. **Team Review:** All participants review and provide input
3. **Stakeholder Review:** Management and affected teams review
4. **Final Publication:** Share with broader team and archive

### Action Item Tracking
- All action items must have owners and due dates
- Track progress in weekly incident review meetings
- Report on completion status in monthly reliability reports
- Update incident database with lessons learned
