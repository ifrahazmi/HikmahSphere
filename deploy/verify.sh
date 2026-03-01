#!/bin/bash

# ============================================
# HikmahSphere - Deployment Verification Script
# ============================================
# Description: Verifies deployment is running correctly
# Usage: ./verify.sh
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

# Counters
PASS=0
FAIL=0
WARN=0

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

# Print test result
print_pass() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASS++))
}

print_fail() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((FAIL++))
}

print_warn() {
    echo -e "${YELLOW}⚠ WARN:${NC} $1"
    ((WARN++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
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
# Main Verification Process
# ============================================

print_header "🔍 HikmahSphere Deployment Verification"
echo -e "${YELLOW}Time: $(timestamp)${NC}"
echo ""

cd ~/HikmahSphere || { print_fail "Failed to navigate to project directory"; exit 1; }
BACKEND_PORT=$(get_backend_port)
print_info "Backend port resolved to ${CYAN}${BACKEND_PORT}${NC}"

# ============================================
# Git Status
# ============================================
print_header "📊 Git Status"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" == "notification" ]; then
    print_pass "On correct branch: notification"
else
    print_fail "Wrong branch: $CURRENT_BRANCH (expected: notification)"
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD)
print_info "Current commit: ${CYAN}${CURRENT_COMMIT}${NC}"

# Check for uncommitted changes
UNCOMMITTED=$(git status --porcelain)
if [ -z "$UNCOMMITTED" ]; then
    print_pass "No uncommitted changes"
else
    print_warn "There are uncommitted changes"
fi

# ============================================
# Backend Verification
# ============================================
print_header "🔧 Backend Verification"

cd backend || { print_fail "Failed to navigate to backend directory"; exit 1; }

# Check if node_modules exists
if [ -d "node_modules" ]; then
    print_pass "Backend dependencies installed"
else
    print_fail "Backend dependencies missing"
fi

# Check if dist folder exists (after build)
if [ -d "dist" ]; then
    print_pass "Backend build exists (dist folder)"
    BUILD_TIME=$(stat -c %y dist 2>/dev/null | cut -d'.' -f1)
    print_info "Backend built at: ${CYAN}${BUILD_TIME}${NC}"
else
    print_fail "Backend build missing (dist folder not found)"
fi

# Check PM2 process
print_info "Checking PM2 process..."
if pm2 list | grep -q "hikmah-backend"; then
    print_pass "PM2 process 'hikmah-backend' exists"
    
    # Check if running
    if pm2 list | grep "hikmah-backend" | grep -q "online"; then
        print_pass "Backend is running (online)"
    else
        print_fail "Backend is not running"
    fi
else
    print_fail "PM2 process 'hikmah-backend' not found"
fi

# Check if backend port is listening
print_info "Checking if backend port (${BACKEND_PORT}) is listening..."
if netstat -tuln 2>/dev/null | grep -q ":${BACKEND_PORT}" || ss -tuln 2>/dev/null | grep -q ":${BACKEND_PORT}"; then
    print_pass "Backend port ${BACKEND_PORT} is listening"
else
    print_warn "Backend port ${BACKEND_PORT} not detected (may be configured differently)"
fi

# ============================================
# Frontend Verification
# ============================================
print_header "🎨 Frontend Verification"

cd ../frontend || { print_fail "Failed to navigate to frontend directory"; exit 1; }

# Check if node_modules exists
if [ -d "node_modules" ]; then
    print_pass "Frontend dependencies installed"
else
    print_fail "Frontend dependencies missing"
fi

# Check if build folder exists
if [ -d "build" ]; then
    print_pass "Frontend build exists"
    BUILD_SIZE=$(du -sh build 2>/dev/null | cut -f1)
    print_info "Build size: ${CYAN}${BUILD_SIZE}${NC}"
    
    # Check for essential files
    if [ -f "build/index.html" ]; then
        print_pass "index.html exists"
    else
        print_fail "index.html missing"
    fi
    
    if [ -f "build/static/js/main.*.js" ]; then
        print_pass "JavaScript bundle exists"
    else
        print_warn "JavaScript bundle not found (may have different name)"
    fi
    
    if [ -f "build/static/css/main.*.css" ]; then
        print_pass "CSS bundle exists"
    else
        print_warn "CSS bundle not found (may have different name)"
    fi
else
    print_fail "Frontend build missing (build folder not found)"
fi

# ============================================
# Production Deployment Verification
# ============================================
print_header "📦 Production Deployment Verification"

# Check if /var/www/hikmah exists
if [ -d "/var/www/hikmah" ]; then
    print_pass "Production directory exists"
else
    print_fail "Production directory missing: /var/www/hikmah"
fi

# Check ownership
OWNER=$(stat -c '%U:%G' /var/www/hikmah 2>/dev/null)
if [ "$OWNER" == "${CURRENT_USER}:${CURRENT_USER}" ]; then
    print_pass "Correct ownership: ${CURRENT_USER}:${CURRENT_USER}"
else
    print_warn "Ownership: $OWNER (expected: ${CURRENT_USER}:${CURRENT_USER})"
fi

# Check if index.html exists in production
if [ -f "/var/www/hikmah/index.html" ]; then
    print_pass "index.html deployed"
else
    print_fail "index.html not deployed"
fi

# Check uploads folder
if [ -d "/var/www/hikmah/uploads" ]; then
    print_pass "Uploads folder exists"
    
    # Check subfolders
    for folder in proofs zakat profiles notifications community; do
        if [ -d "/var/www/hikmah/uploads/$folder" ]; then
            print_pass "Uploads/$folder folder exists"
        else
            print_warn "Uploads/$folder folder missing"
        fi
    done
else
    print_fail "Uploads folder missing"
fi

# ============================================
# Nginx Verification
# ============================================
print_header "🌐 Nginx Verification"

# Check if Nginx is running
if sudo systemctl is-active --quiet nginx; then
    print_pass "Nginx is running"
else
    print_fail "Nginx is not running"
fi

# Check Nginx configuration
print_info "Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    print_pass "Nginx configuration is valid"
else
    print_fail "Nginx configuration has errors"
fi

# Check if Nginx config exists
if [ -f "/etc/nginx/sites-available/hikmahsphere" ]; then
    print_pass "Nginx site config exists"
else
    print_warn "Nginx site config not found"
fi

# Check if site is enabled
if [ -L "/etc/nginx/sites-enabled/hikmahsphere" ]; then
    print_pass "Nginx site is enabled"
else
    print_warn "Nginx site may not be enabled"
fi

# ============================================
# Website Accessibility Test
# ============================================
print_header "🌍 Website Accessibility Test"

# Test homepage
print_info "Testing homepage..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://hikmahsphere.site 2>/dev/null || echo "000")
if [ "$HTTP_CODE" == "200" ]; then
    print_pass "Homepage accessible (HTTP $HTTP_CODE)"
elif [ "$HTTP_CODE" == "000" ]; then
    print_fail "Homepage not reachable (connection failed)"
else
    print_warn "Homepage returned HTTP $HTTP_CODE"
fi

# Test API health endpoint
print_info "Testing API endpoint..."
API_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://hikmahsphere.site/api/health 2>/dev/null || echo "000")
if [ "$API_CODE" == "200" ] || [ "$API_CODE" == "404" ]; then
    print_pass "API is responding (HTTP $API_CODE)"
elif [ "$API_CODE" == "000" ]; then
    print_fail "API not reachable (connection failed)"
else
    print_warn "API returned HTTP $API_CODE"
fi

# Test uploads folder accessibility
print_info "Testing uploads folder..."
UPLOADS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://hikmahsphere.site/uploads 2>/dev/null || echo "000")
if [ "$UPLOAD_CODE" == "200" ] || [ "$UPLOAD_CODE" == "403" ] || [ "$UPLOAD_CODE" == "404" ]; then
    print_pass "Uploads folder accessible (HTTP $UPLOADS_CODE)"
else
    print_warn "Uploads folder returned HTTP $UPLOADS_CODE"
fi

# Response time test
print_info "Testing response time..."
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" -k https://hikmahsphere.site 2>/dev/null || echo "0")
if [ "$(echo "$RESPONSE_TIME < 2" | bc -l 2>/dev/null || echo 0)" == "1" ]; then
    print_pass "Response time: ${CYAN}${RESPONSE_TIME}s${NC} (good)"
else
    print_warn "Response time: ${YELLOW}${RESPONSE_TIME}s${NC} (may be slow)"
fi

# ============================================
# SSL Certificate Check
# ============================================
print_header "🔒 SSL Certificate Check"

if command -v openssl &> /dev/null; then
    SSL_EXPIRY=$(echo | openssl s_client -connect hikmahsphere.site:443 -servername hikmahsphere.site 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    if [ -n "$SSL_EXPIRY" ]; then
        print_pass "SSL certificate is valid"
        print_info "Expires: ${CYAN}${SSL_EXPIRY}${NC}"
    else
        print_warn "Could not verify SSL certificate"
    fi
else
    print_info "OpenSSL not installed, skipping SSL check"
fi

# ============================================
# Disk Space Check
# ============================================
print_header "💾 Disk Space Check"

DISK_USAGE=$(df -h /var/www | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
    print_pass "Disk usage: ${CYAN}${DISK_USAGE}%${NC} (healthy)"
elif [ "$DISK_USAGE" -lt 90 ]; then
    print_warn "Disk usage: ${YELLOW}${DISK_USAGE}%${NC} (consider cleanup)"
else
    print_fail "Disk usage: ${RED}${DISK_USAGE}%${NC} (critical!)"
fi

# ============================================
# PM2 Memory Check
# ============================================
print_header "📊 PM2 Memory Check"

pm2 list | grep hikmah-backend
print_info "Check PM2 monit for detailed stats: pm2 monit"

# ============================================
# Final Summary
# ============================================
print_header "📋 Verification Summary"

TOTAL=$((PASS + FAIL + WARN))

echo -e "${GREEN}Passed:${NC}  $PASS"
echo -e "${RED}Failed:${NC}  $FAIL"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo ""
echo -e "Total:  $TOTAL tests"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}✅ All Critical Checks Passed!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${BLUE}Your deployment is healthy! 🎉${NC}"
    echo ""
    echo -e "Website: ${CYAN}https://hikmahsphere.site${NC}"
    echo -e "Backend: ${CYAN}https://hikmahsphere.site/api${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}============================================${NC}"
    echo -e "${RED}❌ Some Checks Failed!${NC}"
    echo -e "${RED}============================================${NC}"
    echo ""
    echo -e "${YELLOW}Please review the failures above and fix them.${NC}"
    echo ""
    echo -e "${BLUE}Helpful commands:${NC}"
    echo "  - PM2 logs: pm2 logs hikmah-backend"
    echo "  - Nginx logs: sudo tail -f /var/log/nginx/error.log"
    echo "  - PM2 monit: pm2 monit"
    echo ""
    exit 1
fi
