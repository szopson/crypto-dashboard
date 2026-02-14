#!/bin/bash
set -e

# Trading Command Center - Deployment Script
# Usage: ./deploy.sh [build|up|down|logs|restart]

COMPOSE_FILE="docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_env() {
    if [ ! -f ".env" ]; then
        log_error ".env file not found!"
        log_info "Copy .env.example to .env and fill in your values:"
        log_info "  cp .env.example .env"
        exit 1
    fi
    
    if [ ! -f "engine/.env" ]; then
        log_error "engine/.env file not found!"
        log_info "Copy engine/.env.example to engine/.env and fill in your values"
        exit 1
    fi
}

build() {
    log_info "Building Docker images..."
    docker compose -f $COMPOSE_FILE build --no-cache
    log_info "Build complete!"
}

up() {
    check_env
    log_info "Starting services..."
    docker compose -f $COMPOSE_FILE up -d
    log_info "Services started!"
    log_info "Frontend: http://localhost (or your server IP)"
    log_info "Backend API: http://localhost/api"
}

down() {
    log_info "Stopping services..."
    docker compose -f $COMPOSE_FILE down
    log_info "Services stopped."
}

restart() {
    down
    up
}

logs() {
    docker compose -f $COMPOSE_FILE logs -f "$@"
}

pull() {
    log_info "Pulling latest changes from git..."
    git pull origin main
}

update() {
    pull
    build
    restart
    log_info "Update complete!"
}

status() {
    docker compose -f $COMPOSE_FILE ps
}

case "$1" in
    build)
        build
        ;;
    up)
        up
        ;;
    down)
        down
        ;;
    restart)
        restart
        ;;
    logs)
        shift
        logs "$@"
        ;;
    pull)
        pull
        ;;
    update)
        update
        ;;
    status)
        status
        ;;
    *)
        echo "Trading Command Center - Deployment"
        echo ""
        echo "Usage: $0 {build|up|down|restart|logs|pull|update|status}"
        echo ""
        echo "Commands:"
        echo "  build   - Build Docker images"
        echo "  up      - Start all services"
        echo "  down    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - View logs (add service name for specific: logs backend)"
        echo "  pull    - Pull latest code from git"
        echo "  update  - Pull, build, and restart"
        echo "  status  - Show service status"
        exit 1
        ;;
esac
