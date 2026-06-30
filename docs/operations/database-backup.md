# Database Backup and Restore Implementation

## Overview

This implementation provides comprehensive automated database backup and restore capabilities for the Modulo application, including:

- ✅ **Nightly automated backups** with pg_dump
- ✅ **Point-in-Time Recovery (PITR)** simulation 
- ✅ **Monthly restore drills** with automated testing
- ✅ **RPO/RTO compliance monitoring** (1 hour RPO, 30 minute RTO)
- ✅ **Cloud storage integration** (S3 optional)
- ✅ **Automated testing** via GitHub Actions
- ✅ **Comprehensive runbook** with procedures

## Quick Start

### 1. Start Backup Services

```bash
# Using the backup manager script (recommended)
./scripts/backup-manager.sh start-services

# Or using Docker Compose directly
docker compose --profile backup up -d
```

### 2. Create Immediate Backup

```bash
# Create backup now
./scripts/backup-manager.sh create-backup

# View available backups
./scripts/backup-manager.sh list-backups
```

### 3. Run Monthly Restore Drill

```bash
# Execute restore drill with compliance reporting
./scripts/backup-manager.sh monthly-drill
```

### 4. Monitor Status

```bash
# Check backup system health
./scripts/backup-manager.sh status

# View backup logs
./scripts/backup-manager.sh logs backup
```

## Implementation Details

### Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │  Backup Service │    │  Cloud Storage  │
│   Database      │───▶│   (Nightly)     │───▶│   (Optional)    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────▶│ Restore Service │◀─────────────┘
                        │  (Monthly Drill)│
                        └─────────────────┘
```

### Components

1. **Backup Script** (`database/backups/backup-script.sh`)
   - Creates compressed full database dumps
   - Supports WAL archiving simulation
   - Includes integrity verification
   - Handles cloud upload (S3)
   - Manages retention policy

2. **Restore Script** (`database/backups/restore-script.sh`)
   - Performs database restoration
   - Executes monthly compliance drills
   - Validates RPO/RTO targets
   - Generates detailed reports

3. **Docker Services** (`docker-compose.backup.yml`)
   - `db-backup`: Automated backup service with cron
   - `restore-drill`: On-demand restore testing

4. **GitHub Actions** (`.github/workflows/db-backup-testing.yml`)
   - Daily backup testing
   - Monthly restore verification
   - Compliance reporting

5. **Management Script** (`scripts/backup-manager.sh`)
   - Unified interface for backup operations
   - Status monitoring and health checks
   - Simplified command execution

### File Structure

```
database/backups/
├── backup-script.sh           # Main backup script
├── restore-script.sh          # Restore and drill script
├── crontab                    # Automated scheduling
├── BACKUP_RUNBOOK.md          # Detailed procedures
└── data/                      # Backup storage
    ├── full/                  # Full database backups
    │   ├── *.sql.gz          # Compressed backup files
    │   └── *.sql.gz.meta     # Backup metadata
    ├── wal/                   # WAL archives (PITR)
    ├── logs/                  # Backup reports
    │   └── backup_report_*.json
    └── restore-tests/         # Drill reports
        └── monthly_drill_*.json
```

## Backup Schedule

### Automated Schedule (Cron)

- **Daily Backups**: 2:00 AM UTC
- **Weekly Cleanup**: Sundays at 3:00 AM UTC
- **Monthly Drills**: First Sunday of month at 4:00 AM UTC
- **Health Checks**: Every hour

### Manual Operations

```bash
# Create immediate backup
./scripts/backup-manager.sh create-backup

# Restore latest backup to staging
./scripts/backup-manager.sh restore

# Restore specific backup
./scripts/backup-manager.sh restore /backups/full/backup_20231201.sql.gz modulodb_test

# Run compliance drill
./scripts/backup-manager.sh monthly-drill

# Cleanup old backups (keep 7 days)
./scripts/backup-manager.sh cleanup
```

## RPO/RTO Targets

### Current Targets
- **Recovery Point Objective (RPO)**: 1 hour
- **Recovery Time Objective (RTO)**: 30 minutes

### Monitoring
- Automated compliance checking during drills
- Alerts for target violations
- Performance metrics tracking

### Compliance Reports

Example monthly drill report:
```json
{
  "drill_timestamp": "2023-12-03T04:00:00Z",
  "backup_age_minutes": 45,
  "restore_duration_minutes": 18,
  "rpo_compliant": true,
  "rto_compliant": true,
  "status": "success"
}
```

## Cloud Storage Integration

### S3 Configuration (Optional)

```bash
# Set environment variables
export BACKUP_S3_BUCKET=modulo-backups
export AWS_REGION=us-east-1

# Backups will upload to:
# s3://modulo-backups/database-backups/
```

### Benefits
- Offsite backup storage
- Disaster recovery capability
- Long-term retention
- Encryption in transit

## Testing and Validation

### GitHub Actions Workflows

1. **Daily Backup Tests**
   - Verifies backup creation
   - Checks file integrity
   - Validates metadata

2. **Monthly Restore Drills**
   - Full restore testing
   - RPO/RTO compliance
   - Data integrity verification

3. **Compliance Reporting**
   - Automated evidence collection
   - Performance metrics
   - Trend analysis

### Manual Testing

```bash
# Test backup creation
./scripts/backup-manager.sh create-backup

# Test restore functionality
./scripts/backup-manager.sh restore "" modulodb_test

# Verify data integrity
docker compose exec db psql -U postgres -d modulodb_test -c "\dt application.*"
```

## Troubleshooting

### Common Issues

1. **Backup Service Won't Start**
   ```bash
   # Check database connectivity
   docker compose exec db pg_isready -U postgres
   
   # View service logs
   docker compose logs db-backup
   ```

2. **Restore Takes Too Long (RTO Issue)**
   ```bash
   # Check backup file size
   ls -lh ./database/backups/data/full/
   
   # Monitor restore progress
   ./scripts/backup-manager.sh logs restore
   ```

3. **Missing Backups (RPO Issue)**
   ```bash
   # Check cron service
   docker compose exec db-backup crond -f -d 8
   
   # Verify disk space
   df -h ./database/backups/data/
   ```

### Performance Optimization

- Use SSD storage for backup directory
- Increase PostgreSQL memory settings
- Consider parallel restore with pg_restore
- Implement incremental backups for large databases

## Security Considerations

- Backup files are compressed (reduces storage)
- Cloud uploads use encryption in transit
- Access logs maintained for auditing
- Database credentials isolated in containers

## Maintenance

### Regular Tasks

1. **Weekly**: Review backup logs and reports
2. **Monthly**: Analyze drill results and compliance
3. **Quarterly**: Review retention policies
4. **Annually**: Update disaster recovery procedures

### Monitoring

```bash
# Check system status
./scripts/backup-manager.sh status

# View recent activity
./scripts/backup-manager.sh logs backup | tail -50

# Check drill compliance
find ./database/backups/data/restore-tests -name "*.json" | xargs grep -l '"rpo_compliant": false'
```

## Documentation

- **Runbook**: `database/backups/BACKUP_RUNBOOK.md`
- **Scripts**: Inline documentation in shell scripts
- **Workflows**: GitHub Actions with detailed steps
- **Reports**: JSON format for automation integration

## Future Enhancements

1. **Full PITR Implementation**
   - PostgreSQL WAL-E or pgBackRest
   - Continuous WAL archiving
   - Point-in-time recovery to any timestamp

2. **Advanced Monitoring**
   - Prometheus metrics integration
   - Grafana dashboards
   - PagerDuty alerting

3. **Multi-Environment Support**
   - Environment-specific backup schedules
   - Cross-region replication
   - Blue-green deployment support

4. **Backup Encryption**
   - At-rest encryption for local backups
   - GPG encryption for sensitive data
   - Key management integration

## Support

- **Documentation**: See `BACKUP_RUNBOOK.md` for detailed procedures
- **Issues**: Report via GitHub Issues with `database` label
- **Emergency**: Follow runbook emergency procedures
