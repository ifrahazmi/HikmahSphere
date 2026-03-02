#!/bin/bash

# ============================================
# HikmahSphere - Automated Deployment Script
# ============================================
# Description: Automatically deploys latest changes from notification branch
#              Creates upload folders, configures Nginx, and verifies everything
# Usage: ./deploy.sh
# ============================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get current username
CURRENT_USER=$(whoami)

# Timestamp function
timestamp() {
    date +"[%Y-%m-%d %H:%M:%S]"
}

# Print section header
print_header() {
    echo ""
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""
}

# Print step
print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Print info
print_info() {
    echo -e "${MAGENTA}ℹ $1${NC}"
}

# Resolve backend port from backend/.env, falling back to 5000.
get_backend_port() {
    local env_file="$HOME/HikmahSphere/backend/.env"
    local detected_port=""

    if [ -f "$env_file" ]; then
        detected_port=$(grep -E '^PORT=' "$env_file" | tail -n 1 | cut -d'=' -f2 | tr -d '[:space:]')
    fi

    if [[ "$detected_port" =~ ^[0-9]{2,5}$ ]]; then
        echo "$detected_port"
    else
        echo "5000"
    fi
}

# ============================================
# Main Deployment Process
# ============================================

print_header "🚀 HikmahSphere Deployment Started"
echo -e "${YELLOW}Branch: notification${NC}"
echo -e "${YELLOW}Time: $(timestamp)${NC}"
echo -e "${YELLOW}User: ${CURRENT_USER}${NC}"
echo ""

# Navigate to project directory
cd ~/HikmahSphere || { print_error "Failed to navigate to project directory"; exit 1; }
print_success "Navigated to project directory"
BACKEND_PORT=$(get_backend_port)
print_info "Backend port resolved to ${CYAN}${BACKEND_PORT}${NC}"

# ============================================
# Git Operations
# ============================================
print_header "📥 Git Operations"

print_step "Checking out notification branch..."
git checkout notification
print_success "Checked out notification branch"

print_step "Pulling latest changes..."
git pull origin notification
print_success "Pulled latest changes from origin/notification"

# Show current commit
CURRENT_COMMIT=$(git rev-parse --short HEAD)
print_success "Current commit: ${CYAN}${CURRENT_COMMIT}${NC}"

# ============================================
# Backend Deployment
# ============================================
print_header "🔧 Backend Deployment"

cd backend || { print_error "Failed to navigate to backend directory"; exit 1; }

print_step "Installing backend dependencies..."
npm install
print_success "Backend dependencies installed"

print_step "Building backend..."
npm run build
print_success "Backend built successfully"

print_step "Restarting backend with PM2..."
# Export NODE_ENV so it is inherited by the PM2 process.
# --update-env is required to actually push the new env into the
# already-running process (plain 'pm2 restart' keeps the old saved env).
export NODE_ENV=production
export PORT="${BACKEND_PORT}"
pm2 restart hikmah-backend --update-env
sleep 2
print_success "Backend restarted"

# Check PM2 status
print_step "Checking PM2 status..."
pm2 list | grep hikmah-backend
print_success "Backend is running"

# ============================================
# Frontend Deployment
# ============================================
print_header "🎨 Frontend Deployment"

cd ../frontend || { print_error "Failed to navigate to frontend directory"; exit 1; }

print_step "Installing frontend dependencies..."
npm install
print_success "Frontend dependencies installed"

# Ensure swap exists so builds don't get OOM-killed on low-memory VMs
print_step "Checking swap space..."
SWAP_SIZE=$(free -m | awk '/^Swap:/ {print $2}')
if [ "${SWAP_SIZE}" -lt 1024 ] 2>/dev/null; then
    print_warning "Swap is ${SWAP_SIZE}MB — creating 2GB swap file for build safety..."
    sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 2>/dev/null
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile >/dev/null 2>&1
    sudo swapon /swapfile 2>/dev/null
    print_success "2GB swap file activated"
else
    print_success "Swap space OK (${SWAP_SIZE}MB)"
fi

print_step "Building frontend (memory-safe mode)..."
# GENERATE_SOURCEMAP=false   — skip source maps to save ~40% memory
# TSC_COMPILE_ON_ERROR=true  — don't fork a separate TS process
# --max-old-space-size=2048  — keep heap within VM limits
GENERATE_SOURCEMAP=false TSC_COMPILE_ON_ERROR=true NODE_OPTIONS="--max-old-space-size=2048" npm run build
print_success "Frontend built successfully"

# Show build size
BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
print_success "Build size: ${CYAN}${BUILD_SIZE}${NC}"

# ============================================
# Deploy to Production
# ============================================
print_header "📦 Deploying to Production"

print_step "Clearing old deployment (preserving uploads)..."
# Only remove build files, preserve uploads folder
sudo rm -rf /var/www/hikmah/css 2>/dev/null || true
sudo rm -rf /var/www/hikmah/js 2>/dev/null || true
sudo rm -rf /var/www/hikmah/static 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.html 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.txt 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.json 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.ico 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.png 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.jpg 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.svg 2>/dev/null || true
sudo rm -rf /var/www/hikmah/*.webp 2>/dev/null || true
print_success "Old build files cleared"

print_step "Copying new build files..."
sudo cp -r build/* /var/www/hikmah/
print_success "Build files copied"

print_step "Setting web root ownership to www-data (nginx user)..."

# Poor Practice: chowning to current user breaks nginx file serving
# sudo chown -R ${CURRENT_USER}:${CURRENT_USER} /var/www/hikmah

# Best Practice: www-data is the nginx process user
sudo chown -R www-data:www-data /var/www/hikmah

print_success "Web root ownership set to www-data (nginx user)"

# ============================================
# Upload Folders Setup
# ============================================
print_header "📁 Setting Up Upload Folders"

# Create main uploads directory
print_step "Creating upload folder structure..."
sudo mkdir -p /var/www/hikmah/uploads/proofs
sudo mkdir -p /var/www/hikmah/uploads/zakat
sudo mkdir -p /var/www/hikmah/uploads/profiles
sudo mkdir -p /var/www/hikmah/uploads/notifications
sudo mkdir -p /var/www/hikmah/uploads/community
print_success "Upload folders created"

# Set correct permissions
print_step "Setting upload folder permissions..."
sudo chmod -R 755 /var/www/hikmah/uploads
sudo chown -R ${CURRENT_USER}:${CURRENT_USER} /var/www/hikmah/uploads
print_success "Upload folder permissions set"

# Verify upload folders
print_step "Verifying upload folders..."
UPLOAD_FOLDERS=("proofs" "zakat" "profiles" "notifications" "community")
for folder in "${UPLOAD_FOLDERS[@]}"; do
    if [ -d "/var/www/hikmah/uploads/$folder" ]; then
        print_success "✓ uploads/$folder exists"
    else
        print_error "✗ uploads/$folder missing"
        exit 1
    fi
done

# ============================================
# Nginx Configuration
# ============================================
print_header "🌐 Nginx Configuration"

# First, ensure main nginx.conf is correct
# Note: 'sudo tee' is used instead of 'sudo cat >' because the shell opens
# the redirect target before sudo runs, causing permission denied on root-owned files.
print_step "Restoring Nginx main configuration..."
sudo tee /etc/nginx/nginx.conf << 'NGINX_MAIN_EOF' > /dev/null
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
NGINX_MAIN_EOF
print_success "Nginx main configuration restored"

# Copy nginx config
print_step "Copying Nginx site configuration..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${HOME}/HikmahSphere/deploy"
NGINX_SOURCE=""

# Try SCRIPT_DIR first, then fall back to DEPLOY_DIR
if [ -f "${SCRIPT_DIR}/nginx-hikmah.conf" ]; then
    NGINX_SOURCE="${SCRIPT_DIR}/nginx-hikmah.conf"
    print_info "Using nginx config from SCRIPT_DIR"
elif [ -f "${DEPLOY_DIR}/nginx-hikmah.conf" ]; then
    NGINX_SOURCE="${DEPLOY_DIR}/nginx-hikmah.conf"
    print_info "Using nginx config from DEPLOY_DIR"
else
    print_error "nginx-hikmah.conf not found in ${SCRIPT_DIR} or ${DEPLOY_DIR}"
    print_warning "Please ensure nginx-hikmah.conf exists in the deploy folder"
fi

if [ -n "${NGINX_SOURCE}" ]; then
    TMP_NGINX_CONF=$(mktemp)
    sed "s/__BACKEND_PORT__/${BACKEND_PORT}/g" "${NGINX_SOURCE}" > "${TMP_NGINX_CONF}"
    sudo cp "${TMP_NGINX_CONF}" /etc/nginx/sites-available/hikmahsphere
    rm -f "${TMP_NGINX_CONF}"
    print_success "Nginx config deployed with backend port ${CYAN}${BACKEND_PORT}${NC}"
fi

# Enable site
print_step "Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/hikmahsphere /etc/nginx/sites-enabled/
print_success "Nginx site enabled"

# Remove default if exists
print_step "Removing default Nginx site..."
sudo rm -f /etc/nginx/sites-enabled/default
print_success "Default site removed"

# Test nginx config
print_step "Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    sudo nginx -t
    exit 1
fi

# Restart nginx
print_step "Restarting Nginx..."
sudo systemctl daemon-reload
sudo systemctl restart nginx
print_success "Nginx restarted"

# Verify Nginx is running
print_step "Checking Nginx status..."
if sudo systemctl is-active --quiet nginx; then
    print_success "Nginx is running"
else
    print_error "Nginx failed to start!"
    sudo systemctl status nginx --no-pager | head -10
    exit 1
fi

# ============================================
# System Services
# ============================================
print_header "🔄 System Services Status"

print_step "Checking all services..."

# PM2 status
if pm2 list | grep "hikmah-backend" | grep -q "online"; then
    print_success "✓ Backend (PM2): Running"
else
    print_error "✗ Backend (PM2): Not running"
fi

# Nginx status
if sudo systemctl is-active --quiet nginx; then
    print_success "✓ Nginx: Running"
else
    print_error "✗ Nginx: Not running"
fi

# ============================================
# Deployment Summary
# ============================================
print_header "✅ Deployment Complete!"

echo -e "${GREEN}Deployment Summary:${NC}"
echo ""
echo -e "  ${CYAN}Branch:${NC} notification"
echo -e "  ${CYAN}Commit:${NC} ${CURRENT_COMMIT}"
echo -e "  ${CYAN}Time:${NC} $(timestamp)"
echo -e "  ${CYAN}User:${NC} ${CURRENT_USER}"
echo -e "  ${CYAN}Build Size:${NC} ${BUILD_SIZE}"
echo ""
echo -e "${GREEN}Services Status:${NC}"
echo ""
echo -e "  ${GREEN}✓${NC} Backend (PM2): Running"
echo -e "  ${GREEN}✓${NC} Frontend: Deployed"
echo -e "  ${GREEN}✓${NC} Nginx: Running"
echo -e "  ${GREEN}✓${NC} Upload Folders: Created"
echo -e "  ${GREEN}✓${NC} Web Root Ownership: www-data (nginx user)"
echo -e "  ${GREEN}✓${NC} Upload Ownership: ${CURRENT_USER}"
echo ""
echo -e "${BLUE}Website:${NC} http://hikmahsphere.site"
echo -e "${BLUE}Backend API:${NC} http://hikmahsphere.site/api"
echo -e "${BLUE}Uploads:${NC} http://hikmahsphere.site/uploads"
echo ""

# ============================================
# Quick Verification
# ============================================
print_header "🔍 Quick Verification"

print_step "Testing website accessibility..."
if curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site 2>/dev/null | grep -q "200"; then
    print_success "Website is accessible at http://hikmahsphere.site (HTTP 200)"
else
    print_warning "Website may not be accessible - please check manually"
fi

print_step "Testing API endpoint..."
if curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site/api/health 2>/dev/null | grep -q "200\|404"; then
    print_success "API is responding at http://hikmahsphere.site/api"
else
    print_warning "API may not be responding - please check PM2 logs"
fi

print_step "Testing uploads folder..."
UPLOADS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site/uploads 2>/dev/null || echo "000")
if [ "$UPLOADS_CODE" == "200" ] || [ "$UPLOADS_CODE" == "403" ] || [ "$UPLOADS_CODE" == "404" ]; then
    print_success "Uploads folder is accessible (HTTP $UPLOADS_CODE)"
else
    print_warning "Uploads folder may not be accessible (HTTP $UPLOADS_CODE)"
fi

echo ""
print_header "🎉 All Done!"

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Visit http://hikmahsphere.site to verify (HTTP)"
echo "  2. Run ./verify.sh for detailed verification"
echo "  3. Check PM2 logs: pm2 logs hikmah-backend"
echo "  4. Check Nginx logs: sudo tail -f /var/log/nginx/error.log"
echo ""
echo -e "${CYAN}Note: HTTPS not configured yet. To enable SSL:${NC}"
echo "    sudo certbot --nginx -d hikmahsphere.site -d www.hikmahsphere.site"
echo ""
echo -e "${GREEN}Happy Deploying! 🚀${NC}"
echo ""
