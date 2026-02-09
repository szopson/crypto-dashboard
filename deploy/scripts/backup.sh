#!/bin/bash
# Database backup script

set -e

BACKUP_DIR="${BACKUP_DIR:-/opt/trading-command-center/backups}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-30}

echo "Starting backup..."

# Create backup directory if not exists
mkdir -p ${BACKUP_DIR}

# Backup SQLite database
docker cp tcc-backend:/app/data/trading.db ${BACKUP_DIR}/trading_${DATE}.db
echo "Database backed up to: ${BACKUP_DIR}/trading_${DATE}.db"

# Compress backup
gzip ${BACKUP_DIR}/trading_${DATE}.db
echo "Backup compressed: ${BACKUP_DIR}/trading_${DATE}.db.gz"

# Clean old backups
find ${BACKUP_DIR} -type f -name "*.db.gz" -mtime +${RETENTION_DAYS} -delete
echo "Cleaned backups older than ${RETENTION_DAYS} days"

# Calculate backup size
SIZE=$(du -sh ${BACKUP_DIR} | cut -f1)
echo "Total backup size: ${SIZE}"

echo "Backup completed successfully!"
