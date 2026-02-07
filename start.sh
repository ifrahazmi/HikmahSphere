#!/bin/bash

# Quick start script for Docker deployment

echo "🕌 Starting HikmahSphere deployment..."
echo ""

# Check if deploy.sh exists
if [ ! -f "./deploy.sh" ]; then
    echo "❌ Error: deploy.sh not found!"
    echo "Please ensure you're in the HikmahSphere root directory."
    exit 1
fi

# Make deploy.sh executable
chmod +x ./deploy.sh

# Run deployment
./deploy.sh
