import { describe, expect, it } from '@jest/globals';
import { createKeepalivePayload, createReadinessPayload } from './health';

describe('keepalive health payload', () => {
  it('returns a stable success marker and runtime diagnostics', () => {
    const payload = createKeepalivePayload(
      true,
      new Date('2026-08-23T12:00:00.000Z'),
      125.9
    );

    expect(payload).toEqual({
      status: 'success',
      keepalive: true,
      timestamp: '2026-08-23T12:00:00.000Z',
      uptimeSeconds: 125,
      services: { database: 'connected' },
    });
  });

  it('reports a disconnected database without failing liveness', () => {
    const payload = createKeepalivePayload(false, new Date(0), 0);

    expect(payload.status).toBe('success');
    expect(payload.keepalive).toBe(true);
    expect(payload.services.database).toBe('disconnected');
  });
});

describe('startup readiness payload', () => {
  const now = new Date('2026-08-24T12:00:00.000Z');

  it('reports ready when required services respond', async () => {
    const payload = await createReadinessPayload({
      databaseConnected: true,
      pingDatabase: async () => ({ ok: 1 }),
      cacheConnected: true,
      pingCache: async () => 'PONG',
    }, { now, uptimeSeconds: 42.8 });

    expect(payload).toEqual({
      status: 'ready',
      ready: true,
      timestamp: now.toISOString(),
      uptimeSeconds: 42,
      services: {
        backend: 'operational',
        database: 'operational',
        cache: 'operational',
      },
    });
  });

  it('reports unavailable when the database cannot be queried', async () => {
    const payload = await createReadinessPayload({
      databaseConnected: true,
      pingDatabase: async () => {
        throw new Error('database unavailable');
      },
      cacheConnected: true,
      pingCache: async () => 'PONG',
    }, { now });

    expect(payload.ready).toBe(false);
    expect(payload.status).toBe('unavailable');
    expect(payload.services.database).toBe('unavailable');
  });

  it('times out a stalled database check', async () => {
    const payload = await createReadinessPayload({
      databaseConnected: true,
      pingDatabase: () => new Promise(() => undefined),
      cacheConnected: true,
      pingCache: async () => 'PONG',
    }, { now, timeoutMs: 5 });

    expect(payload.ready).toBe(false);
    expect(payload.services.database).toBe('unavailable');
  });

  it('allows startup in degraded mode when only Redis is unavailable', async () => {
    const payload = await createReadinessPayload({
      databaseConnected: true,
      pingDatabase: async () => ({ ok: 1 }),
      cacheConnected: false,
      pingCache: async () => 'PONG',
    }, { now });

    expect(payload.ready).toBe(true);
    expect(payload.status).toBe('degraded');
    expect(payload.services.cache).toBe('unavailable');
  });
});
