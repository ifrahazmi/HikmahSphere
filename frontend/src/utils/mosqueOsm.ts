export type NearbyMosque = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

export type PlaceSuggestion = {
  label: string;
  lat: number;
  lon: number;
};

export const MOSQUE_SEARCH_RADIUS_M = 6000;
export const MOSQUE_SEARCH_EXPAND_RADIUS_M = 15000;
export const MOSQUE_SEARCH_MOVE_THRESHOLD_M = 400;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const formatMosqueDistanceKm = (km: number): string => km.toFixed(1);

export const shouldRefreshMosqueSearch = (
  previous: { lat: number; lon: number } | null,
  next: { lat: number; lon: number },
  minMeters: number = MOSQUE_SEARCH_MOVE_THRESHOLD_M
): boolean => {
  if (!previous) {
    return true;
  }
  return haversineKm(previous.lat, previous.lon, next.lat, next.lon) * 1000 >= minMeters;
};

export const buildMosqueOverpassQuery = (lat: number, lon: number, radiusMeters: number): string => {
  const radius = Math.max(500, Math.round(radiusMeters));
  return `[out:json][timeout:25];
(
  nwr["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${lat},${lon});
  nwr["building"="mosque"](around:${radius},${lat},${lon});
);
out center tags;`;
};

const mosqueNameFromTags = (tags: Record<string, string> = {}): string => {
  return tags.name || tags['name:en'] || tags['name:ar'] || tags['name:hi'] || tags['name:ur'] || 'Mosque';
};

const mosqueAddressFromTags = (tags: Record<string, string> = {}): string => {
  if (tags['addr:full']) {
    return tags['addr:full'];
  }

  const line = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:place'],
    tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:hamlet'],
  ]
    .map((part) => part?.trim())
    .filter(Boolean);

  return line.join(', ');
};

export const parseOverpassMosques = (payload: { elements?: OverpassElement[] } | null | undefined): NearbyMosque[] => {
  const elements = Array.isArray(payload?.elements) ? payload.elements : [];
  const seen = new Set<string>();
  const mosques: NearbyMosque[] = [];

  elements.forEach((element) => {
    const lat = toFiniteNumber(element.lat ?? element.center?.lat);
    const lon = toFiniteNumber(element.lon ?? element.center?.lon);
    if (lat === null || lon === null) {
      return;
    }

    const id = `${element.type || 'node'}/${element.id || `${lat},${lon}`}`;
    const placeKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
    if (seen.has(id) || seen.has(placeKey)) {
      return;
    }
    seen.add(id);
    seen.add(placeKey);

    mosques.push({
      id,
      name: mosqueNameFromTags(element.tags),
      address: mosqueAddressFromTags(element.tags),
      lat,
      lon,
    });
  });

  return mosques;
};

export const sortMosquesByDistance = (
  mosques: NearbyMosque[],
  origin: { lat: number; lon: number }
): NearbyMosque[] => {
  return [...mosques].sort(
    (left, right) => haversineKm(origin.lat, origin.lon, left.lat, left.lon) - haversineKm(origin.lat, origin.lon, right.lat, right.lon)
  );
};

const postOverpass = async (
  endpoint: string,
  query: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<{ elements?: OverpassElement[] }> => {
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass ${response.status}`);
  }

  return response.json();
};

export const fetchNearbyMosques = async (
  lat: number,
  lon: number,
  options: {
    radiusMeters?: number;
    expandIfEmpty?: boolean;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {}
): Promise<NearbyMosque[]> => {
  const fetchImpl = options.fetchImpl || fetch;
  const radiusMeters = options.radiusMeters ?? MOSQUE_SEARCH_RADIUS_M;
  const query = buildMosqueOverpassQuery(lat, lon, radiusMeters);

  let lastError: unknown = null;
  let parsed: NearbyMosque[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const payload = await postOverpass(endpoint, query, fetchImpl, options.signal);
      parsed = parseOverpassMosques(payload);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError && parsed.length === 0) {
    throw lastError instanceof Error ? lastError : new Error('Mosque search failed');
  }

  if (parsed.length === 0 && options.expandIfEmpty !== false && radiusMeters < MOSQUE_SEARCH_EXPAND_RADIUS_M) {
    return fetchNearbyMosques(lat, lon, {
      ...options,
      radiusMeters: MOSQUE_SEARCH_EXPAND_RADIUS_M,
      expandIfEmpty: false,
    });
  }

  return sortMosquesByDistance(parsed, { lat, lon });
};

export const searchPlaces = async (
  query: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal; limit?: number } = {}
): Promise<PlaceSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const fetchImpl = options.fetchImpl || fetch;
  const limit = options.limit ?? 6;
  const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&q=${encodeURIComponent(trimmed)}&addressdetails=1&limit=${limit}&accept-language=en`;
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Place search ${response.status}`);
  }

  const results = await response.json();
  if (!Array.isArray(results)) {
    return [];
  }

  return results
    .map((item: { display_name?: string; lat?: string; lon?: string }) => {
      const lat = toFiniteNumber(item.lat);
      const lon = toFiniteNumber(item.lon);
      const label = String(item.display_name || '').trim();
      if (lat === null || lon === null || !label) {
        return null;
      }
      return { label, lat, lon };
    })
    .filter((item): item is PlaceSuggestion => Boolean(item));
};
