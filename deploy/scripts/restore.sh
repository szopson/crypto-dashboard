#!/bin/bash
# Database restore script

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /opt/trading-command-center/backups/trading_20240101_120000.db.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "WARNING: This will replace the current database!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Stopping backend service..."
docker stop tcc-backend

# Decompress if gzipped
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "Decompressing backup..."
    TEMP_FILE=$(mktemp)
    gunzip -c "${BACKUP_FILE}" > "${TEMP_FILE}"
    RESTORE_FILE="${TEMP_FILE}"
else
    RESTORE_FILE="${BACKUP_FILE}"
fi

echo "Restoring database..."
docker cp "${RESTORE_FILE}" tcc-backend:/app/data/trading.db

# Clean up temp file
if [ -n "${TEMP_FILE}" ]; then
    rm "${TEMP_FILE}"
fi

echo "Starting backend service..."
docker start tcc-backend

echo "Restore completed successfully!"
echo "Please verify the application is working correctly."
