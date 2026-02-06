# 📦 MongoDB Installation & Connection Guide

## Overview

MongoDB is a NoSQL database that HikmahSphere uses to store user data, prayer times, Quran data, Zakat calculations, and community forum content.

---

## Installation by Operating System

### 🔧 Option 1: Windows

#### Step 1: Download MongoDB Community Edition
1. Visit: https://www.mongodb.com/try/download/community
2. Select **Windows** platform
3. Select **msi** package format
4. Click **Download**

#### Step 2: Run the Installer
1. Double-click the downloaded `.msi` file
2. Click **Next** through the setup wizard
3. Accept the license agreement
4. Choose **Complete** installation
5. On "Service Configuration":
   - ✅ Keep "Install MongoDB as a Service" checked
   - Choose "Run service as Network Service user"
6. Click **Install**

#### Step 3: Verify Installation
Open **Command Prompt** and run:
```bash
mongod --version
```

You should see the MongoDB version (e.g., `db version v7.0.0`)

#### Step 4: Start MongoDB
MongoDB should start automatically as a service. To verify:
```bash
# Check if MongoDB is running
netstat -an | findstr 27017
```

If MongoDB is running, you'll see output related to port 27017.

---

### 🔧 Option 2: macOS

#### Step 1: Install Homebrew (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Step 2: Install MongoDB
```bash
# Tap the MongoDB Homebrew repository
brew tap mongodb/brew

# Install MongoDB Community
brew install mongodb-community

# Verify installation
mongod --version
```

#### Step 3: Start MongoDB
```bash
# Start MongoDB as a service
brew services start mongodb-community

# Verify it's running
brew services list
```

Look for `mongodb-community` with ✓ status

#### Step 4: Verify with MongoDB Client
```bash
mongosh
```

At the `>` prompt, type:
```javascript
> db.version()
```

You should see the version number. Type `exit` to quit.

---

### 🔧 Option 3: Linux (Ubuntu/Debian)

#### Step 1: Import MongoDB Repository Key
```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
```

#### Step 2: Add MongoDB Repository
```bash
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -sc)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
```

#### Step 3: Install MongoDB
```bash
# Update package list
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Enable auto-start on boot
sudo systemctl enable mongod

# Verify it's running
sudo systemctl status mongod
```

#### Step 4: Verify Connection
```bash
mongosh
```

At the `>` prompt, type:
```javascript
> db.version()
```

Type `exit` to quit.

---

### 🔧 Option 4: Docker (All Platforms)

If you have Docker installed, this is the quickest way:

#### Step 1: Pull MongoDB Image
```bash
docker pull mongo:latest
```

#### Step 2: Start MongoDB Container
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:latest
```

#### Step 3: Verify It's Running
```bash
docker ps | grep mongodb
```

---

## Verify MongoDB is Running

### Quick Connection Test

Open a terminal and run:

```bash
# Connect to MongoDB locally
mongosh
```

Expected output:
```
Current Mongosh Log ID: ...
Connecting to: mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh ...
MongoServerError: connect ECONNREFUSED 127.0.0.1:27017
```

If you see connection successful, MongoDB is running! If you see `ECONNREFUSED`, check the troubleshooting section below.

---

## Configure HikmahSphere Backend to Use MongoDB

### Step 1: Create Environment File

Create a file called `.env` in the `/backend` directory:

```bash
cd /workspaces/HikmahSphere/backend
nano .env
```

Or use your favorite editor (VS Code, etc.)

### Step 2: Add MongoDB Configuration

Copy and paste the following into the `.env` file:

```
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/muslimhub

# JWT Configuration (Authentication)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Step 3: For Docker MongoDB Users

If you created MongoDB using Docker with authentication, use this instead:

```
MONGODB_URI=mongodb://admin:password@localhost:27017/muslimhub?authSource=admin

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

PORT=5000
NODE_ENV=development
```

### Step 4: Save the File

- **nano editor**: Press `Ctrl + X`, then `Y`, then `Enter`
- **VS Code**: Use `Ctrl + S` to save

---

## Restart Backend to Reconnect

### Step 1: Kill the Current Backend Process

If the backend is still running from earlier, stop it:

```bash
# If running without background - press Ctrl + C in that terminal
# If running in background, find and kill the process:
pkill -f "npm run dev:backend"
```

### Step 2: Start Backend Again

```bash
cd /workspaces/HikmahSphere
npm run dev
```

Or start only the backend:

```bash
npm run dev:backend
```

### Step 3: Verify Connection

You should see in the terminal:

```
🚀 MongoDB connected successfully!
✅ Admin user created successfully: admin@hikmah.com (Super Admin)
🚀 MuslimHub API Server running on port 5000
```

If you see these messages, MongoDB is connected!

---

## Verify Data is Being Stored

### Check MongoDB Content

```bash
# Connect to MongoDB
mongosh

# Select the database
> use muslimhub

# View all collections
> show collections

# Check if admin user exists
> db.users.find().pretty()
```

You should see the admin user:
```javascript
{
  _id: ObjectId(...),
  username: 'admin',
  email: 'admin@hikmah.com',
  isAdmin: true,
  role: 'superadmin',
  ...
}
```

### Or Use Backend API

```bash
# Check if backend is running and MongoDB is connected
curl http://localhost:5000/health

# View all users
curl http://localhost:5000/api/tools/users
```

Expected output for users:
```json
[
  {
    "_id": "...",
    "username": "admin",
    "email": "admin@hikmah.com",
    "isAdmin": true,
    "role": "superadmin",
    "createdAt": "2024-..."
  }
]
```

---

## 🚀 Access the Application

Once MongoDB is running and backend is connected:

1. **Frontend**: http://localhost:3000
2. **Backend API**: http://localhost:5000
3. **Health Check**: http://localhost:5000/health

Login with:
- **Email**: `admin@hikmah.com`
- **Password**: `copernicus`

---

## ⚠️ Troubleshooting

### Issue: "ECONNREFUSED" when connecting to MongoDB

**Cause**: MongoDB is not running

**Solutions**:

**Windows**:
```bash
# Check if MongoDB is running
netstat -an | findstr 27017

# If not running, restart the service
net start MongoDB
```

**macOS**:
```bash
# Check status
brew services list

# If not running
brew services start mongodb-community
```

**Linux**:
```bash
# Check status
sudo systemctl status mongod

# If not running
sudo systemctl start mongod
```

**Docker**:
```bash
# Check if container is running
docker ps | grep mongodb

# If not, start it
docker start mongodb
```

---

### Issue: "Port 27017 already in use"

**Cause**: MongoDB is already running on this port

**Solution**: Either use the existing MongoDB, or change the port in `.env`:
```
MONGODB_URI=mongodb://localhost:27018/muslimhub
```

Then start MongoDB on that port:
```bash
# macOS
brew services stop mongodb-community
mongod --port 27018 &

# Linux
sudo systemctl stop mongod
mongod --port 27018 &
```

---

### Issue: "Authentication failed" (if using credentials)

**Cause**: Wrong username/password in `.env`

**Solution**: Verify your MongoDB credentials and update `.env`:
```
MONGODB_URI=mongodb://username:password@localhost:27017/muslimhub?authSource=admin
```

---

### Issue: Backend still shows "using in-memory MongoDB"

**Cause**: The `.env` file is not being read

**Solution**:
1. Verify `.env` is in `/backend/` directory (not root)
2. Make sure it has `MONGODB_URI=mongodb://localhost:27017/muslimhub`
3. Stop backend and restart: `npm run dev:backend`

---

## 📊 MongoDB Useful Commands

```bash
# Connect to MongoDB
mongosh

# At the MongoDB prompt (>):

# Switch to database
> use muslimhub

# Show all collections
> show collections

# Count users
> db.users.countDocuments()

# Find all users
> db.users.find()

# Find specific user
> db.users.findOne({ email: 'admin@hikmah.com' })

# Delete all data in a collection
> db.users.deleteMany({})

# Exit MongoDB
> exit
```

---

## ✅ Complete Checklist

- [ ] MongoDB installed and running
- [ ] `.env` file created in `/backend` directory
- [ ] `MONGODB_URI` set correctly in `.env`
- [ ] Backend restarted and shows "🚀 MongoDB connected successfully!"
- [ ] Can visit http://localhost:3000 (frontend)
- [ ] Can visit http://localhost:5000/health (backend)
- [ ] Admin user exists in MongoDB
- [ ] Can login with admin@hikmah.com / copernicus

If all items are checked, you're ready to use HikmahSphere!

---

## 🆘 Still Having Issues?

Check these in order:

1. **Is MongoDB running?**
   - Run `mongosh` - if it fails, MongoDB is not running
   - Start MongoDB according to your OS

2. **Is the `.env` file correct?**
   - Check file path: `/workspaces/HikmahSphere/backend/.env`
   - Check contents: Should have `MONGODB_URI=mongodb://localhost:27017/muslimhub`

3. **Did you restart the backend?**
   - Kill the backend process
   - Run `npm run dev:backend` or `npm run dev` again

4. **Check the backend logs**
   - Look for "MongoDB connected" message
   - Look for "Admin user created" message

5. **Verify the connection manually**
   - Run: `mongosh`
   - Run: `> use muslimhub`
   - Run: `> db.users.find()`
   - If you see data, MongoDB is connected!

