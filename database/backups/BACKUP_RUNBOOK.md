# Database Backup and Restore Runbook

## Overview

This runbook provides comprehensive guidance for database backup and restore operations for the Modulo application. It includes automated daily backups, monthly restore drills, and emergency recovery procedures.

## RPO/RTO Targets

- **Recovery Point Objective (RPO)**: 1 hour
- **Recovery Time Objective (RTO)**: 30 minutes

## Backup Strategy

### 1. Automated Nightly Backups

Daily full database backups are performed at 2:00 AM UTC using `pg_dump`.

**Features:**
- Compressed SQL dumps for storage efficiency
- Metadata tracking for backup verification
- Optional cloud storage (S3) integration
- Automatic cleanup of old backups (7-day retention)

**Backup Location:** `./database/backups/data/full/`

### 2. Point-in-Time Recovery (PITR)

PITR capability through WAL (Write-Ahead Log) archiving simulation.

**Note:** Full PITR requires PostgreSQL configuration changes in production:
```sql
-- PostgreSQL configuration for PITR
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'
wal_level = replica
```

### 3. Monthly Restore Drills

Automated monthly tests on the first Sunday of each month at 4:00 AM UTC.

## Backup Services

### Starting Backup Services

```bash
# Start backup services
docker compose --profile backup up -d

# Start backup and drill services
docker compose --profile backup --profile drill up -d
```

### Manual Backup Operations

```bash
# Create immediate backup
docker compose run --rm db-backup /scripts/backup-script.sh backup

# Test backup script
docker compose run --rm db-backup /scripts/backup-script.sh test-restore

# Cleanup old backups
docker compose run --rm db-backup /scripts/backup-script.sh cleanup
```

## Restore Operations

### 1. Manual Restore from Latest Backup

```bash
# Restore latest backup to staging database
docker compose run --rm restore-drill /scripts/restore-script.sh restore

# Restore specific backup file
docker compose run --rm restore-drill /scripts/restore-script.sh restore /backups/full/backup_20231201.sql.gz modulodb_test
```

### 2. Monthly Restore Drill

```bash
# Run monthly restore drill
docker compose run --rm restore-drill /scripts/restore-script.sh drill
```

### 3. Point-in-Time Recovery

```bash
# PITR to specific timestamp
docker compose run --rm restore-drill /scripts/restore-script.sh pitr "2023-12-01 14:30:00" modulodb_recovery
```

### 4. Emergency Recovery

#### Step 1: Assess the Situation
```bash
# Check database status
docker compose exec db pg_isready -U postgres

# Check available backups
docker compose run --rm restore-drill /scripts/restore-script.sh list
```

#### Step 2: Stop Application Services
```bash
# Stop application to prevent data corruption
docker compose stop backend frontend
```

#### Step 3: Restore Database
```bash
# Option A: Restore from latest backup
docker compose run --rm restore-drill /scripts/restore-script.sh restore

# Option B: Restore from specific backup
docker compose run --rm restore-drill /scripts/restore-script.sh restore /backups/full/specific_backup.sql.gz modulodb

# Option C: Point-in-time recovery
docker compose run --rm restore-drill /scripts/restore-script.sh pitr "2023-12-01 14:30:00" modulodb
```

#### Step 4: Verify Restore
```bash
# Verify database integrity
docker compose run --rm restore-drill /scripts/restore-script.sh verify modulodb
```

#### Step 5: Restart Services
```bash
# Restart application services
docker compose up -d backend frontend
```

## Monitoring and Verification

### Backup Health Checks

```bash
# Check backup service logs
docker compose logs db-backup

# Check restore drill logs
docker compose logs restore-drill

# View backup reports
find ./database/backups/data/logs -name "backup_report_*.json" -exec cat {} \;
```

### Monthly Drill Reports

Monthly restore drill reports are generated in JSON format:

```bash
# View latest drill report
find ./database/backups/data/restore-tests -name "monthly_drill_*.json" | sort | tail -1 | xargs cat
```

## Backup File Management

### Local Storage Structure

```
database/backups/data/
├── full/                    # Full database backups
│   ├── modulo_full_YYYYMMDD_HHMMSS.sql.gz
│   └── modulo_full_YYYYMMDD_HHMMSS.sql.gz.meta
├── wal/                     # WAL archives for PITR
│   └── YYYYMMDD/
├── logs/                    # Backup and restore logs
│   ├── backup_report_*.json
│   └── monthly_drill_*.json
└── restore-tests/           # Restore drill artifacts
```

### Cloud Storage (Optional)

Configure S3 backup storage:

```bash
# Set environment variables
export BACKUP_S3_BUCKET=modulo-backups
export AWS_REGION=us-east-1

# Backups will be automatically uploaded to:
# s3://modulo-backups/database-backups/
```

## Troubleshooting

### Common Issues

1. **Backup Service Won't Start**
   ```bash
   # Check PostgreSQL connectivity
   docker compose exec db pg_isready -U postgres
   
   # Check backup service logs
   docker compose logs db-backup
   ```

2. **Restore Fails**
   ```bash
   # Verify backup file integrity
   gzip -t /path/to/backup.sql.gz
   
   # Check database permissions
   docker compose exec db psql -U postgres -c "\du"
   ```

3. **Large Restore Times (RTO Issues)**
   - Consider parallel restore with `pg_restore`
   - Increase PostgreSQL memory settings
   - Use SSDs for backup storage

4. **Old Backup Age (RPO Issues)**
   - Increase backup frequency
   - Check cron service status
   - Verify disk space availability

### Emergency Contacts

- **Database Team**: db-team@modulo.com
- **DevOps Team**: devops@modulo.com
- **On-Call**: +1-XXX-XXX-XXXX

## Configuration Files

### Backup Script Configuration
- Script: `./database/backups/backup-script.sh`
- Config: Environment variables in `docker-compose.backup.yml`

### Restore Script Configuration
- Script: `./database/backups/restore-script.sh`
- Cron: `./database/backups/crontab`

### Docker Compose Configuration
- Main: `docker-compose.yml`
- Backup: `docker-compose.backup.yml`

## Compliance and Auditing

### Backup Verification
- All backups include integrity checks
- Metadata files track backup details
- Monthly drill reports provide compliance evidence

### Retention Policy
- Daily backups: 7 days retention
- WAL archives: 14 days retention
- Drill reports: 90 days retention

### Security
- Backups are compressed to reduce storage
- Cloud uploads use encryption in transit
- Access logs are maintained for auditing

## Testing and Validation

### Weekly Backup Tests
```bash
# Test backup creation and verification
docker compose run --rm db-backup /scripts/backup-script.sh backup

# Test backup integrity
ls -la ./database/backups/data/full/
```

### Monthly Restore Drills
Automated on first Sunday of each month. Manual execution:
```bash
docker compose run --rm restore-drill /scripts/restore-script.sh drill
```

### Disaster Recovery Simulation
Quarterly full disaster recovery tests should be performed:
1. Simulate database failure
2. Restore from backup
3. Verify application functionality
4. Document lessons learned

## Performance Metrics

### Current Performance Baselines
- Backup creation time: ~5-10 minutes (depending on database size)
- Restore time: ~15-20 minutes
- Backup file size: ~50-100MB compressed

### Monitoring Thresholds
- Backup creation time > 30 minutes: Investigation required
- Restore time > RTO target (30 min): Process optimization needed
- Backup file size growth > 50%: Capacity planning review
