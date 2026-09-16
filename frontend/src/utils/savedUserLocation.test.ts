import { API_URL } from '../config';
import { fetchSavedUserLocation } from './savedUserLocation';

describe('fetchSavedUserLocation', () => {
  it('returns null when the user has no saved coordinates', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ location: null }),
    });

    await expect(fetchSavedUserLocation('user-1', 'token', fetchImpl as typeof fetch)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith(`${API_URL}/users/user-1/location`, {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('returns saved prayer-times coordinates without using geolocation', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        location: {
          latitude: 19.07,
          longitude: 72.87,
          city: 'Mumbai',
          country: 'India',
          method: 2,
          school: 2,
        },
      }),
    });

    await expect(fetchSavedUserLocation('user-1', 'token', fetchImpl as typeof fetch)).resolves.toEqual({
      latitude: 19.07,
      longitude: 72.87,
      city: 'Mumbai',
      country: 'India',
      method: 2,
      school: 2,
    });
    expect(fetchImpl.mock.calls[0][0]).toContain('/users/user-1/location');
  });

  it('returns null when the location request fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchSavedUserLocation('user-1', 'token', fetchImpl as typeof fetch)).resolves.toBeNull();
  });
});
