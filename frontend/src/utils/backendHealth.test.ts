import { checkLiveBackendHealth, getEffectiveHealthUrl } from './backendHealth';

describe('backendHealth utility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('resolves effective health URL', () => {
    const url = getEffectiveHealthUrl();
    expect(url).toMatch(/\/health$/);
  });

  it('returns healthy status when backend responds 200 with success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        message: 'HikmahSphere API is running! 🕌',
        version: '1.0.0',
        services: {
          database: 'connected',
          redis: 'connected',
        },
      }),
    } as Response);

    const result = await checkLiveBackendHealth();
    expect(result.status).toBe('healthy');
    expect(result.services.backend).toBe('operational');
    expect(result.services.database).toBe('connected');
    expect(result.services.redis).toBe('connected');
  });

  it('returns degraded status when database is disconnected', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        services: {
          database: 'disconnected',
          redis: 'connected',
        },
      }),
    } as Response);

    const result = await checkLiveBackendHealth();
    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe('disconnected');
  });

  it('returns down status when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const result = await checkLiveBackendHealth();
    expect(result.status).toBe('down');
    expect(result.services.backend).toBe('down');
  });

  it('handles fetch network exceptions gracefully', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));

    const result = await checkLiveBackendHealth();
    expect(result.status).toBe('down');
    expect(result.message).toContain('Network offline');
  });
});

