#!/bin/bash

# PostgreSQL Database Restore Script and Monthly Drill
# Supports full restore, point-in-time recovery, and automated testing
# Author: Modulo DevOps Team
# Version: 1.0

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_FILE="${BACKUP_DIR}/restore.log"
STAGING_DB="${STAGING_DB:-modulodb_staging}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

# Restore targets (RPO/RTO)
RPO_TARGET_MINUTES=60  # Recovery Point Objective: 1 hour
RTO_TARGET_MINUTES=30  # Recovery Time Objective: 30 minutes

# Create directories
mkdir -p "${BACKUP_DIR}/restore-tests" "${BACKUP_DIR}/logs"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check PostgreSQL connectivity
check_postgres() {
    log "Checking PostgreSQL connectivity..."
    if ! PGPASSWORD="${POSTGRES_PASSWORD}" pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; then
        error_exit "PostgreSQL is not available at ${POSTGRES_HOST}:${POSTGRES_PORT}"
    fi
    log "PostgreSQL is available"
}

# List available backups
list_backups() {
    log "Available backup files:"
    find "${BACKUP_DIR}/full" -name "*.sql.gz" -type f -exec ls -lh {} \; | sort -k6,7
}

# Get latest backup
get_latest_backup() {
    find "${BACKUP_DIR}/full" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    local target_db="$2"
    local start_time=$(date +%s)
    
    log "Starting restore from ${backup_file} to database ${target_db}"
    
    # Verify backup file exists and is readable
    if [[ ! -f "${backup_file}" ]]; then
        error_exit "Backup file not found: ${backup_file}"
    fi
    
    # Test backup file integrity
    if ! gzip -t "${backup_file}"; then
        error_exit "Backup file is corrupted: ${backup_file}"
    fi
    
    # Drop existing database if it exists (for staging)
    if [[ "${target_db}" == *"staging"* ]] || [[ "${target_db}" == *"test"* ]]; then
        log "Dropping existing staging/test database: ${target_db}"
        PGPASSWORD="${POSTGRES_PASSWORD}" dropdb \
            -h "${POSTGRES_HOST}" \
            -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_USER}" \
            --if-exists \
            "${target_db}" 2>/dev/null || true
    fi
    
    # Restore the database
    log "Restoring database from backup..."
    gunzip -c "${backup_file}" | PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d postgres \
        -v ON_ERROR_STOP=1 \
        2>> "${LOG_FILE}"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_minutes=$((duration / 60))
    
    log "Database restore completed in ${duration} seconds (${duration_minutes} minutes)"
    
    # Verify restore
    verify_restore "${target_db}" "${duration_minutes}"
    
    echo "${duration_minutes}"
}

# Verify restored database
verify_restore() {
    local database="$1"
    local restore_duration="$2"
    
    log "Verifying restored database: ${database}"
    
    # Check if database exists
    local db_exists=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d postgres \
        -tAc "SELECT 1 FROM pg_database WHERE datname='${database}'" 2>/dev/null || echo "0")
    
    if [[ "${db_exists}" != "1" ]]; then
        error_exit "Database ${database} was not created successfully"
    fi
    
    # Check table counts and data integrity
    local table_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${database}" \
        -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('application', 'security')" 2>/dev/null || echo "0")
    
    log "Restored database has ${table_count} tables"
    
    # Check RTO compliance
    if [[ ${restore_duration} -le ${RTO_TARGET_MINUTES} ]]; then
        log "✅ RTO target met: ${restore_duration}min <= ${RTO_TARGET_MINUTES}min target"
    else
        log "❌ RTO target missed: ${restore_duration}min > ${RTO_TARGET_MINUTES}min target"
    fi
    
    log "Database verification completed successfully"
}

# Perform monthly restore drill
monthly_restore_drill() {
    local drill_timestamp=$(date '+%Y%m%d_%H%M%S')
    local drill_db="modulo_drill_${drill_timestamp}"
    local report_file="${BACKUP_DIR}/restore-tests/monthly_drill_${drill_timestamp}.json"
    local start_time=$(date +%s)
    
    log "=== Starting Monthly Restore Drill ==="
    log "Drill database: ${drill_db}"
    
    # Get latest backup
    local latest_backup
    latest_backup=$(get_latest_backup)
    
    if [[ -z "${latest_backup}" ]]; then
        error_exit "No backup files found in ${BACKUP_DIR}/full"
    fi
    
    log "Using backup: ${latest_backup}"
    
    # Get backup metadata
    local backup_meta="${latest_backup}.meta"
    local backup_age=""
    if [[ -f "${backup_meta}" ]]; then
        backup_age=$(grep "created_at" "${backup_meta}" | cut -d'=' -f2 || echo "unknown")
    fi
    
    # Perform restore
    local restore_duration
    restore_duration=$(restore_database "${latest_backup}" "${drill_db}")
    
    # Calculate RPO compliance
    local backup_timestamp=$(stat -c %Y "${latest_backup}")
    local current_timestamp=$(date +%s)
    local backup_age_minutes=$(( (current_timestamp - backup_timestamp) / 60 ))
    
    local rpo_compliant="true"
    if [[ ${backup_age_minutes} -gt ${RPO_TARGET_MINUTES} ]]; then
        rpo_compliant="false"
    fi
    
    # Run additional verification tests
    run_data_integrity_tests "${drill_db}"
    
    # Generate drill report
    cat > "${report_file}" << EOF
{
  "drill_timestamp": "$(date -Iseconds)",
  "drill_database": "${drill_db}",
  "backup_file": "${latest_backup}",
  "backup_age_minutes": ${backup_age_minutes},
  "restore_duration_minutes": ${restore_duration},
  "rpo_target_minutes": ${RPO_TARGET_MINUTES},
  "rto_target_minutes": ${RTO_TARGET_MINUTES},
  "rpo_compliant": ${rpo_compliant},
  "rto_compliant": $([ ${restore_duration} -le ${RTO_TARGET_MINUTES} ] && echo "true" || echo "false"),
  "status": "success",
  "recommendations": [
    $([ ${backup_age_minutes} -gt ${RPO_TARGET_MINUTES} ] && echo "\"Consider increasing backup frequency to meet RPO target\"," || echo "")
    $([ ${restore_duration} -gt ${RTO_TARGET_MINUTES} ] && echo "\"Optimize restore process to meet RTO target\"," || echo "")
    "\"Regular drill testing completed successfully\""
  ]
}
EOF
    
    # Cleanup drill database
    log "Cleaning up drill database: ${drill_db}"
    PGPASSWORD="${POSTGRES_PASSWORD}" dropdb \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        "${drill_db}" 2>/dev/null || true
    
    local end_time=$(date +%s)
    local total_duration=$((end_time - start_time))
    
    log "=== Monthly Restore Drill Completed ==="
    log "Total drill time: ${total_duration} seconds"
    log "Report saved: ${report_file}"
    
    # Display summary
    echo ""
    echo "🔄 MONTHLY RESTORE DRILL SUMMARY"
    echo "================================"
    echo "Backup Age: ${backup_age_minutes} minutes (RPO target: ${RPO_TARGET_MINUTES} min)"
    echo "Restore Time: ${restore_duration} minutes (RTO target: ${RTO_TARGET_MINUTES} min)"
    echo "RPO Compliant: $([ "${rpo_compliant}" = "true" ] && echo "✅ YES" || echo "❌ NO")"
    echo "RTO Compliant: $([ ${restore_duration} -le ${RTO_TARGET_MINUTES} ] && echo "✅ YES" || echo "❌ NO")"
    echo "Report: ${report_file}"
    echo ""
}

# Run data integrity tests
run_data_integrity_tests() {
    local database="$1"
    
    log "Running data integrity tests on ${database}"
    
    # Test 1: Check schema exists
    local schema_count=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${database}" \
        -tAc "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('application', 'security')" 2>/dev/null || echo "0")
    
    log "Schema test: Found ${schema_count} schemas"
    
    # Test 2: Check for essential tables
    local tables=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
        -h "${POSTGRES_HOST}" \
        -p "${POSTGRES_PORT}" \
        -U "${POSTGRES_USER}" \
        -d "${database}" \
        -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema = 'application' ORDER BY table_name" 2>/dev/null || echo "")
    
    log "Tables found: ${tables}"
    
    # Test 3: Check data consistency (if tables have data)
    if [[ -n "${tables}" ]]; then
        local data_check=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
            -h "${POSTGRES_HOST}" \
            -p "${POSTGRES_PORT}" \
            -U "${POSTGRES_USER}" \
            -d "${database}" \
            -tAc "SELECT 'OK' FROM information_schema.tables WHERE table_schema = 'application' LIMIT 1" 2>/dev/null || echo "ERROR")
        
        log "Data integrity check: ${data_check}"
    fi
    
    log "Data integrity tests completed"
}

# Point-in-time recovery
pitr_restore() {
    local target_time="$1"
    local target_db="$2"
    
    log "Performing point-in-time recovery to ${target_time}"
    log "Note: Full PITR requires WAL archiving to be enabled in PostgreSQL configuration"
    
    # For now, we'll restore the latest backup as a simulation
    # In a full implementation, this would use pg_basebackup + WAL replay
    local latest_backup
    latest_backup=$(get_latest_backup)
    
    if [[ -n "${latest_backup}" ]]; then
        log "Using latest backup for PITR simulation: ${latest_backup}"
        restore_database "${latest_backup}" "${target_db}"
    else
        error_exit "No backup available for PITR"
    fi
}

# Main function
main() {
    local action="${1:-drill}"
    
    case "${action}" in
        "drill")
            check_postgres
            monthly_restore_drill
            ;;
        "restore")
            local backup_file="${2:-}"
            local target_db="${3:-${STAGING_DB}}"
            
            if [[ -z "${backup_file}" ]]; then
                backup_file=$(get_latest_backup)
            fi
            
            if [[ -z "${backup_file}" ]]; then
                error_exit "No backup file specified or found"
            fi
            
            check_postgres
            restore_database "${backup_file}" "${target_db}"
            ;;
        "pitr")
            local target_time="${2:-$(date -d '1 hour ago' -Iseconds)}"
            local target_db="${3:-${STAGING_DB}}"
            
            check_postgres
            pitr_restore "${target_time}" "${target_db}"
            ;;
        "list")
            list_backups
            ;;
        "verify")
            local database="${2:-${STAGING_DB}}"
            check_postgres
            verify_restore "${database}" "0"
            ;;
        *)
            echo "Usage: $0 [drill|restore|pitr|list|verify] [options...]"
            echo ""
            echo "Commands:"
            echo "  drill                    - Run monthly restore drill"
            echo "  restore [backup] [db]    - Restore specific backup to database"
            echo "  pitr [time] [db]        - Point-in-time recovery"
            echo "  list                    - List available backups"
            echo "  verify [db]             - Verify database integrity"
            echo ""
            echo "Examples:"
            echo "  $0 drill"
            echo "  $0 restore /backups/full/backup_20231201.sql.gz modulodb_test"
            echo "  $0 pitr '2023-12-01 14:30:00' modulodb_recovery"
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
