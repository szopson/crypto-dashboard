# Trading Command Center - Deployment Guide

Complete guide for deploying TCC to a Hostinger VPS or any Linux server.

## Prerequisites

- VPS with Ubuntu 22.04+ (2GB RAM minimum, 4GB recommended)
- Domain name pointed to your server's IP
- SSH access to your server

## Quick Start (Automated)

### 1. Connect to your VPS

```bash
ssh root@your-server-ip
```

### 2. Upload the application

Option A - From your local machine:
```bash
# On your local machine
scp -r /path/to/crypto-dashboard root@your-server-ip:/opt/
```

Option B - Clone from Git:
```bash
# On the server
cd /opt
git clone https://github.com/your-username/crypto-dashboard.git
```

### 3. Run the deployment script

```bash
cd /opt/crypto-dashboard/deploy
chmod +x deploy.sh

# Set your domain and email
export DOMAIN="your-domain.com"
export EMAIL="your-email@example.com"

# Run deployment
./deploy.sh
```

### 4. Configure environment variables

```bash
nano /opt/crypto-dashboard/deploy/.env.production
```

Essential variables to set:
- `BYBIT_API_KEY` - Your Bybit API key
- `BYBIT_API_SECRET` - Your Bybit API secret
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHANNEL_ID` - Your Telegram channel ID
- `SECRET_KEY` - Generate with `openssl rand -hex 32`

### 5. Restart services

```bash
cd /opt/crypto-dashboard/deploy
docker-compose down
docker-compose up -d
```

---

## Manual Deployment

### Step 1: System Setup

```bash
# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y curl git ufw

# Configure firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw enable
```

### Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Start Docker
systemctl enable docker
systemctl start docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Step 3: Setup Application

```bash
# Create app directory
mkdir -p /opt/trading-command-center
cd /opt/trading-command-center

# Clone or copy your application
git clone https://github.com/your-username/crypto-dashboard.git

# Setup environment
cd crypto-dashboard/deploy
cp .env.production.example .env.production
nano .env.production
```

### Step 4: Configure Domain

Edit the nginx config to use your domain:

```bash
# Update domain in nginx config
sed -i 's/your-domain.com/actual-domain.com/g' nginx/conf.d/default.conf
```

### Step 5: Get SSL Certificate

```bash
# Create directories
mkdir -p certbot/conf certbot/www

# Get certificate (first, start nginx without SSL)
# Create temporary config...

docker run --rm -v $(pwd)/certbot/conf:/etc/letsencrypt \
  -v $(pwd)/certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos --no-eff-email \
  -d your-domain.com -d www.your-domain.com
```

### Step 6: Build and Start

```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BYBIT_API_KEY` | Bybit API key | Yes |
| `BYBIT_API_SECRET` | Bybit API secret | Yes |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Yes |
| `TELEGRAM_CHANNEL_ID` | Channel for notifications | Yes |
| `SECRET_KEY` | App encryption key | Yes |
| `DATABASE_URL` | Database connection | No (defaults to SQLite) |
| `OPENROUTER_API_KEY` | For AI Copilot | No |
| `GEOIPUPDATE_ACCOUNT_ID` | MaxMind account ID (GeoLite2 for `/api/region`) | No (region gating degrades to fail-closed null) |
| `GEOIPUPDATE_LICENSE_KEY` | MaxMind license key for the geoipupdate sidecar | No (see above) |

> Note: the actual production flow deploys via the `Deploy to VPS` GitHub
> Actions workflow (push to `main` or workflow_dispatch), which upserts
> secrets from GitHub into `engine/.env` on the VPS. The manual SSH steps in
> this file are legacy/reference. GeoLite2 data by MaxMind
> (https://www.maxmind.com) — the sidecar keeps it under 30 days old per the
> GeoLite EULA.

### Getting API Keys

**Bybit API:**
1. Go to https://www.bybit.com/app/user/api-management
2. Create new API key with "Read-Only" permissions
3. Whitelist your server IP

**Telegram Bot:**
1. Message @BotFather on Telegram
2. Create new bot with `/newbot`
3. Copy the token

**Telegram Channel ID:**
1. Create a channel and add your bot as admin
2. Send a message to the channel
3. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find the `chat.id` value

---

## Operations

### View Logs

```bash
cd /opt/crypto-dashboard/deploy

# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Update Application

```bash
cd /opt/crypto-dashboard

# Pull latest changes
git pull origin main

# Rebuild and restart
cd deploy
docker-compose build --no-cache
docker-compose up -d
```

### Backup Database

```bash
# Manual backup
./scripts/backup.sh

# Backups are stored in /opt/trading-command-center/backups/
```

### Restore Database

```bash
./scripts/restore.sh /path/to/backup.db.gz
```

---

## Monitoring

### Health Check

```bash
# Check if services are healthy
curl https://your-domain.com/health
```

### Resource Usage

```bash
# Docker stats
docker stats

# System resources
htop
df -h
```

### SSL Certificate

```bash
# Check certificate expiry
docker-compose run --rm certbot certificates

# Manual renewal
docker-compose run --rm certbot renew
```

---

## Troubleshooting

### Services not starting

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check if ports are in use
netstat -tulpn | grep -E '80|443|3000|8000'
```

### Database issues

```bash
# Access backend container
docker exec -it tcc-backend bash

# Check database
sqlite3 /app/data/trading.db ".tables"
```

### SSL issues

```bash
# Check certificate files exist
ls -la certbot/conf/live/your-domain.com/

# Regenerate certificate
docker-compose run --rm certbot certonly --force-renewal ...
```

### Memory issues

```bash
# Check memory usage
free -m
docker stats --no-stream

# Restart Docker if needed
systemctl restart docker
```

---

## Security Recommendations

1. **Keep system updated**
   ```bash
   apt update && apt upgrade -y
   ```

2. **Use SSH keys, disable password auth**
   ```bash
   nano /etc/ssh/sshd_config
   # Set: PasswordAuthentication no
   systemctl restart sshd
   ```

3. **Enable automatic security updates**
   ```bash
   apt install unattended-upgrades
   dpkg-reconfigure unattended-upgrades
   ```

4. **Monitor logs for suspicious activity**
   ```bash
   tail -f /var/log/auth.log
   ```

5. **Regularly backup your data**
   - Daily backups are configured automatically
   - Consider offsite backup (S3, Google Cloud, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Internet                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Nginx (Port 80/443)                   │
│              SSL Termination + Rate Limiting            │
└─────────────────────────────────────────────────────────┘
                    │                │
         /api/*     │                │     /*
                    ▼                ▼
┌──────────────────────┐    ┌──────────────────────┐
│   Backend (8000)     │    │   Frontend (3000)    │
│   FastAPI + Python   │    │   Next.js + React    │
└──────────────────────┘    └──────────────────────┘
         │
         ▼
┌──────────────────────┐
│   SQLite Database    │
│   /app/data/         │
└──────────────────────┘
```

---

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure domain DNS is pointing to your server
4. Check firewall allows ports 80 and 443
