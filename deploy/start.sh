#!/bin/bash

# Quick start script for Docker deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

echo "🕌 Starting HikmahSphere deployment..."
echo ""

# Check if deploy.sh exists
if [ ! -f "${SCRIPT_DIR}/deploy.sh" ]; then
    echo "❌ Error: deploy.sh not found!"
    echo "Please ensure deploy/deploy.sh exists."
    exit 1
fi

# Make deploy.sh executable
chmod +x "${SCRIPT_DIR}/deploy.sh"

# Run deployment
"${SCRIPT_DIR}/deploy.sh"
