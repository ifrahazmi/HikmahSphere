# 🕌 HikmahSphere - Docker One-Click Deployment

## ✨ Overview

HikmahSphere is now fully configured for **one-click Docker deployment**! This setup allows you to deploy the entire application stack (Frontend, Backend, MongoDB, Redis) with a single command.

---

## 📦 What's Included

### Deployment Files
- ✅ **deploy.sh** - Automated deployment script with health checks
- ✅ **start.sh** - Quick start wrapper script
- ✅ **stop.sh** - Stop all services
- ✅ **verify.sh** - Verify installation health
- ✅ **.env.example** - Environment configuration template
- ✅ **docker-compose.yml** - Main Docker configuration
- ✅ **docker-compose.dev.yml** - Development mode overrides
- ✅ **Dockerfile** - Multi-stage Docker build

### Documentation
- ✅ **DEPLOYMENT.md** - Complete deployment guide
- ✅ **INSTALL.md** - Quick installation guide
- ✅ **README.md** - Updated with quick start
- ✅ **DOCKER-SETUP.md** - This file

---

## 🚀 One-Click Installation

### Prerequisites

Install Docker on your system:

**Windows/Mac:**
- Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)

**Linux:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Installation Command

```bash
# Clone the repository
git clone https://github.com/yourusername/HikmahSphere.git
cd HikmahSphere

# Run one-click installer
./start.sh
```

That's it! The script handles everything automatically.

---

## 🎯 Deployment Options

### Option 1: Super Quick Start (Recommended)
```bash
./start.sh
```
- Runs all checks
- Creates configuration
- Deploys application
- Shows access URLs

### Option 2: Full Control
```bash
./deploy.sh
```
Choose from:
1. **Fresh Installation** - Clean start (removes existing data)
2. **Update Deployment** - Update while keeping data
3. **Development Mode** - With hot reload

### Option 3: Manual Docker Commands
```bash
# Copy environment file
cp .env.example .env

# Edit configuration (optional)
nano .env

# Start services
docker-compose up -d --build
```

---

## 📋 Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `start.sh` | Quick start deployment | `./start.sh` |
| `deploy.sh` | Full deployment with options | `./deploy.sh` |
| `stop.sh` | Stop all services | `./stop.sh` |
| `verify.sh` | Verify installation | `./verify.sh` |

---

## 🏗️ Application Architecture

```
┌─────────────────────────────────────────┐
│         Docker Containers               │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐      ┌──────────┐       │
│  │ Frontend │◄────►│ Backend  │       │
│  │  :3000   │      │  :5000   │       │
│  └──────────┘      └────┬─────┘       │
│                          │             │
│                          ▼             │
│            ┌─────────────────────┐    │
│            │     MongoDB         │    │
│            │      :27017         │    │
│            └─────────────────────┘    │
│                          │             │
│                          ▼             │
│            ┌─────────────────────┐    │
│            │      Redis          │    │
│            │      :6379          │    │
│            └─────────────────────┘    │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🌐 Access Points

After deployment:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Web application |
| **Backend** | http://localhost:5000/api | REST API |
| **Health** | http://localhost:5000/health | Health check |
| **MongoDB** | mongodb://localhost:27017 | Database |
| **Redis** | localhost:6379 | Cache |

### Default Credentials
```
Email: admin@hikmah.com
Password: Admin@123456
```
⚠️ **Change immediately after first login!**

---

## 🛠️ Common Operations

### View Services Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
```

### Stop Services
```bash
./stop.sh
# or
docker-compose stop
```

### Start Stopped Services
```bash
docker-compose start
```

### Update Application
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Verify Installation
```bash
./verify.sh
```

### Complete Removal
```bash
# Remove containers only (keep data)
docker-compose down

# Remove everything (including data)
docker-compose down -v
```

---

## 🔧 Configuration

### Environment Variables

Edit `.env` file to customize:

```env
# Ports
BACKEND_PORT=5000
FRONTEND_PORT=3000

# Database
MONGO_USERNAME=admin
MONGO_PASSWORD=YourPassword

# JWT Secrets
JWT_SECRET=your_secret_key
```

### Port Conflicts

If ports are already in use:

1. Edit `.env`:
```env
BACKEND_PORT=5001
FRONTEND_PORT=3001
```

2. Restart:
```bash
docker-compose down
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Services Won't Start

**Check logs:**
```bash
docker-compose logs backend
docker-compose logs mongodb
```

**Rebuild:**
```bash
docker-compose down
docker-compose up -d --build
```

### Port Already in Use

**Find process:**
```bash
# Linux/Mac
sudo lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

**Change port in `.env`**

### MongoDB Connection Error

**Reset MongoDB:**
```bash
docker-compose stop mongodb
docker volume rm hikmahsphere_mongodb_data
docker-compose up -d mongodb
```

### Out of Memory

**Increase Docker memory:**
- Docker Desktop → Settings → Resources
- Set Memory to 4GB+

### Permission Denied (Linux)

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## 📊 Monitoring

### Resource Usage
```bash
docker stats
```

### Service Health
```bash
# Backend
curl http://localhost:5000/health

# MongoDB
docker exec hikmahsphere-mongodb mongosh --eval "db.serverStatus()"

# Redis
docker exec hikmahsphere-redis redis-cli info
```

---

## 🔒 Security Best Practices

### 1. Change Default Passwords
Edit `.env`:
```env
MONGO_PASSWORD=strong_random_password
JWT_SECRET=another_strong_random_string
```

### 2. Generate Secure Keys
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3. Restrict Access
```env
CORS_ORIGIN=https://yourdomain.com
```

### 4. Enable HTTPS (Production)
- Place SSL certs in `./ssl/`
- Update nginx configuration

---

## 📈 Production Deployment

### Recommended Setup

1. **Use Environment Variables** (not .env file)
2. **Enable HTTPS** with valid certificates
3. **Set up Monitoring** (Prometheus, Grafana)
4. **Configure Backups** (automated daily)
5. **Use Managed Databases** (MongoDB Atlas, Redis Cloud)
6. **Enable Security Headers**
7. **Set up CI/CD** (GitHub Actions)

### Production docker-compose
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 🌍 Cloud Deployment

### Deploy to AWS
```bash
# Install AWS CLI
aws configure
docker-compose push
# Deploy to ECS
```

### Deploy to DigitalOcean
```bash
# Use App Platform
# Connect GitHub repo
# Select docker-compose.yml
```

### Deploy to Azure
```bash
# Use Azure Container Instances
az container create --resource-group myResourceGroup \
  --file docker-compose.yml
```

---

## 📁 Project Structure

```
HikmahSphere/
├── backend/              # Node.js backend
├── frontend/             # React frontend
├── scripts/              # Utility scripts
├── .env.example         # Environment template
├── .env                 # Your configuration
├── docker-compose.yml   # Docker configuration
├── Dockerfile           # Multi-stage build
├── deploy.sh           # Deployment script
├── start.sh            # Quick start
├── stop.sh             # Stop services
├── verify.sh           # Health check
├── DEPLOYMENT.md       # Full guide
├── INSTALL.md          # Installation guide
└── DOCKER-SETUP.md     # This file
```

---

## 🎓 Next Steps

1. ✅ Run `./verify.sh` to check installation
2. ✅ Access http://localhost:3000
3. ✅ Login with default credentials
4. ✅ Change admin password
5. ✅ Configure `.env` for your needs
6. ✅ Read [DEPLOYMENT.md](DEPLOYMENT.md) for advanced options

---

## 📞 Support

- 📖 [Full Documentation](DEPLOYMENT.md)
- 🚀 [Quick Start Guide](INSTALL.md)
- 🐛 [Report Issues](https://github.com/yourusername/HikmahSphere/issues)
- 💬 [Discussions](https://github.com/yourusername/HikmahSphere/discussions)

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

**Made with ❤️ by the HikmahSphere Team**

🕌 *Building the future of Islamic digital experience*
