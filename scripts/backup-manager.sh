#!/bin/bash

# Modulo Database Backup Management Script
# Provides easy commands for backup and restore operations
# Author: Modulo DevOps Team

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not available"
        exit 1
    fi

    if ! docker network ls | grep -q modulo-network; then
        warn "Modulo network not found. Creating it..."
        docker network create modulo-network 2>/dev/null || true
    fi
}

# Start backup services
start_backup_services() {
    log "Starting backup services..."
    cd "${PROJECT_ROOT}"
    
    # Start main services first
    docker compose up -d db
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    docker compose exec db pg_isready -U postgres || {
        error "Database failed to start"
        exit 1
    }
    
    # Start backup services
    docker compose --profile backup up -d
    
    log "Backup services started successfully"
}

# Stop backup services
stop_backup_services() {
    log "Stopping backup services..."
    cd "${PROJECT_ROOT}"
    docker compose --profile backup down
    log "Backup services stopped"
}

# Create immediate backup
create_backup() {
    log "Creating immediate database backup..."
    cd "${PROJECT_ROOT}"
    
    if ! docker compose ps db | grep -q "running"; then
        log "Starting database service..."
        docker compose up -d db
        sleep 10
    fi
    
    # Run backup
    backup_file=$(docker compose run --rm db-backup /scripts/backup-script.sh backup)
    
    if [[ $? -eq 0 ]]; then
        log "Backup created successfully: ${backup_file}"
    else
        error "Backup creation failed"
        exit 1
    fi
}

# List available backups
list_backups() {
    log "Available database backups:"
    cd "${PROJECT_ROOT}"
    
    if [[ -d "./database/backups/data/full" ]]; then
        find ./database/backups/data/full -name "*.sql.gz" -type f -exec ls -lh {} \; | sort -k6,7
    else
        warn "No backup directory found. Run 'create-backup' first."
    fi
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    local target_db="${2:-modulodb_staging}"
    
    log "Restoring database from backup..."
    cd "${PROJECT_ROOT}"
    
    if ! docker compose ps db | grep -q "running"; then
        log "Starting database service..."
        docker compose up -d db
        sleep 10
    fi
    
    if [[ -z "${backup_file}" ]]; then
        log "Using latest backup..."
        docker compose run --rm restore-drill /scripts/restore-script.sh restore "" "${target_db}"
    else
        log "Using specified backup: ${backup_file}"
        docker compose run --rm restore-drill /scripts/restore-script.sh restore "${backup_file}" "${target_db}"
    fi
    
    log "Database restore completed to: ${target_db}"
}

# Run monthly restore drill
run_monthly_drill() {
    log "Starting monthly restore drill..."
    cd "${PROJECT_ROOT}"
    
    if ! docker compose ps db | grep -q "running"; then
        log "Starting database service..."
        docker compose up -d db
        sleep 10
    fi
    
    docker compose run --rm restore-drill /scripts/restore-script.sh drill
    
    # Show latest drill report
    local report_file=$(find ./database/backups/data/restore-tests -name "monthly_drill_*.json" | sort | tail -1)
    if [[ -f "${report_file}" ]]; then
        log "Drill completed. Report saved to: ${report_file}"
        info "Drill summary:"
        if command -v jq >/dev/null 2>&1; then
            jq -r '"RPO Compliant: " + (.rpo_compliant | tostring) + "\nRTO Compliant: " + (.rto_compliant | tostring) + "\nRestore Duration: " + (.restore_duration_minutes | tostring) + " minutes"' "${report_file}"
        else
            cat "${report_file}"
        fi
    fi
}

# View backup logs
view_logs() {
    local service="${1:-backup}"
    
    log "Viewing logs for: ${service}"
    cd "${PROJECT_ROOT}"
    
    case "${service}" in
        "backup")
            if [[ -f "./database/backups/data/backup.log" ]]; then
                tail -f ./database/backups/data/backup.log
            else
                docker compose logs -f db-backup
            fi
            ;;
        "restore")
            if [[ -f "./database/backups/data/restore.log" ]]; then
                tail -f ./database/backups/data/restore.log
            else
                docker compose logs -f restore-drill
            fi
            ;;
        "cron")
            if [[ -f "./database/backups/data/cron.log" ]]; then
                tail -f ./database/backups/data/cron.log
            else
                info "Cron logs not available"
            fi
            ;;
        *)
            error "Unknown log type: ${service}"
            exit 1
            ;;
    esac
}

# Cleanup old backups
cleanup_backups() {
    local days="${1:-7}"
    
    log "Cleaning up backups older than ${days} days..."
    cd "${PROJECT_ROOT}"
    
    docker compose run --rm db-backup /scripts/backup-script.sh cleanup
    
    log "Cleanup completed"
}

# Show backup status and health
show_status() {
    log "Database Backup System Status"
    echo "================================"
    
    cd "${PROJECT_ROOT}"
    
    # Check if services are running
    info "Service Status:"
    if docker compose ps db | grep -q "running"; then
        echo "✅ Database: Running"
    else
        echo "❌ Database: Not running"
    fi
    
    if docker compose --profile backup ps db-backup | grep -q "running"; then
        echo "✅ Backup Service: Running"
    else
        echo "❌ Backup Service: Not running"
    fi
    
    # Check backup directory
    info "Backup Storage:"
    if [[ -d "./database/backups/data/full" ]]; then
        local backup_count=$(find ./database/backups/data/full -name "*.sql.gz" | wc -l)
        local latest_backup=$(find ./database/backups/data/full -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2- || echo "None")
        echo "📦 Backup count: ${backup_count}"
        echo "🕐 Latest backup: $(basename "${latest_backup}" 2>/dev/null || echo "None")"
    else
        echo "❌ Backup directory not found"
    fi
    
    # Check drill reports
    info "Restore Drills:"
    if [[ -d "./database/backups/data/restore-tests" ]]; then
        local drill_count=$(find ./database/backups/data/restore-tests -name "monthly_drill_*.json" | wc -l)
        local latest_drill=$(find ./database/backups/data/restore-tests -name "monthly_drill_*.json" | sort | tail -1)
        echo "🔄 Drill count: ${drill_count}"
        if [[ -f "${latest_drill}" ]]; then
            echo "🕐 Latest drill: $(basename "${latest_drill}")"
            if command -v jq >/dev/null 2>&1; then
                local rpo_compliant=$(jq -r '.rpo_compliant' "${latest_drill}")
                local rto_compliant=$(jq -r '.rto_compliant' "${latest_drill}")
                echo "📊 RPO Compliant: ${rpo_compliant}"
                echo "📊 RTO Compliant: ${rto_compliant}"
            fi
        fi
    else
        echo "❌ No drill reports found"
    fi
}

# Display help
show_help() {
    cat << EOF
Modulo Database Backup Management Script

Usage: $0 <command> [options]

Commands:
  start-services          Start backup services
  stop-services           Stop backup services  
  create-backup           Create immediate backup
  list-backups           List available backups
  restore [backup] [db]   Restore from backup (latest if not specified)
  monthly-drill          Run monthly restore drill
  cleanup [days]         Cleanup old backups (default: 7 days)
  status                 Show backup system status
  logs [type]            View logs (backup|restore|cron)
  help                   Show this help message

Examples:
  $0 start-services
  $0 create-backup
  $0 restore
  $0 restore /backups/full/backup_20231201.sql.gz modulodb_test
  $0 monthly-drill
  $0 cleanup 14
  $0 logs backup

For more information, see: ./database/backups/BACKUP_RUNBOOK.md
EOF
}

# Main function
main() {
    local command="${1:-help}"
    
    case "${command}" in
        "start-services")
            check_prerequisites
            start_backup_services
            ;;
        "stop-services")
            stop_backup_services
            ;;
        "create-backup")
            check_prerequisites
            create_backup
            ;;
        "list-backups"|"list")
            list_backups
            ;;
        "restore")
            check_prerequisites
            restore_backup "${2:-}" "${3:-}"
            ;;
        "monthly-drill"|"drill")
            check_prerequisites
            run_monthly_drill
            ;;
        "cleanup")
            cleanup_backups "${2:-7}"
            ;;
        "status")
            show_status
            ;;
        "logs")
            view_logs "${2:-backup}"
            ;;
        "help"|"--help"|"-h")
            show_help
            ;;
        *)
            error "Unknown command: ${command}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"
