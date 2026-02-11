#!/bin/bash

# 🕌 HikmahSphere Docker Restart Script
# This script helps you restart Docker services easily

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🕌 HikmahSphere Docker Restart Script${NC}"
echo ""

# Parse command line arguments
REBUILD=false
SERVICE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --rebuild|-r)
      REBUILD=true
      shift
      ;;
    --service|-s)
      SERVICE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ./restart-docker.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --rebuild, -r          Rebuild containers before restarting"
      echo "  --service SERVICE, -s  Restart only specific service (backend, frontend, mongodb, redis)"
      echo "  --help, -h             Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./restart-docker.sh                    # Restart all services"
      echo "  ./restart-docker.sh --rebuild          # Rebuild and restart all services"
      echo "  ./restart-docker.sh -s backend         # Restart only backend service"
      echo "  ./restart-docker.sh -r -s backend      # Rebuild and restart only backend"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Stop services
if [ -n "$SERVICE" ]; then
  echo -e "${YELLOW}⏹️  Stopping $SERVICE service...${NC}"
  docker-compose stop "$SERVICE"
else
  echo -e "${YELLOW}⏹️  Stopping all services...${NC}"
  docker-compose down
fi

echo ""

# Rebuild if requested
if [ "$REBUILD" = true ]; then
  if [ -n "$SERVICE" ]; then
    echo -e "${BLUE}🔨 Rebuilding $SERVICE service...${NC}"
    docker-compose build "$SERVICE"
  else
    echo -e "${BLUE}🔨 Rebuilding all services...${NC}"
    docker-compose build
  fi
  echo ""
fi

# Start services
if [ -n "$SERVICE" ]; then
  echo -e "${GREEN}🚀 Starting $SERVICE service...${NC}"
  docker-compose up -d "$SERVICE"
else
  echo -e "${GREEN}🚀 Starting all services...${NC}"
  docker-compose up -d
fi

echo ""
echo -e "${GREEN}✅ Services restarted successfully!${NC}"
echo ""

# Show status
echo -e "${BLUE}📊 Container Status:${NC}"
docker-compose ps

echo ""
echo -e "${YELLOW}💡 Tip: Run 'docker-compose logs -f' to view logs${NC}"
if [ -n "$SERVICE" ]; then
  echo -e "${YELLOW}    Or 'docker-compose logs -f $SERVICE' for specific service${NC}"
fi
