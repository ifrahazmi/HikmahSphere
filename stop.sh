#!/bin/bash

# 🕌 HikmahSphere - Stop All Services

echo "🛑 Stopping HikmahSphere services..."

docker-compose down

echo "✅ All services stopped"
echo ""
echo "To remove all data (containers, volumes, networks):"
echo "  docker-compose down -v"
echo ""
echo "To start again:"
echo "  ./start.sh"
