import {
  TWO_HOURS_MS,
  SAVED_LOCATION_STORAGE_KEY,
  LAST_LOCATION_CHECK_KEY,
  getStoredUserLocation,
  saveStoredUserLocation,
  clearStoredUserLocation,
  getLastLocationCheckTimestamp,
  recordLocationCheck,
  shouldCheckLocationAccess,
  calculateCoordinateDistanceKm,
  checkLocationAccess,
  UserLocation,
} from './locationManager';

describe('locationManager utility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  describe('localStorage persistence', () => {
    it('returns null when no location is stored', () => {
      expect(getStoredUserLocation()).toBeNull();
    });

    it('saves and retrieves user location correctly', () => {
      const loc: UserLocation = {
        lat: 21.4225,
        lon: 39.8262,
        city: 'Makkah',
        country: 'Saudi Arabia',
        mode: 'custom',
      };

      saveStoredUserLocation(loc);
      const stored = getStoredUserLocation();

      expect(stored).not.toBeNull();
      expect(stored?.lat).toBe(21.4225);
      expect(stored?.lon).toBe(39.8262);
      expect(stored?.city).toBe('Makkah');
      expect(stored?.country).toBe('Saudi Arabia');
      expect(stored?.mode).toBe('custom');
    });

    it('clears stored user location', () => {
      saveStoredUserLocation({ lat: 10, lon: 20 });
      expect(getStoredUserLocation()).not.toBeNull();

      clearStoredUserLocation();
      expect(getStoredUserLocation()).toBeNull();
    });
  });

  describe('2-hour interval checks', () => {
    it('reports shouldCheckLocationAccess = true when never checked', () => {
      expect(getLastLocationCheckTimestamp()).toBe(0);
      expect(shouldCheckLocationAccess()).toBe(true);
    });

    it('reports shouldCheckLocationAccess = false when checked recently (< 2 hours)', () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      recordLocationCheck(oneHourAgo);

      expect(shouldCheckLocationAccess()).toBe(false);
    });

    it('reports shouldCheckLocationAccess = true when >= 2 hours have passed', () => {
      const threeHoursAgo = Date.now() - (TWO_HOURS_MS + 1000);
      recordLocationCheck(threeHoursAgo);

      expect(shouldCheckLocationAccess()).toBe(true);
    });
  });

  describe('coordinate distance calculation', () => {
    it('calculates distance between Makkah and Madinah (~350-450km)', () => {
      // Makkah: 21.4225, 39.8262; Madinah: 24.4672, 39.6111
      const dist = calculateCoordinateDistanceKm(21.4225, 39.8262, 24.4672, 39.6111);
      expect(dist).toBeGreaterThan(330);
      expect(dist).toBeLessThan(400);
    });

    it('calculates 0km for identical coordinates', () => {
      expect(calculateCoordinateDistanceKm(12.9716, 77.5946, 12.9716, 77.5946)).toBeCloseTo(0);
    });
  });

  describe('checkLocationAccess', () => {
    it('skips check if less than 2 hours elapsed and force is false', async () => {
      recordLocationCheck(Date.now() - 1000);

      const result = await checkLocationAccess({ force: false });
      expect(result.status).toBe('skipped');
    });

    it('runs check and updates location when force is true', async () => {
      const mockGetCurrentPosition = jest.fn((success) => {
        success({
          coords: {
            latitude: 25.2048,
            longitude: 55.2708,
          },
        });
      });

      // @ts-ignore
      navigator.geolocation = {
        getCurrentPosition: mockGetCurrentPosition,
      };

      const reverseGeocode = jest.fn().mockResolvedValue({
        city: 'Dubai',
        country: 'United Arab Emirates',
      });

      const result = await checkLocationAccess({
        force: true,
        reverseGeocode,
      });

      expect(result.status).toBe('granted');
      expect(result.changed).toBe(true);
      expect(result.location?.city).toBe('Dubai');
      expect(result.location?.country).toBe('United Arab Emirates');
      expect(result.location?.lat).toBe(25.2048);
      expect(result.location?.lon).toBe(55.2708);
    });

    it('detects city change when moving to another city', async () => {
      const mockGetCurrentPosition = jest.fn((success) => {
        success({
          coords: {
            latitude: 21.4225,
            longitude: 39.8262,
          },
        });
      });

      // @ts-ignore
      navigator.geolocation = {
        getCurrentPosition: mockGetCurrentPosition,
      };

      const reverseGeocode = jest.fn().mockResolvedValue({
        city: 'Makkah',
        country: 'Saudi Arabia',
      });

      const previousLocation: UserLocation = {
        lat: 12.9716,
        lon: 77.5946,
        city: 'Bengaluru',
        country: 'India',
      };

      const result = await checkLocationAccess({
        force: true,
        currentLocation: previousLocation,
        reverseGeocode,
      });

      expect(result.status).toBe('granted');
      expect(result.changed).toBe(true);
      expect(result.location?.city).toBe('Makkah');
    });

    it('handles permission denied error gracefully', async () => {
      const mockGetCurrentPosition = jest.fn((_, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          PERMISSION_DENIED: 1,
          message: 'User denied Geolocation',
        });
      });

      // @ts-ignore
      navigator.geolocation = {
        getCurrentPosition: mockGetCurrentPosition,
      };

      const result = await checkLocationAccess({ force: true });
      expect(result.status).toBe('denied');
      expect(result.message).toContain('denied');
    });
  });
});

