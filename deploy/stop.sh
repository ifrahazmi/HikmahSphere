#!/bin/bash

# 🕌 HikmahSphere - Stop All Services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "🛑 Stopping HikmahSphere services..."

docker-compose down

echo "✅ All services stopped"
echo ""
echo "To remove all data (containers, volumes, networks):"
echo "  docker-compose down -v"
echo ""
echo "To start again:"
echo "  ./deploy/start.sh"
