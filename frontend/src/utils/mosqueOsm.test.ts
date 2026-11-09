import {
  MOSQUE_SEARCH_EXPAND_RADIUS_M,
  MOSQUE_SEARCH_RADIUS_M,
  buildMosqueOverpassQuery,
  buildNominatimBoundingBox,
  clearMosqueCache,
  fetchNearbyMosques,
  getCachedNearbyMosques,
  parseNominatimMosques,
  parseOverpassMosques,
  searchPlaces,
  setCachedNearbyMosques,
  shouldRefreshMosqueSearch,
  sortMosquesByDistance,
} from './mosqueOsm';

describe('mosque OSM search', () => {
  it('builds an Overpass query for mosques around a point', () => {
    const query = buildMosqueOverpassQuery(12.97, 77.59, MOSQUE_SEARCH_RADIUS_M);
    expect(query).toContain('religion"="muslim"');
    expect(query).toContain('building"="mosque"');
    expect(query).toContain(`around:${MOSQUE_SEARCH_RADIUS_M},12.97,77.59`);
  });

  it('parses nodes and way centers, skipping duplicates and nameless coordinates', () => {
    const mosques = parseOverpassMosques({
      elements: [
        { type: 'node', id: 1, lat: 12.97, lon: 77.59, tags: { name: 'Jama Masjid' } },
        { type: 'way', id: 2, center: { lat: 12.971, lon: 77.591 }, tags: { 'name:en': 'Masjid Ali', 'addr:street': 'MG Road', 'addr:city': 'Bengaluru' } },
        { type: 'node', id: 1, lat: 12.97, lon: 77.59, tags: { name: 'Duplicate' } },
        { type: 'node', id: 3, tags: { name: 'No coords' } },
      ],
    });

    expect(mosques).toEqual([
      { id: 'node/1', name: 'Jama Masjid', address: '', lat: 12.97, lon: 77.59 },
      { id: 'way/2', name: 'Masjid Ali', address: 'MG Road, Bengaluru', lat: 12.971, lon: 77.591 },
    ]);
  });

  it('sorts by distance and only refreshes after a meaningful pan', () => {
    const sorted = sortMosquesByDistance(
      [
        { id: 'far', name: 'Far', address: '', lat: 13.05, lon: 77.7 },
        { id: 'near', name: 'Near', address: '', lat: 12.971, lon: 77.591 },
      ],
      { lat: 12.97, lon: 77.59 }
    );
    expect(sorted.map((mosque) => mosque.id)).toEqual(['near', 'far']);
    expect(shouldRefreshMosqueSearch({ lat: 12.97, lon: 77.59 }, { lat: 12.9701, lon: 77.5901 })).toBe(false);
    expect(shouldRefreshMosqueSearch(null, { lat: 12.97, lon: 77.59 })).toBe(true);
  });

  it('queries Overpass, expands the radius when empty, and falls back to the next endpoint', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = decodeURIComponent(String(init?.body || ''));
      if (url.includes('overpass-api.de')) {
        return { ok: false, status: 504, json: async () => ({}) } as Response;
      }
      const empty = body.includes(`around:${MOSQUE_SEARCH_RADIUS_M}`);
      return {
        ok: true,
        json: async () => ({
          elements: empty ? [] : [{ type: 'node', id: 9, lat: 12.98, lon: 77.6, tags: { name: 'Expanded Mosque' } }],
        }),
      } as Response;
    });

    const mosques = await fetchNearbyMosques(12.97, 77.59, { fetchImpl });
    expect(mosques).toEqual([
      { id: 'node/9', name: 'Expanded Mosque', address: '', lat: 12.98, lon: 77.6 },
    ]);
    const bodies = fetchImpl.mock.calls.map((call) => decodeURIComponent(String((call[1] as RequestInit | undefined)?.body || '')));
    expect(bodies.some((body) => body.includes(`around:${MOSQUE_SEARCH_EXPAND_RADIUS_M}`))).toBe(true);
  });

  it('maps Nominatim hits into place suggestions', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => [{ display_name: 'Hyderabad, India', lat: '17.385', lon: '78.486' }],
    })) as jest.Mock;

    await expect(searchPlaces('hyderabad', { fetchImpl })).resolves.toEqual([
      { label: 'Hyderabad, India', lat: 17.385, lon: 78.486 },
    ]);
    await expect(searchPlaces('  ', { fetchImpl })).resolves.toEqual([]);
  });

  it('builds a bounding box and parses Nominatim mosques', () => {
    const box = buildNominatimBoundingBox(19.076, 72.877, 5000);
    expect(box).toMatch(/^[0-9.]+,[0-9.]+,[0-9.]+,[0-9.]+$/);

    const parsed = parseNominatimMosques([
      {
        place_id: 123,
        osm_type: 'node',
        osm_id: 456,
        lat: '19.076',
        lon: '72.877',
        name: 'Jama Masjid',
        display_name: 'Jama Masjid, Station Road, Mumbai, Maharashtra, India',
      },
    ]);

    expect(parsed).toEqual([
      {
        id: 'node/456',
        name: 'Jama Masjid',
        address: 'Station Road, Mumbai, Maharashtra',
        lat: 19.076,
        lon: 72.877,
      },
    ]);
  });

  it('caches mosques in memory and returns cached results instantly', async () => {
    clearMosqueCache();
    expect(getCachedNearbyMosques(19.076, 72.877)).toBeNull();

    const sampleMosques = [
      { id: 'node/1', name: 'Local Masjid', address: 'Main St', lat: 19.076, lon: 72.877 },
    ];
    setCachedNearbyMosques(19.076, 72.877, sampleMosques);

    const cached = getCachedNearbyMosques(19.076, 72.877);
    expect(cached).toEqual(sampleMosques);

    const fetchImpl = jest.fn();
    const result = await fetchNearbyMosques(19.076, 72.877, { fetchImpl });
    expect(result).toEqual(sampleMosques);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
