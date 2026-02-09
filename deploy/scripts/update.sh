#!/bin/bash
# Update application script

set -e

APP_DIR="${APP_DIR:-/opt/trading-command-center/crypto-dashboard}"
DEPLOY_DIR="${APP_DIR}/deploy"

echo "========================================="
echo "Trading Command Center - Update Script"
echo "========================================="

cd ${APP_DIR}

# Create backup before update
echo "Creating backup before update..."
${DEPLOY_DIR}/scripts/backup.sh

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Rebuild containers
echo "Rebuilding containers..."
cd ${DEPLOY_DIR}
docker-compose build --no-cache

# Rolling update
echo "Performing rolling update..."
docker-compose up -d --force-recreate

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

# Check health
echo "Checking service health..."
if curl -s http://localhost/health | grep -q "healthy"; then
    echo "Update completed successfully!"
else
    echo "WARNING: Health check failed. Please check the logs."
    docker-compose logs --tail=50
fi

echo ""
echo "Update complete!"
echo "Check logs with: docker-compose logs -f"
