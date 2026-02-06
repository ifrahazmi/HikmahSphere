# 🚀 HikmahSphere - Complete Installation & Setup Guide

Welcome! This guide will help you set up and run the HikmahSphere application locally.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js 18+** - [Download](https://nodejs.org/)
  - Verify: `node --version` (should be v18.0.0 or higher)
- **npm** (comes with Node.js)
  - Verify: `npm --version` (should be 9.0.0 or higher)
- **Git** - [Download](https://git-scm.com/)
  - Verify: `git --version`

### System Requirements
- **Disk Space**: At least 2GB free
- **RAM**: 4GB recommended (for comfortable development)
- **Internet Connection**: Required for initial setup

---

## 🔧 Installation Steps

### Step 1: Verify Prerequisites

Open your terminal and verify all required tools are installed:

```bash
# Check Node.js version
node --version
# Expected output: v18.0.0 or higher

# Check npm version
npm --version
# Expected output: 9.0.0 or higher

# Check Git version
git --version
```

**Troubleshooting**: If any tool is not found, install it from the links provided above.

---

### Step 2: Navigate to Project Directory

```bash
cd /workspaces/HikmahSphere
```

This is the root directory of the HikmahSphere project.

---

### Step 3: Install All Dependencies

Install dependencies for the root project, frontend, and backend in one command:

```bash
npm run install-deps
```

**What this does:**
- Installs root-level dependencies (concurrently, TypeScript)
- Installs frontend dependencies (React, TailwindCSS, React Router, etc.)
- Installs backend dependencies (Express, Mongoose, MongoDB Memory Server, etc.)

**Expected output:**
```
added XXX packages, and audited XXXX packages
in XXXs
```

**Duration**: 3-5 minutes (depending on internet speed)

**Troubleshooting**:
- If installation fails, try: `npm cache clean --force` and retry
- If a single package fails, you can continue - it may not be critical for development

---

### Step 4: Configure Environment (Optional)

The backend is configured to work **out-of-the-box** without any environment setup. It uses:
- **In-memory MongoDB** (via MongoDB Memory Server) - automatically started
- **Default admin account**:
  - Email: `admin@hikmah.com`
  - Password: `copernicus`

#### Optional: Use Remote MongoDB

If you want to use a remote MongoDB database (e.g., MongoDB Atlas), create a `.env` file in the backend directory:

```bash
cd /workspaces/HikmahSphere/backend
nano .env   # or use your preferred editor
```

Add the following variables:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/muslimhub
JWT_SECRET=your-super-secret-key-change-this
PORT=5000
NODE_ENV=development
```

Save and exit.

**Note**: All frontend configuration is handled automatically.

---

## ▶️ Starting the Application

### Option 1: Run frontend and backend together (Recommended)

```bash
npm run dev
```

This command will:
1. Start the **backend** on `http://localhost:5000`
2. Start the **frontend** on `http://localhost:3000`
3. Both will have hot-reload enabled (changes auto-refresh)
4. Both run in the same terminal with color-coded output

**Expected output**:
```
$ concurrently "npm run dev:backend" "npm run dev:frontend"

[0] > cd backend && npm run dev
[1] > cd frontend && npm start
[0] 🚀 MuslimHub API Server running on port 5000
[1] On Your Network: http://localhost:3000
```

### Option 2: Run frontend and backend separately

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```

---

## 🌐 Access the Application

Once the servers are running, open your browser and navigate to:

### Frontend (React Application)
- **URL**: http://localhost:3000
- **What you'll see**: The HikmahSphere home page with navigation menu

### Backend (API Server)
- **Health Check**: http://localhost:5000/health
- **View Users**: http://localhost:5000/api/tools/users
- **API Documentation**: http://localhost:5000/docs (if available)

---

## 🔐 First Login

1. Open http://localhost:3000 in your browser
2. Look for a "Login" or "Sign In" option
3. Use the default admin credentials:
   - **Email**: `admin@hikmah.com`
   - **Password**: `copernicus`
4. You'll now have access to the admin dashboard

---

## ✅ Verification Checklist

Verify everything is working correctly:

- [ ] **npm install completed** without major errors
- [ ] **Backend is running** - Terminal shows "🚀 MuslimHub API Server running on port 5000"
- [ ] **Frontend is running** - Terminal shows "On Your Network: http://localhost:3000"
- [ ] **Backend health check** - Visit http://localhost:5000/health, see JSON response
- [ ] **Frontend loads** - Visit http://localhost:3000, see the application
- [ ] **No critical errors** in terminal output
- [ ] **Admin user exists** - http://localhost:5000/api/tools/users shows admin@hikmah.com

If all items are checked, you're ready to use HikmahSphere!

---

## 🛠️ Available Commands

| Command | Description | Location |
|---------|-------------|----------|
| `npm run dev` | Start frontend + backend | Root directory |
| `npm run dev:frontend` | Start React dev server | Root directory |
| `npm run dev:backend` | Start Express dev server | Root directory |
| `npm run build` | Build for production | Root directory |
| `npm run build:frontend` | Build React only | Root directory |
| `npm run build:backend` | Build Node.js only | Root directory |
| `npm run start` | Start production backend | Root directory |
| `npm run test` | Run all tests | Root directory |
| `npm run test:frontend` | Test frontend only | Root directory |
| `npm run test:backend` | Test backend only | Root directory |

---

## 🐛 Troubleshooting

### Backend fails to start

**Error**: "Cannot find module 'mongoose'"
- **Solution**: Run `npm run install-deps` again from root directory

**Error**: "Port 5000 is already in use"
- **Solution**:
  - Option A: Kill the process using port 5000
  - Option B: Change port in `backend/package.json` dev script: `PORT=5001 nodemon...`

**Error**: "MongoDB connection failed"
- **Solution**: Backend should auto-use in-memory MongoDB. If error persists:
  - Check Node.js version: `node --version` (needs v18+)
  - Check terminal for MongoMemoryServer errors
  - Ensure you have 2GB+ free disk space

### Frontend fails to start

**Error**: "Port 3000 is already in use"
- **Solution**:
  - Option A: Kill the process using port 3000
  - Option B: Set PORT=3001 before running: `PORT=3001 npm run dev:frontend`

**Error**: "Cannot find module 'react'"
- **Solution**: Run `cd frontend && npm install`

**Error**: React app shows blank page
- **Solution**:
  - Open browser DevTools (F12)
  - Check Console tab for errors
  - Clear browser cache and refresh
  - Ensure backend is running on http://localhost:5000

### General issues

**Error**: "EACCES: permission denied"
- **Solution**:
  - On Mac/Linux: Prefix commands with `sudo` (not recommended)
  - Or fix npm permissions: `npm config set prefix ~/.npm-global`

**Error**: TypeScript compilation errors
- **Solution**: This shouldn't happen, but if it does:
  - Delete `node_modules` and `package-lock.json`
  - Run `npm run install-deps` again
  - Verify Node.js version is 18+

---

## 📚 Project Structure

```
HikmahSphere/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   ├── pages/              # Page components
│   │   ├── hooks/              # Custom React hooks
│   │   └── App.tsx             # Main app component
│   └── package.json
│
├── backend/                     # Node.js/Express API
│   ├── src/
│   │   ├── models/             # MongoDB models
│   │   ├── routes/             # API route handlers
│   │   ├── middleware/         # Express middleware
│   │   └── index.ts            # App entry point
│   └── package.json
│
└── package.json                # Root configuration
```

---

## 🎯 Features Available

Once running, you can access:

✅ **Prayer Times** - Accurate prayer time calculations by location
✅ **Quran Reader** - Complete Quran with audio
✅ **Zakat Calculator** - Islamic charitable giving calculator
✅ **Community Forum** - Connect with other users
✅ **Qibla Finder** - Find direction to Mecca
✅ **User Authentication** - Secure login system
✅ **Admin Dashboard** - Manage users and content

---

## 📖 Additional Resources

- **Main README**: `/workspaces/HikmahSphere/README.md`
- **Quick Start**: `/workspaces/HikmahSphere/QUICK_START.md`
- **Contributing Guide**: `/workspaces/HikmahSphere/CONTRIBUTING.md`

---

## 🤝 Need Help?

If you encounter issues:

1. Check this troubleshooting section
2. Check the **Logs** - Look at terminal output for detailed error messages
3. **GitHub Issues** - Visit https://github.com/yani2298/MuslimHub/issues
4. **Documentation** - Visit https://github.com/yani2298/MuslimHub/wiki

---

**Happy coding! 🌟**
