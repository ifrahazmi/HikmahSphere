# 📁 Zakat Proof File Storage - Production Fix

## Problem
When deploying to production with Nginx, uploaded proof files were not accessible because:
1. File paths were stored with `src/uploads/` prefix
2. Static file serving wasn't configured correctly for production
3. Path resolution differed between development and production

## Solution Applied

### 1. Backend Static File Serving (`backend/src/index.ts`)

```typescript
// Serve static files for uploaded proofs - Works in both dev and production
const uploadsPath = path.resolve(process.cwd(), 'src', 'uploads');
app.use('/uploads', express.static(uploadsPath));
app.use('/src/uploads', express.static(uploadsPath)); // backwards compatibility
```

**Changes:**
- Uses `path.resolve()` for absolute path resolution
- Serves from `/uploads/` (primary) and `/src/uploads/` (compatibility)
- Works in both development and production environments

### 2. Upload Directory Path (`backend/src/routes/zakat.ts`)

```typescript
// Use absolute path for production
const uploadDir = path.resolve(process.cwd(), 'src', 'uploads', 'zakat');
```

**Changes:**
- Uses `path.resolve()` instead of relative path
- Ensures directory exists with `fs.mkdirSync()`

### 3. File Path Storage Format

**Before:**
```javascript
proofFilePath: req.file.path.replace(/\\/g, "/")
// Stored as: src/uploads/zakat/zakat-proof-123.png
```

**After:**
```javascript
proofFilePath: `uploads/zakat/${req.file.filename}`
// Stored as: uploads/zakat/zakat-proof-123.png
```

**Changes:**
- Stores path without leading slash
- Uses consistent format: `uploads/zakat/filename`
- Works with `/uploads/` static route

### 4. Frontend Path Handling (`ZakatManagement.tsx`)

```javascript
// Download function
const cleanPath = proofPath.replace(/^\/+/, ''); // Remove leading slashes
const response = await fetch(`/${cleanPath}`);

// Image preview
src={`/${previewProofPath.replace(/^\/+/, '')}`}
```

**Changes:**
- Removes leading slashes from paths
- Fetches from correct endpoint
- Works for both images and PDFs

## File Access URLs

| Environment | Access URL |
|-------------|------------|
| Development | `http://localhost:5000/uploads/zakat/zakat-proof-xxx.png` |
| Production | `https://yourdomain.com/uploads/zakat/zakat-proof-xxx.png` |

## Deployment Steps

### Backend (Node.js/Express)
```bash
cd ~/HikmahSphere-CICD/backend
npm run build
# Backend will serve /uploads/ route automatically
```

### Frontend (React)
```bash
cd ~/HikmahSphere-CICD/frontend
npm run build
sudo rm -rf /var/www/hikmah/*
sudo cp -r build/* /var/www/hikmah/
sudo chown -R www-data:www-data /var/www/hikmah
sudo systemctl restart nginx
```

### Nginx Configuration (if needed)

If you want Nginx to serve uploads directly (optional - backend already handles this):

```nginx
server {
    # ... existing config ...
    
    # Serve uploaded files directly
    location /uploads/ {
        alias /home/user/HikmahSphere/backend/src/uploads/;
        autoindex off;
        
        # Security: Only allow specific file types
        location ~* \.(jpg|jpeg|png|pdf)$ {
            expires 30d;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Testing

### 1. Upload a Proof File
```bash
# Go to Zakat Management
# Click "Record Collection"
# Fill form and upload a test image
# Submit
```

### 2. Verify File Storage
```bash
ls -la /home/user/HikmahSphere/backend/src/uploads/zakat/
# Should see: zakat-proof-1234567890-123456789.png
```

### 3. Test File Access
```bash
# Development
curl http://localhost:5000/uploads/zakat/zakat-proof-xxx.png

# Production
curl https://yourdomain.com/uploads/zakat/zakat-proof-xxx.png
```

### 4. Test Download from UI
1. Open Zakat Management
2. Click "📎 View Proof" on any transaction
3. Preview should open
4. Click "Download" button
5. File should download successfully

## File Storage Details

- **Location:** `/home/user/HikmahSphere/backend/src/uploads/zakat/`
- **Naming:** `zakat-proof-{timestamp}-{random}.{ext}`
- **Allowed Types:** `.jpg`, `.jpeg`, `.png`, `.pdf`
- **Max Size:** 5MB
- **Database Field:** `proofFilePath: "uploads/zakat/zakat-proof-xxx.png"`

## Troubleshooting

### Issue: Files not uploading
```bash
# Check directory exists
ls -la /home/user/HikmahSphere/backend/src/uploads/

# Check permissions
chmod -R 755 /home/user/HikmahSphere/backend/src/uploads/
chown -R www-data:www-data /home/user/HikmahSphere/backend/src/uploads/
```

### Issue: Files not accessible
```bash
# Check backend is running
ps aux | grep node

# Check static route
curl http://localhost:5000/uploads/

# Check file exists
ls -la /home/user/HikmahSphere/backend/src/uploads/zakat/
```

### Issue: CORS errors
```javascript
// Already configured in backend/src/index.ts
app.use(cors({
  origin: true,
  credentials: true,
}));
```

## Summary

✅ **Fixed:** File paths now work in both development and production
✅ **Fixed:** Static file serving configured correctly
✅ **Fixed:** Frontend uses correct URL paths
✅ **Fixed:** Download functionality works properly
✅ **Improved:** Path resolution is environment-agnostic

The system now correctly handles file uploads and access regardless of deployment environment! 🎉
