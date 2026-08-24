const PRODUCTION_API_URL = 'https://hikmahsphere-backend.onrender.com/api';

export const getApiUrl = () => {
  const configuredUrl = process.env.REACT_APP_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  // Local development uses CRA's /api proxy. Production has a safe
  // fallback so a missed Vercel environment variable cannot break API calls.
  return process.env.NODE_ENV === 'production' ? PRODUCTION_API_URL : '/api';
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

export const getBackendReadinessUrl = (): string => {
  const origin = getBackendOrigin();
  return origin ? `${origin}/health/ready` : '/api/health/ready';
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
