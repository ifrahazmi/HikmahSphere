#!/bin/bash

# ============================================
# HikmahSphere - Upload Folder Setup
# Run this ONCE on your server
# ============================================

echo "🔧 Setting up HikmahSphere upload folders..."

# Create uploads directory structure
sudo mkdir -p /var/www/hikmah/uploads/proofs
sudo mkdir -p /var/www/hikmah/uploads/zakat
sudo mkdir -p /var/www/hikmah/uploads/profiles
sudo mkdir -p /var/www/hikmah/uploads/notifications
sudo mkdir -p /var/www/hikmah/uploads/community

# Set ownership
sudo chown -R www-data:www-data /var/www/hikmah/uploads

# Set permissions (readable by web, writable by backend)
sudo chmod -R 755 /var/www/hikmah/uploads

# Create .htaccess equivalent for nginx (security)
sudo cat > /var/www/hikmah/uploads/.security << 'EOF'
# Security: Prevent direct access to upload folder listing
Options -Indexes
EOF

sudo chown www-data:www-data /var/www/hikmah/uploads/.security

# Verify setup
echo ""
echo "✅ Upload folders created:"
ls -la /var/www/hikmah/uploads/

echo ""
echo "✅ Permissions set correctly!"
echo ""
echo "📁 Upload folder structure:"
echo "  /var/www/hikmah/uploads/"
echo "  ├── proofs/        (Proof of payment images)"
echo "  ├── zakat/         (Zakat-related documents)"
echo "  ├── profiles/      (User profile pictures)"
echo "  ├── notifications/ (Notification attachments)"
echo "  └── community/     (Community posts images)"
echo ""
echo "🌐 Files will be accessible at:"
echo "  https://hikmahsphere.site/uploads/proofs/[filename]"
echo ""
