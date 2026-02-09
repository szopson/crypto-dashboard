#!/bin/bash
set -e

# ===========================================
# Trading Command Center - Deployment Script
# ===========================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"your-domain.com"}
EMAIL=${EMAIL:-"your-email@example.com"}
APP_DIR="/opt/trading-command-center"

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Trading Command Center Deployment${NC}"
echo -e "${GREEN}=========================================${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# ===========================================
# Step 1: System Update & Dependencies
# ===========================================
echo ""
echo -e "${YELLOW}Step 1: Installing system dependencies...${NC}"

apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

print_status "System packages installed"

# ===========================================
# Step 2: Install Docker
# ===========================================
echo ""
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh

    # Start Docker service
    systemctl enable docker
    systemctl start docker

    print_status "Docker installed and started"
else
    print_status "Docker already installed"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed"
else
    print_status "Docker Compose already installed"
fi

# ===========================================
# Step 3: Configure Firewall
# ===========================================
echo ""
echo -e "${YELLOW}Step 3: Configuring firewall...${NC}"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

print_status "Firewall configured (SSH, HTTP, HTTPS allowed)"

# ===========================================
# Step 4: Create Application Directory
# ===========================================
echo ""
echo -e "${YELLOW}Step 4: Setting up application directory...${NC}"

mkdir -p ${APP_DIR}
cd ${APP_DIR}

# Create necessary directories
mkdir -p nginx/conf.d certbot/conf certbot/www logs data

print_status "Application directories created"

# ===========================================
# Step 5: Clone or Update Repository
# ===========================================
echo ""
echo -e "${YELLOW}Step 5: Setting up application files...${NC}"

if [ -d "${APP_DIR}/crypto-dashboard" ]; then
    cd ${APP_DIR}/crypto-dashboard
    git pull origin main
    print_status "Repository updated"
else
    print_warning "Please copy your application files to ${APP_DIR}/crypto-dashboard"
    print_warning "Or clone from your repository"
    echo ""
    echo "Example:"
    echo "  git clone https://github.com/your-username/crypto-dashboard.git ${APP_DIR}/crypto-dashboard"
    echo ""
fi

# ===========================================
# Step 6: Setup Environment
# ===========================================
echo ""
echo -e "${YELLOW}Step 6: Setting up environment...${NC}"

if [ ! -f "${APP_DIR}/crypto-dashboard/deploy/.env.production" ]; then
    if [ -f "${APP_DIR}/crypto-dashboard/deploy/.env.production.example" ]; then
        cp ${APP_DIR}/crypto-dashboard/deploy/.env.production.example ${APP_DIR}/crypto-dashboard/deploy/.env.production
        print_warning "Created .env.production from example. Please edit it with your values!"
        print_warning "Edit: ${APP_DIR}/crypto-dashboard/deploy/.env.production"
    fi
else
    print_status "Environment file exists"
fi

# ===========================================
# Step 7: Update Domain in Config
# ===========================================
echo ""
echo -e "${YELLOW}Step 7: Updating domain configuration...${NC}"

if [ -f "${APP_DIR}/crypto-dashboard/deploy/nginx/conf.d/default.conf" ]; then
    sed -i "s/your-domain.com/${DOMAIN}/g" ${APP_DIR}/crypto-dashboard/deploy/nginx/conf.d/default.conf
    print_status "Domain updated to ${DOMAIN}"
fi

# ===========================================
# Step 8: Initial SSL Certificate
# ===========================================
echo ""
echo -e "${YELLOW}Step 8: Setting up SSL certificates...${NC}"

# Create temporary nginx config for SSL challenge
cat > ${APP_DIR}/nginx-temp.conf << EOF
events {
    worker_connections 1024;
}
http {
    server {
        listen 80;
        server_name ${DOMAIN} www.${DOMAIN};
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'TCC Setup in Progress';
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Start temporary nginx for SSL challenge
docker run -d --name nginx-temp \
    -p 80:80 \
    -v ${APP_DIR}/nginx-temp.conf:/etc/nginx/nginx.conf:ro \
    -v ${APP_DIR}/certbot/www:/var/www/certbot:ro \
    nginx:alpine

# Request SSL certificate
docker run --rm \
    -v ${APP_DIR}/certbot/conf:/etc/letsencrypt \
    -v ${APP_DIR}/certbot/www:/var/www/certbot \
    certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email ${EMAIL} \
    --agree-tos \
    --no-eff-email \
    -d ${DOMAIN} \
    -d www.${DOMAIN}

# Stop temporary nginx
docker stop nginx-temp && docker rm nginx-temp
rm ${APP_DIR}/nginx-temp.conf

print_status "SSL certificates obtained"

# ===========================================
# Step 9: Build and Start Services
# ===========================================
echo ""
echo -e "${YELLOW}Step 9: Building and starting services...${NC}"

cd ${APP_DIR}/crypto-dashboard/deploy

# Build images
docker-compose build --no-cache

# Start services
docker-compose up -d

print_status "Services started"

# ===========================================
# Step 10: Setup Auto-renewal
# ===========================================
echo ""
echo -e "${YELLOW}Step 10: Setting up SSL auto-renewal...${NC}"

# Create renewal script
cat > /etc/cron.daily/certbot-renew << EOF
#!/bin/bash
cd ${APP_DIR}/crypto-dashboard/deploy
docker-compose run --rm certbot renew
docker-compose exec nginx nginx -s reload
EOF

chmod +x /etc/cron.daily/certbot-renew

print_status "SSL auto-renewal configured"

# ===========================================
# Step 11: Setup Database Backup
# ===========================================
echo ""
echo -e "${YELLOW}Step 11: Setting up database backups...${NC}"

mkdir -p ${APP_DIR}/backups

cat > /etc/cron.daily/tcc-backup << EOF
#!/bin/bash
BACKUP_DIR="${APP_DIR}/backups"
DATE=\$(date +%Y%m%d_%H%M%S)

# Backup SQLite database
docker cp tcc-backend:/app/data/trading.db \${BACKUP_DIR}/trading_\${DATE}.db

# Keep only last 30 days of backups
find \${BACKUP_DIR} -type f -name "*.db" -mtime +30 -delete

echo "Backup completed: \${BACKUP_DIR}/trading_\${DATE}.db"
EOF

chmod +x /etc/cron.daily/tcc-backup

print_status "Daily database backup configured"

# ===========================================
# Deployment Complete
# ===========================================
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your Trading Command Center is now running at:"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit environment variables:"
echo "     nano ${APP_DIR}/crypto-dashboard/deploy/.env.production"
echo ""
echo "  2. Restart services after editing:"
echo "     cd ${APP_DIR}/crypto-dashboard/deploy"
echo "     docker-compose down && docker-compose up -d"
echo ""
echo "  3. View logs:"
echo "     docker-compose logs -f"
echo ""
echo "  4. Check service status:"
echo "     docker-compose ps"
echo ""
echo "Useful commands:"
echo "  - Stop:    docker-compose down"
echo "  - Start:   docker-compose up -d"
echo "  - Rebuild: docker-compose build --no-cache && docker-compose up -d"
echo "  - Logs:    docker-compose logs -f [service]"
echo ""
