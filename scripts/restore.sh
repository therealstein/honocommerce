#!/bin/bash
# ===========================================
# Honocommerce Database Restore Script
# ===========================================

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-honocommerce}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for backup file argument
if [ -z "$1" ]; then
    log_error "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lht "${BACKUP_DIR}"/honocommerce_*.sql.gz 2>/dev/null || echo "  No backups found"
    echo ""
    echo "Or use 'latest' to restore the most recent backup:"
    echo "  $0 latest"
    exit 1
fi

# Determine backup file
if [ "$1" = "latest" ]; then
    BACKUP_FILE="${BACKUP_DIR}/latest.sql.gz"
    if [ ! -L "${BACKUP_FILE}" ]; then
        log_error "No latest backup symlink found"
        exit 1
    fi
    BACKUP_FILE=$(readlink -f "${BACKUP_FILE}")
else
    BACKUP_FILE="$1"
fi

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    log_error "Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

log_warn "⚠️  WARNING: This will REPLACE all data in the database!"
log_warn "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log_warn "Backup: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    log_info "Restore cancelled"
    exit 0
fi

log_info "Starting database restore..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    log_error "psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Test database connection
if ! PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" > /dev/null 2>&1; then
    log_error "Cannot connect to database"
    exit 1
fi

# Perform the restore
if gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    --quiet; then
    
    log_info "Restore completed successfully!"
else
    log_error "Restore failed!"
    exit 1
fi

exit 0
