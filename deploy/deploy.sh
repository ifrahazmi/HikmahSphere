#!/bin/bash

# 🕌 HikmahSphere One-Click Docker Deployment Script
# This script automates the complete deployment process

set -e  # Exit on any error

# Always operate from repository root even when invoked from another directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored messages
print_message() {
    echo -e "${GREEN}[HikmahSphere]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Display banner
echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      🕌  HikmahSphere - Docker Deployment Script  🕌      ║
║                                                           ║
║       The Unified Islamic Digital Platform                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if Docker is installed
print_message "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

print_message "✓ Docker is installed: $(docker --version)"

# Check if Docker Compose is installed
print_message "Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

print_message "✓ Docker Compose is installed"

# Check if Docker daemon is running
print_message "Checking Docker daemon..."
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

print_message "✓ Docker daemon is running"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_message "✓ .env file created. Please review and update with your configuration."
        print_info "Opening .env file for editing in 5 seconds... (Press Ctrl+C to skip)"
        sleep 5
        ${EDITOR:-nano} .env || true
    else
        print_error ".env.example not found. Cannot create .env file."
        exit 1
    fi
else
    print_message "✓ .env file exists"
fi

# Ask user for deployment type
echo ""
print_info "Select deployment type:"
echo "  1) Fresh installation (Clean start - removes existing data)"
echo "  2) Update deployment (Keeps existing data)"
echo "  3) Development mode (with hot reload)"
read -p "Enter your choice (1/2/3): " DEPLOY_TYPE

case $DEPLOY_TYPE in
    1)
        print_warning "⚠️  Fresh installation will remove all existing containers and volumes!"
        read -p "Are you sure? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            print_message "Installation cancelled."
            exit 0
        fi
        
        print_message "Stopping and removing existing containers..."
        docker-compose down -v 2>/dev/null || true
        
        print_message "Building and starting services..."
        docker-compose up -d --build
        ;;
    2)
        print_message "Updating deployment (keeping data)..."
        docker-compose down
        docker-compose up -d --build
        ;;
    3)
        print_message "Starting in development mode..."
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
        ;;
    *)
        print_error "Invalid choice. Exiting."
        exit 1
        ;;
esac

# Wait for services to be healthy
print_message "Waiting for services to start..."
sleep 10

# Check service health
print_message "Checking service health..."

# Check MongoDB
if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
    print_message "✓ MongoDB is healthy"
else
    print_warning "⚠ MongoDB health check failed (might still be starting)"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    print_message "✓ Redis is healthy"
else
    print_warning "⚠ Redis health check failed (might still be starting)"
fi

# Check Backend
BACKEND_PORT=$(grep BACKEND_PORT .env | cut -d '=' -f2 || echo "5000")
if curl -f http://localhost:${BACKEND_PORT}/health &> /dev/null; then
    print_message "✓ Backend is healthy"
else
    print_warning "⚠ Backend health check failed (might still be starting)"
fi

# Check Frontend
FRONTEND_PORT=$(grep FRONTEND_PORT .env | cut -d '=' -f2 || echo "3000")
if curl -f http://localhost:${FRONTEND_PORT} &> /dev/null; then
    print_message "✓ Frontend is healthy"
else
    print_warning "⚠ Frontend health check failed (might still be starting)"
fi

echo ""
print_message "═══════════════════════════════════════════════════════"
print_message "🎉 Deployment completed successfully!"
print_message "═══════════════════════════════════════════════════════"
echo ""
print_info "🌐 Access your application:"
echo "   Frontend: http://localhost:${FRONTEND_PORT}"
echo "   Backend API: http://localhost:${BACKEND_PORT}/api"
echo "   MongoDB: mongodb://localhost:27017"
echo "   Redis: localhost:6379"
echo ""
print_info "📋 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose stop"
echo "   Start services:   docker-compose start"
echo "   Restart services: docker-compose restart"
echo "   Remove all:       docker-compose down -v"
echo "   View status:      docker-compose ps"
echo ""
print_info "📊 Admin credentials (default):"
echo "   Email: admin@hikmah.com"
echo "   Password: Admin@123456"
echo "   ⚠️  Please change these credentials after first login!"
echo ""
print_message "Happy coding! 🚀"
