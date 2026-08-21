export const getApiUrl = () => {
  // Check if we have an environment variable first
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  }

  // Use relative path to leverage the proxy in package.json
  // This is the correct way for IDX/Codespaces where 127.0.0.1 is not accessible from the client browser directly
  return '/api';
};

export const API_URL = getApiUrl();

/**
 * Backend origin (scheme + host) without the `/api` suffix.
 * Empty string means same-origin (local CRA proxy / same-host Docker).
 */
export const getBackendOrigin = (): string => {
  const apiUrl = getApiUrl();
  if (/^https?:\/\//i.test(apiUrl)) {
    return apiUrl.replace(/\/api\/?$/i, '');
  }
  return '';
};

/**
 * Resolve a backend-served path (e.g. `/uploads/...` or `/api/hajj-guide/images/...`)
 * so it works when the frontend is on a different origin (Vercel → Render).
 */
export const resolveBackendUrl = (path: string): string => {
  if (!path) {
    return path;
  }
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const origin = getBackendOrigin();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
};

export const UPLOADS_BASE_URL = getBackendOrigin();

// Public client key — set via REACT_APP_GOOGLE_MAPS_API_KEY (never commit real keys as fallbacks)
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
