#!/bin/bash

# 🕌 HikmahSphere - Installation Verification Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "🔍 Verifying HikmahSphere Installation..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check counters
PASSED=0
FAILED=0

# Function to check service
check_service() {
    local name=$1
    local url=$2
    
    if curl -f -s -o /dev/null "$url"; then
        echo -e "${GREEN}✓${NC} $name is running"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $name is not responding"
        ((FAILED++))
        return 1
    fi
}

# Function to check container
check_container() {
    local name=$1
    
    if docker ps --format '{{.Names}}' | grep -q "$name"; then
        echo -e "${GREEN}✓${NC} Container '$name' is running"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} Container '$name' is not running"
        ((FAILED++))
        return 1
    fi
}

echo "🐳 Checking Docker Containers..."
check_container "hikmahsphere-backend"
check_container "hikmahsphere-frontend"
check_container "hikmahsphere-mongodb"
check_container "hikmahsphere-redis"
echo ""

echo "🌐 Checking Web Services..."
check_service "Frontend" "http://localhost:3000"
check_service "Backend API" "http://localhost:5000/health"
echo ""

echo "💾 Checking Databases..."
# Check MongoDB
if docker exec hikmahsphere-mongodb mongosh --eval "db.adminCommand('ping')" &>/dev/null; then
    echo -e "${GREEN}✓${NC} MongoDB is responding"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} MongoDB is not responding"
    ((FAILED++))
fi

# Check Redis
if docker exec hikmahsphere-redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✓${NC} Redis is responding"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Redis is not responding"
    ((FAILED++))
fi
echo ""

# Check disk usage
echo "📊 Resource Usage..."
MONGO_SIZE=$(docker exec hikmahsphere-mongodb du -sh /data/db 2>/dev/null | cut -f1 || echo "N/A")
echo "   MongoDB data: $MONGO_SIZE"
echo ""

# Display results
echo "═══════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! ($PASSED/$((PASSED+FAILED)))${NC}"
    echo ""
    echo "Your HikmahSphere installation is working correctly!"
    echo ""
    echo "Access your application:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:5000/api"
    echo ""
    echo "Default credentials:"
    echo "  Email: admin@hikmah.com"
    echo "  Password: Admin@123456"
else
    echo -e "${RED}❌ Some checks failed! ($PASSED/$((PASSED+FAILED)) passed)${NC}"
    echo ""
    echo "Troubleshooting steps:"
    echo "  1. View logs: docker-compose logs -f"
    echo "  2. Restart:   docker-compose restart"
    echo "  3. Rebuild:   docker-compose up -d --build"
    echo ""
    echo "For more help, see: DEPLOYMENT.md"
fi
echo "═══════════════════════════════"
