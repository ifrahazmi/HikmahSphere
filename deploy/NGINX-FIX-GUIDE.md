# 🔧 Nginx Configuration Fix Guide

## 🚨 Problem
Website not accessible after deployment due to Nginx configuration issues.

## ✅ Solution - Run Complete Fix

### Option 1: Run Complete Fix Script (Recommended)

```bash
sudo ./deploy/complete-fix.sh
```

This script will:
1. ✅ Restore safe Nginx main configuration
2. ✅ Copy correct site configuration
3. ✅ Enable the site
4. ✅ Create upload directories
5. ✅ Test configuration
6. ✅ Restart Nginx
7. ✅ Check backend status
8. ✅ Test accessibility

### Option 2: Run Updated Deploy Script

```bash
sudo ./deploy/deploy.sh
```

The deploy script now automatically:
- ✅ Restores main nginx.conf
- ✅ Copies site configuration
- ✅ Enables and tests the site

## 📁 Configuration Files

### Main Nginx Config
**Location:** `/etc/nginx/nginx.conf`

This file should ONLY include sites from `/etc/nginx/sites-enabled/`

### Site Configuration
**Location:** `/etc/nginx/sites-available/hikmahsphere`

Contains your HikmahSphere server configuration.

### Enabled Sites
**Location:** `/etc/nginx/sites-enabled/`

Should contain a symlink to `hikmahsphere`

## 🌐 Access URLs

After fix, access your website at:
- **Frontend:** http://hikmahsphere.site
- **Backend API:** http://hikmahsphere.site/api/health
- **Uploads:** http://hikmahsphere.site/uploads/

## 🔍 Troubleshooting

### 1. Check Nginx Status
```bash
sudo systemctl status nginx
```

### 2. Check Nginx Configuration
```bash
sudo nginx -t
```

### 3. Check Error Logs
```bash
sudo tail -f /var/log/nginx/error.log
```

### 4. Check Backend Status
```bash
pm2 list
pm2 logs hikmah-backend
```

### 5. Check Firewall
```bash
sudo ufw status
sudo ufw allow 80/tcp
```

### 6. Test Locally
```bash
curl http://localhost
curl http://localhost/api/health
```

## 🔒 Enable SSL (Optional)

To enable HTTPS later:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d hikmahsphere.site -d www.hikmahsphere.site

# Choose "Redirect HTTP to HTTPS" when prompted
```

## 📝 What Was Fixed

1. ✅ **Main nginx.conf** - Restored to safe default
2. ✅ **Site config** - Moved to `/etc/nginx/sites-available/`
3. ✅ **Symlink** - Created in `/etc/nginx/sites-enabled/`
4. ✅ **Upload folders** - Created with correct permissions
5. ✅ **Deploy script** - Now restores nginx.conf automatically

## ⚠️ Important Notes

- **DO NOT** edit `/etc/nginx/nginx.conf` directly
- **DO** edit `/etc/nginx/sites-available/hikmahsphere`
- Always test with `sudo nginx -t` before restarting
- Keep backup of working configs

## 📞 Support

If issues persist:
1. Run `sudo ./deploy/complete-fix.sh`
2. Check logs: `sudo tail -f /var/log/nginx/error.log`
3. Check backend: `pm2 logs hikmah-backend`

---

**Last Updated:** 2026-02-25
**Version:** 2.0
