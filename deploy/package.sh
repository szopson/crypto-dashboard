#!/bin/bash
# Package application for deployment
# Run this on your local machine before uploading to VPS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
PACKAGE_NAME="tcc-deploy-$(date +%Y%m%d).tar.gz"

echo "========================================="
echo "Trading Command Center - Package Script"
echo "========================================="
echo ""

cd "${PROJECT_DIR}"

# Create package
echo "Creating deployment package..."

tar -czvf "${PACKAGE_NAME}" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='*.pyc' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='*.db' \
    --exclude='venv' \
    --exclude='.venv' \
    --exclude='logs/*' \
    --exclude='.DS_Store' \
    engine \
    frontend \
    deploy \
    DEPLOYMENT.md

echo ""
echo "========================================="
echo "Package created: ${PROJECT_DIR}/${PACKAGE_NAME}"
echo "========================================="
echo ""
echo "Upload to your VPS with:"
echo "  scp ${PACKAGE_NAME} root@your-server-ip:/opt/"
echo ""
echo "Then on the server:"
echo "  cd /opt"
echo "  tar -xzvf ${PACKAGE_NAME}"
echo "  mv engine frontend deploy DEPLOYMENT.md crypto-dashboard/"
echo "  cd crypto-dashboard/deploy"
echo "  chmod +x deploy.sh scripts/*.sh"
echo "  DOMAIN=your-domain.com EMAIL=your@email.com ./deploy.sh"
echo ""
