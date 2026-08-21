import fs from 'fs';
import path from 'path';

const LEGACY_UPLOADS_ROOT = '/var/www/hikmah/uploads';

/**
 * Resolve the base uploads directory for Render / Docker / legacy bare-metal.
 *
 * Order:
 * 1. UPLOADS_DIR env
 * 2. Legacy /var/www/hikmah/uploads if it already exists
 * 3. backend/src/uploads (local / Render-safe default)
 */
export const getUploadsRoot = (): string => {
  if (process.env.UPLOADS_DIR?.trim()) {
    return path.resolve(process.env.UPLOADS_DIR.trim());
  }

  if (fs.existsSync(LEGACY_UPLOADS_ROOT)) {
    return LEGACY_UPLOADS_ROOT;
  }

  return path.resolve(process.cwd(), 'src', 'uploads');
};

export const getUploadsSubdir = (...segments: string[]): string => {
  const dir = path.join(getUploadsRoot(), ...segments);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/**
 * Convert a stored URL path (`/uploads/zakat/file.jpg`) to a filesystem path.
 */
export const resolveUploadFilesystemPath = (urlPath: string): string => {
  const clean = urlPath.replace(/^\/+/, '');
  const withoutPrefix = clean
    .replace(/^src\/uploads\//, '')
    .replace(/^uploads\//, '');
  return path.join(getUploadsRoot(), withoutPrefix);
};
