# 🚀 HikmahSphere - Docker Deployment Guide

This guide will help you deploy HikmahSphere using Docker in just one click!

## 📋 Prerequisites

Before deploying, ensure you have:

1. **Docker Engine** (v20.10+)
   - Download: https://docs.docker.com/get-docker/
   
2. **Docker Compose** (v2.0+)
   - Included with Docker Desktop
   - Linux: https://docs.docker.com/compose/install/

3. **System Requirements**
   - RAM: Minimum 2GB, Recommended 4GB+
   - Disk Space: Minimum 5GB free
   - OS: Linux, macOS, or Windows with WSL2

## 🎯 One-Click Deployment

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/HikmahSphere.git
cd HikmahSphere
```

### Step 2: Run the Deployment Script

**Linux/macOS:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows (PowerShell):**
```powershell
bash deploy.sh
```

### Step 3: Follow the Prompts

The script will:
1. ✅ Check Docker installation
2. ✅ Create `.env` configuration file
3. ✅ Ask for deployment type
4. ✅ Build and start all services
5. ✅ Verify service health
6. ✅ Display access URLs

## 🎨 Deployment Options

### Option 1: Fresh Installation
- **Use case**: First-time installation
- **Action**: Removes all existing data and starts fresh
- **Warning**: ⚠️ This will delete existing database data!

```bash
./deploy.sh
# Select option: 1
```

### Option 2: Update Deployment
- **Use case**: Updating existing installation
- **Action**: Rebuilds containers but keeps data
- **Safe**: ✅ Preserves your database

```bash
./deploy.sh
# Select option: 2
```

### Option 3: Development Mode
- **Use case**: Local development with hot reload
- **Action**: Starts services in development mode
- **Features**: Live code reloading

```bash
./deploy.sh
# Select option: 3
```

## 🔧 Manual Deployment (Advanced)

If you prefer manual control:

### 1. Create Environment File

```bash
cp .env.example .env
nano .env  # Edit with your configuration
```

### 2. Start Services

**Fresh installation:**
```bash
docker-compose down -v
docker-compose up -d --build
```

**Update existing:**
```bash
docker-compose down
docker-compose up -d --build
```

**Development mode:**
```bash
docker-compose up -d
```

## 📊 Service Architecture

The deployment includes:

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 3000 | React application |
| **Backend** | 5000 | Node.js API server |
| **MongoDB** | 27017 | Database |
| **Redis** | 6379 | Cache & sessions |
| **Nginx** | 80/443 | Reverse proxy (optional) |

## 🌐 Accessing Your Application

After deployment:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **API Health**: http://localhost:5000/health

### Default Admin Credentials

```
Email: admin@hikmah.com
Password: Admin@123456
```

⚠️ **Important**: Change these credentials immediately after first login!

## 🛠️ Managing Your Deployment

### View Logs

**All services:**
```bash
docker-compose logs -f
```

**Specific service:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Check Service Status

```bash
docker-compose ps
```

### Restart Services

**All services:**
```bash
docker-compose restart
```

**Specific service:**
```bash
docker-compose restart backend
```

### Stop Services

```bash
docker-compose stop
```

### Start Stopped Services

```bash
docker-compose start
```

### Complete Removal

**Remove containers but keep data:**
```bash
docker-compose down
```

**Remove everything including data:**
```bash
docker-compose down -v
```

## 🔐 Security Configuration

### 1. Update Environment Variables

Edit `.env` file and change:

- `JWT_SECRET` - Use a strong random string
- `REFRESH_TOKEN_SECRET` - Use a different random string
- `MONGO_PASSWORD` - Set a strong password
- `ADMIN_PASSWORD` - Set a secure admin password

### 2. Generate Secure Secrets

**Linux/macOS:**
```bash
openssl rand -base64 32
```

**Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 3. Enable HTTPS (Production)

Place SSL certificates in `./ssl/` directory:
- `cert.pem` - Certificate file
- `key.pem` - Private key file

Uncomment Nginx service in `docker-compose.yml`.

## 🐛 Troubleshooting

### Port Already in Use

**Check what's using the port:**
```bash
# Linux/macOS
sudo lsof -i :3000
sudo lsof -i :5000

# Windows
netstat -ano | findstr :3000
```

**Change ports in `.env`:**
```env
BACKEND_PORT=5001
FRONTEND_PORT=3001
```

### MongoDB Connection Issues

**Reset MongoDB:**
```bash
docker-compose stop mongodb
docker volume rm hikmahsphere_mongodb_data
docker-compose up -d mongodb
```

### Container Won't Start

**View detailed logs:**
```bash
docker-compose logs container-name
```

**Rebuild specific service:**
```bash
docker-compose up -d --build service-name
```

### Out of Memory

**Increase Docker memory:**
- Docker Desktop → Settings → Resources → Memory
- Recommended: 4GB minimum

### Permission Issues (Linux)

**Fix permissions:**
```bash
sudo chown -R $USER:$USER .
```

## 🔄 Backup & Restore

### Backup Database

```bash
docker-compose exec mongodb mongodump --out=/data/backup
docker cp hikmahsphere_mongodb:/data/backup ./backup
```

### Restore Database

```bash
docker cp ./backup hikmahsphere_mongodb:/data/restore
docker-compose exec mongodb mongorestore /data/restore
```

## 📈 Monitoring

### Resource Usage

```bash
docker stats
```

### Service Health

```bash
# Backend health
curl http://localhost:5000/health

# MongoDB status
docker-compose exec mongodb mongosh --eval "db.serverStatus()"

# Redis status
docker-compose exec redis redis-cli info
```

## 🚀 Production Deployment

For production environments:

1. **Use environment variables for secrets** (never commit `.env`)
2. **Enable HTTPS** with valid SSL certificates
3. **Set up monitoring** (Prometheus, Grafana)
4. **Configure backups** (automated daily backups)
5. **Use managed databases** (MongoDB Atlas, Redis Cloud)
6. **Set up CI/CD** (GitHub Actions, GitLab CI)
7. **Enable rate limiting** and security headers

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 1G
  
  frontend:
    restart: always
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

Deploy:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 🌍 Cloud Deployment

### Deploy to AWS

Use AWS ECS with the provided docker-compose.yml

### Deploy to Azure

Use Azure Container Instances or AKS

### Deploy to Google Cloud

Use Google Cloud Run or GKE

### Deploy to DigitalOcean

Use DigitalOcean App Platform with Docker

## 📞 Support

- **Issues**: https://github.com/yourusername/HikmahSphere/issues
- **Discussions**: https://github.com/yourusername/HikmahSphere/discussions
- **Email**: support@hikmahsphere.com

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ by the HikmahSphere Team
