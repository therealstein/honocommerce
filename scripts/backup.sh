#!/bin/bash
# ===========================================
# Honocommerce Database Backup Script
# ===========================================

set -e

# Configuration (override via environment variables)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-honocommerce}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for backup filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/honocommerce_${TIMESTAMP}.sql.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

log_info "Starting database backup..."
log_info "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
log_info "Backup file: ${BACKUP_FILE}"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found. Please install PostgreSQL client tools."
    exit 1
fi

# Perform the backup
if PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=plain \
    --no-owner \
    --no-acl \
    | gzip > "${BACKUP_FILE}"; then
    
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log_info "Backup completed successfully! Size: ${BACKUP_SIZE}"
else
    log_error "Backup failed!"
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Create latest symlink
ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"
log_info "Updated latest symlink"

# Clean up old backups
log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "honocommerce_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete -print | wc -l)

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log_info "Deleted ${DELETED_COUNT} old backup(s)"
else
    log_info "No old backups to delete"
fi

# List remaining backups
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/honocommerce_*.sql.gz 2>/dev/null | wc -l)
log_info "Total backups: ${BACKUP_COUNT}"

# Calculate total backup size
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log_info "Total backup directory size: ${TOTAL_SIZE}"

exit 0
