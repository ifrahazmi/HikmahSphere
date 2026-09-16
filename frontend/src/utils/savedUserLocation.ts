import { API_URL } from '../config';

export type SavedUserLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  method?: number;
  school?: number;
};

export const fetchSavedUserLocation = async (
  userId: string,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<SavedUserLocation | null> => {
  if (!userId || !token) {
    return null;
  }

  const response = await fetchImpl(`${API_URL}/users/${encodeURIComponent(userId)}/location`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  const saved = payload?.location;
  const latitude = Number(saved?.latitude);
  const longitude = Number(saved?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const method = Number(saved?.method);
  const school = Number(saved?.school);

  return {
    latitude,
    longitude,
    ...(typeof saved?.city === 'string' && saved.city.trim() ? { city: saved.city.trim() } : {}),
    ...(typeof saved?.country === 'string' && saved.country.trim() ? { country: saved.country.trim() } : {}),
    ...(Number.isInteger(method) && method > 0 ? { method } : {}),
    ...(school === 1 || school === 2 ? { school } : {}),
  };
};
