# 🚀 Quick Installation Guide

## One-Click Installation Steps

### Step 1: Install Docker

**Windows:**
1. Download [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Run the installer
3. Restart your computer
4. Verify: Open PowerShell and run `docker --version`

**macOS:**
1. Download [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
2. Drag Docker to Applications folder
3. Open Docker from Applications
4. Verify: Open Terminal and run `docker --version`

**Linux (Ubuntu/Debian):**
```bash
# Update package index
sudo apt-get update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
```

### Step 2: Clone HikmahSphere

**Windows (PowerShell):**
```powershell
cd C:\Projects
git clone https://github.com/yourusername/HikmahSphere.git
cd HikmahSphere
```

**macOS/Linux:**
```bash
cd ~/Projects
git clone https://github.com/yourusername/HikmahSphere.git
cd HikmahSphere
```

### Step 3: Run One-Click Installer

**Windows:**
```powershell
bash start.sh
```

**macOS/Linux:**
```bash
./start.sh
```

### Step 4: Choose Deployment Type

When prompted, select:
- **Option 1**: Fresh installation (first time)
- **Option 2**: Update installation (already installed)
- **Option 3**: Development mode (for developers)

### Step 5: Wait for Setup

The script will:
1. Check Docker installation ✓
2. Create configuration files ✓
3. Download Docker images ✓
4. Build application ✓
5. Start all services ✓
6. Run health checks ✓

**Time:** 5-10 minutes (depending on internet speed)

### Step 6: Access Application

Open your browser:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000/api

Login with:
- Email: `admin@hikmah.com`
- Password: `Admin@123456`

## 🎯 What Gets Installed?

| Component | Description | Port |
|-----------|-------------|------|
| Frontend | React web application | 3000 |
| Backend | Node.js API server | 5000 |
| MongoDB | Database | 27017 |
| Redis | Cache server | 6379 |

## 🛠️ Common Commands

**View running services:**
```bash
docker-compose ps
```

**View logs:**
```bash
docker-compose logs -f
```

**Stop services:**
```bash
./stop.sh
# or
docker-compose stop
```

**Start services:**
```bash
docker-compose start
```

**Restart services:**
```bash
docker-compose restart
```

**Remove everything:**
```bash
docker-compose down -v
```

## 🐛 Troubleshooting

### "Port already in use" Error

**Solution:**
```bash
# Find what's using the port
netstat -ano | findstr :3000    # Windows
lsof -i :3000                   # macOS/Linux

# Change port in .env file
nano .env
# Change FRONTEND_PORT=3000 to FRONTEND_PORT=3001
```

### "Docker daemon not running" Error

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start
3. Try again

### "Permission denied" Error (Linux)

**Solution:**
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Services Won't Start

**Solution:**
```bash
# View detailed errors
docker-compose logs backend
docker-compose logs frontend

# Rebuild
docker-compose down
docker-compose up -d --build
```

## 🔧 Customization

### Change Ports

Edit `.env` file:
```env
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

### Change Database Password

Edit `.env` file:
```env
MONGO_PASSWORD=YourSecurePassword
```

Then restart:
```bash
docker-compose down -v
docker-compose up -d
```

### Enable HTTPS

1. Place SSL certificates in `./ssl/` folder:
   - `cert.pem`
   - `key.pem`

2. Uncomment nginx service in `docker-compose.yml`

3. Restart:
```bash
docker-compose down
docker-compose up -d
```

## 📊 System Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 2GB
- Disk: 5GB free space
- OS: Windows 10+, macOS 10.14+, Linux

**Recommended:**
- CPU: 4 cores
- RAM: 4GB
- Disk: 10GB free space
- SSD storage

## 🎓 Next Steps

1. ✅ Change admin password
2. ✅ Configure environment variables
3. ✅ Set up backups
4. ✅ Enable monitoring
5. ✅ Configure email (optional)

## 📞 Need Help?

- 📖 [Full Documentation](DEPLOYMENT.md)
- 🐛 [Report Issues](https://github.com/yourusername/HikmahSphere/issues)
- 💬 [Community Discussions](https://github.com/yourusername/HikmahSphere/discussions)

---

**Made with ❤️ by the HikmahSphere Team**
