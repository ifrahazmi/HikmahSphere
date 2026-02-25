#!/bin/bash

# ============================================
# HikmahSphere - Nginx Configuration Fix
# ============================================
# This script will safely restore Nginx configuration
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}🔧 HikmahSphere Nginx Fix${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Step 1: Backup current config
echo -e "${YELLOW}▶ Step 1: Backing up current Nginx config...${NC}"
sudo cp /etc/nginx/sites-available/hikmahsphere /etc/nginx/sites-available/hikmahsphere.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Step 2: Copy new config
echo -e "${YELLOW}▶ Step 2: Copying new Nginx configuration...${NC}"
sudo cp ~/HikmahSphere/deploy/nginx-hikmah.conf /etc/nginx/sites-available/hikmahsphere
echo -e "${GREEN}✓ Configuration copied${NC}"
echo ""

# Step 3: Ensure site is enabled
echo -e "${YELLOW}▶ Step 3: Ensuring site is enabled...${NC}"
if [ ! -L /etc/nginx/sites-enabled/hikmahsphere ]; then
    sudo ln -sf /etc/nginx/sites-available/hikmahsphere /etc/nginx/sites-enabled/hikmahsphere
    echo -e "${GREEN}✓ Site enabled${NC}"
else
    echo -e "${GREEN}✓ Site already enabled${NC}"
fi
echo ""

# Step 4: Remove default site if exists
echo -e "${YELLOW}▶ Step 4: Removing default site...${NC}"
sudo rm -f /etc/nginx/sites-enabled/default
echo -e "${GREEN}✓ Default site removed${NC}"
echo ""

# Step 5: Test Nginx configuration
echo -e "${YELLOW}▶ Step 5: Testing Nginx configuration...${NC}"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration test failed!${NC}"
    sudo nginx -t
    exit 1
fi
echo ""

# Step 6: Restart Nginx
echo -e "${YELLOW}▶ Step 6: Restarting Nginx...${NC}"
sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"
echo ""

# Step 7: Check status
echo -e "${YELLOW}▶ Step 7: Checking Nginx status...${NC}"
if sudo systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running!${NC}"
    sudo systemctl status nginx
    exit 1
fi
echo ""

# Step 8: Test accessibility
echo -e "${YELLOW}▶ Step 8: Testing website accessibility...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://hikmahsphere.site | grep -q "200"; then
    echo -e "${GREEN}✓ Website is accessible at http://hikmahsphere.site${NC}"
else
    echo -e "${YELLOW}⚠ Website may not be accessible yet - wait a few seconds and refresh${NC}"
fi
echo ""

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Nginx Fix Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Your website should now be accessible at:${NC}"
echo -e "${GREEN}  👉 http://hikmahsphere.site${NC}"
echo ""
echo -e "${YELLOW}Note: HTTPS will redirect to HTTP until SSL is configured${NC}"
echo -e "${YELLOW}To enable SSL later:${NC}"
echo -e "${CYAN}  sudo certbot --nginx -d hikmahsphere.site -d www.hikmahsphere.site${NC}"
echo ""
