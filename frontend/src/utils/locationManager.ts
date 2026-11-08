export type LocationMode = 'gps' | 'custom';

export interface UserLocation {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
  mode?: LocationMode;
  updatedAt?: number;
}

export interface LocationCheckResult {
  status: 'granted' | 'denied' | 'prompt' | 'unsupported' | 'error' | 'skipped';
  location?: UserLocation;
  changed?: boolean;
  distanceKm?: number;
  message?: string;
}

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 7,200,000 ms = 2 hours
export const SAVED_LOCATION_STORAGE_KEY = 'hikmahsphere_user_location';
export const LAST_LOCATION_CHECK_KEY = 'hikmahsphere_last_location_check_ts';

export const getStoredUserLocation = (): UserLocation | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SAVED_LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Number.isFinite(Number(parsed.lat)) &&
      Number.isFinite(Number(parsed.lon))
    ) {
      return {
        lat: Number(parsed.lat),
        lon: Number(parsed.lon),
        city: parsed.city || undefined,
        country: parsed.country || undefined,
        mode: parsed.mode === 'custom' ? 'custom' : 'gps',
        updatedAt: Number(parsed.updatedAt) || Date.now(),
      };
    }
  } catch (err) {
    console.warn('Failed to parse stored user location:', err);
  }
  return null;
};

export const saveStoredUserLocation = (location: UserLocation): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    const payload: UserLocation = {
      lat: Number(location.lat),
      lon: Number(location.lon),
      city: location.city?.trim() || undefined,
      country: location.country?.trim() || undefined,
      mode: location.mode === 'custom' ? 'custom' : 'gps',
      updatedAt: location.updatedAt || Date.now(),
    };
    window.localStorage.setItem(SAVED_LOCATION_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save stored user location:', err);
  }
};

export const clearStoredUserLocation = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(SAVED_LOCATION_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear stored user location:', err);
  }
};

export const getLastLocationCheckTimestamp = (): number => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 0;
  }
  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_CHECK_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
};

export const recordLocationCheck = (timestamp = Date.now()): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(LAST_LOCATION_CHECK_KEY, String(timestamp));
  } catch (err) {
    console.warn('Failed to record location check timestamp:', err);
  }
};

export const shouldCheckLocationAccess = (intervalMs = TWO_HOURS_MS): boolean => {
  const lastCheck = getLastLocationCheckTimestamp();
  if (!lastCheck) return true;
  return Date.now() - lastCheck >= intervalMs;
};

/**
 * Calculates rough distance in kilometers between two GPS coordinates using Haversine formula
 */
export const calculateCoordinateDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export interface CheckLocationAccessOptions {
  force?: boolean;
  intervalMs?: number;
  currentLocation?: UserLocation | null;
  reverseGeocode?: (lat: number, lon: number) => Promise<{ city?: string; country?: string }>;
}

export const checkLocationAccess = async (
  options: CheckLocationAccessOptions = {}
): Promise<LocationCheckResult> => {
  const {
    force = false,
    intervalMs = TWO_HOURS_MS,
    currentLocation,
    reverseGeocode,
  } = options;

  if (!force && !shouldCheckLocationAccess(intervalMs)) {
    return {
      status: 'skipped',
      message: 'Less than 2 hours elapsed since last location check',
    };
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    recordLocationCheck();
    return {
      status: 'unsupported',
      message: 'Geolocation is not supported by your browser',
    };
  }

  // Attempt to query current permissions status if available
  if ('permissions' in navigator && typeof navigator.permissions.query === 'function') {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      if (permission.state === 'denied') {
        recordLocationCheck();
        return {
          status: 'denied',
          message: 'Location permission denied by user',
        };
      }
    } catch {
      // Permissions API query not supported for geolocation in some browsers; proceed to getCurrentPosition
    }
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        recordLocationCheck();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        let distanceKm = 0;
        let city = currentLocation?.city;
        let country = currentLocation?.country;

        if (currentLocation && Number.isFinite(currentLocation.lat) && Number.isFinite(currentLocation.lon)) {
          distanceKm = calculateCoordinateDistanceKm(currentLocation.lat, currentLocation.lon, lat, lon);
        }

        // If moved > 2km or city is not known yet, reverse geocode
        if (!city || distanceKm > 2) {
          if (reverseGeocode) {
            try {
              const details = await reverseGeocode(lat, lon);
              if (details.city) city = details.city;
              if (details.country) country = details.country;
            } catch (geoErr) {
              console.warn('Reverse geocode in location check failed:', geoErr);
            }
          }
        }

        const isChanged =
          !currentLocation ||
          distanceKm > 2 ||
          (city && currentLocation.city && city.toLowerCase() !== currentLocation.city.toLowerCase());

        const newLocation: UserLocation = {
          lat,
          lon,
          city,
          country,
          mode: 'gps',
          updatedAt: Date.now(),
        };

        if (isChanged) {
          saveStoredUserLocation(newLocation);
        }

        resolve({
          status: 'granted',
          location: newLocation,
          changed: isChanged,
          distanceKm,
          message: isChanged
            ? `Location updated to ${city || `${lat.toFixed(2)}, ${lon.toFixed(2)}`}`
            : 'Location verified; no significant change',
        });
      },
      (err) => {
        recordLocationCheck();
        const isDenied = err.code === err.PERMISSION_DENIED;
        resolve({
          status: isDenied ? 'denied' : 'error',
          message: err.message || 'Failed to acquire location',
        });
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  });
};
