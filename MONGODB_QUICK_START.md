# 🚀 Quick MongoDB Setup Summary

## ⚡ Fastest Installation Method (Choose ONE approach)

### Platform-Specific Quick Commands

**Windows (PowerShell as Administrator):**
```powershell
# Install using Chocolatey (if you have it)
choco install mongodb-community

# Or download: https://www.mongodb.com/try/download/community
# Run the installer and follow the prompts
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

**Docker (All Platforms):**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

---

## 2️⃣ Create Backend Configuration

Create `/workspaces/HikmahSphere/backend/.env`:

```
MONGODB_URI=mongodb://localhost:27017/muslimhub
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=development
```

---

## 3️⃣ Restart Backend

```bash
# Kill existing backend process first (if running)
pkill -f "npm run dev"

# Start fresh
cd /workspaces/HikmahSphere
npm run dev

# Or just backend:
npm run dev:backend
```

---

## ✅ Verify Connection

```bash
# Should see in terminal:
# 🚀 MongoDB connected successfully!
# ✅ Admin user created successfully: admin@hikmah.com

# Test the API:
curl http://localhost:5000/health
curl http://localhost:5000/api/tools/users
```

---

## 📍 Your System Info

Based on your environment, here's the easiest path:

**System**: Linux (based on your environment)

**Recommended for you**:
1. **Option A (Recommended)**: Use Docker - `docker run -d -p 27017:27017 --name mongodb mongo:latest`
2. **Option B**: Follow Ubuntu steps in the full guide
3. **Option C**: Use the quick Linux commands above

---

## 📚 Full Detailed Guide

See `/workspaces/HikmahSphere/MONGODB_SETUP.md` for:
- Complete installation instructions for all OS
- MongoDB verification steps
- Troubleshooting guide
- MongoDB commands reference
- Docker setup with authentication
