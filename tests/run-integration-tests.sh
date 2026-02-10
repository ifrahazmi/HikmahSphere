#!/bin/bash

# Zakat Management System - Integration Test Runner
# Phase 4: Comprehensive End-to-End Testing

echo "================================================"
echo "🚀 Zakat Management System - Integration Tests"
echo "================================================"
echo ""

# Configuration
API_URL="${API_URL:-http://localhost:5000/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@hikmahsphere.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo "📋 Test Configuration:"
echo "  API URL: $API_URL"
echo "  Admin Email: $ADMIN_EMAIL"
echo ""

# Check if API is running
echo "🔍 Checking API connectivity..."
if ! timeout 5 bash -c "echo >/dev/tcp/localhost/5000" 2>/dev/null; then
  echo "❌ API server is not running on port 5000"
  echo "   Please start the backend: cd backend && npm run dev"
  exit 1
fi

echo "✅ API server is responsive"
echo ""

# Run tests
echo "🧪 Running integration tests..."
echo ""

# Create test runner script
cat > /tmp/run-tests.ts << 'EOF'
import IntegrationTestSuite from './tests/integration.test';

const config = {
  apiUrl: process.env.API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  adminEmail: process.env.ADMIN_EMAIL || 'admin@hikmahsphere.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
};

const suite = new IntegrationTestSuite(config);
suite.runAllTests().catch(console.error);
EOF

cd "$(dirname "$0")/backend" || exit 1

# Run using ts-node or tsx
if command -v tsx &> /dev/null; then
  tsx --eval "
    import IntegrationTestSuite from './tests/integration.test.js';
    const config = {
      apiUrl: '$API_URL',
      timeout: 30000,
      adminEmail: '$ADMIN_EMAIL',
      adminPassword: '$ADMIN_PASSWORD',
    };
    const suite = new IntegrationTestSuite(config);
    suite.runAllTests();
  " 2>&1
elif command -v ts-node &> /dev/null; then
  ts-node --eval "
    import IntegrationTestSuite from './tests/integration.test.js';
    const config = {
      apiUrl: '$API_URL',
      timeout: 30000,
      adminEmail: '$ADMIN_EMAIL',
      adminPassword: '$ADMIN_PASSWORD',
    };
    const suite = new IntegrationTestSuite(config);
    suite.runAllTests();
  " 2>&1
else
  echo "❌ Neither tsx nor ts-node is installed"
  echo "   Please install: npm install -g tsx"
  exit 1
fi

echo ""
echo "✅ Test run completed"
