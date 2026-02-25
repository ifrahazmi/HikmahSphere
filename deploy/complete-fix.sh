#!/bin/bash

# ============================================
# HikmahSphere - Complete Nginx & Deploy Fix
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}🔧 HikmahSphere Complete Fix${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root (sudo ./complete-fix.sh)${NC}"
    exit 1
fi

# Step 1: Check nginx main config
echo -e "${YELLOW}▶ Step 1: Checking Nginx main configuration...${NC}"

# Create safe nginx.conf if it doesn't exist or is corrupted
cat > /etc/nginx/nginx.conf << 'EOF'
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
EOF

echo -e "${GREEN}✓ Nginx main config restored${NC}"
echo ""

# Step 2: Copy site configuration
echo -e "${YELLOW}▶ Step 2: Copying site configuration...${NC}"

cat > /etc/nginx/sites-available/hikmahsphere << 'EOF'
server {
    listen 80;
    server_name hikmahsphere.site www.hikmahsphere.site;

    root /var/www/hikmah;
    index index.html;

    # React SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/hikmah/uploads/;
        expires 7d;
        add_header Cache-Control "public";
        add_header Access-Control-Allow-Origin *;
    }

    # Block dangerous file types globally
    location ~* \.(php|sh|py|pl|cgi|exe)$ {
        deny all;
        return 404;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
EOF

echo -e "${GREEN}✓ Site configuration copied${NC}"
echo ""

# Step 3: Enable site
echo -e "${YELLOW}▶ Step 3: Enabling site...${NC}"
ln -sf /etc/nginx/sites-available/hikmahsphere /etc/nginx/sites-enabled/hikmahsphere
rm -f /etc/nginx/sites-enabled/default
echo -e "${GREEN}✓ Site enabled${NC}"
echo ""

# Step 4: Create upload directories
echo -e "${YELLOW}▶ Step 4: Creating upload directories...${NC}"
mkdir -p /var/www/hikmah/uploads/{proofs,profiles,notifications,community}
chown -R www-data:www-data /var/www/hikmah/uploads
chmod -R 755 /var/www/hikmah/uploads
echo -e "${GREEN}✓ Upload directories created${NC}"
echo ""

# Step 5: Test nginx
echo -e "${YELLOW}▶ Step 5: Testing Nginx configuration...${NC}"
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration test failed!${NC}"
    nginx -t
    exit 1
fi
echo ""

# Step 6: Restart nginx
echo -e "${YELLOW}▶ Step 6: Restarting Nginx...${NC}"
systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"
echo ""

# Step 7: Check if backend is running
echo -e "${YELLOW}▶ Step 7: Checking backend status...${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "hikmah-backend"; then
        echo -e "${GREEN}✓ Backend is running${NC}"
    else
        echo -e "${YELLOW}⚠ Backend not found in PM2${NC}"
        echo -e "${YELLOW}Starting backend...${NC}"
        cd /home/ifrahazmi/HikmahSphere/backend || exit 1
        pm2 start npm --name "hikmah-backend" -- start
        echo -e "${GREEN}✓ Backend started${NC}"
    fi
else
    echo -e "${RED}✗ PM2 not installed!${NC}"
fi
echo ""

# Step 8: Test accessibility
echo -e "${YELLOW}▶ Step 8: Testing accessibility...${NC}"
sleep 2

if curl -s -o /dev/null -w "%{http_code}" http://localhost | grep -q "200"; then
    echo -e "${GREEN}✓ Frontend accessible on localhost${NC}"
else
    echo -e "${RED}✗ Frontend NOT accessible on localhost${NC}"
    echo -e "${YELLOW}Checking if files exist...${NC}"
    if [ -f /var/www/hikmah/index.html ]; then
        echo -e "${GREEN}✓ index.html exists${NC}"
    else
        echo -e "${RED}✗ index.html NOT found!${NC}"
        echo -e "${YELLOW}Copying frontend files...${NC}"
        cp -r /home/ifrahazmi/HikmahSphere/frontend/build/* /var/www/hikmah/ 2>/dev/null || echo "Frontend build not found"
    fi
fi

if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health | grep -qE "200|404"; then
    echo -e "${GREEN}✓ Backend API accessible${NC}"
else
    echo -e "${RED}✗ Backend API NOT accessible${NC}"
fi
echo ""

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Complete Fix Applied!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}Access your website at:${NC}"
echo -e "${GREEN}  👉 http://hikmahsphere.site${NC}"
echo -e "${GREEN}  👉 http://localhost${NC}"
echo ""
echo -e "${YELLOW}If still not accessible:${NC}"
echo "  1. Check firewall: sudo ufw status"
echo "  2. Allow HTTP: sudo ufw allow 80/tcp"
echo "  3. Check logs: tail -f /var/log/nginx/error.log"
echo "  4. Check backend: pm2 logs hikmah-backend"
echo ""
