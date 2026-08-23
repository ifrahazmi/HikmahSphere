import { describe, expect, it } from '@jest/globals';
import { createKeepalivePayload } from './health';

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
