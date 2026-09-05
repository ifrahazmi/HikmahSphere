import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_TAFSIR_UPSTREAMS,
  isLocalTafsirUrl,
  isNonTafsirAuthWall,
  resolveTafsirUpstreamCandidates,
} from './tafsirUpstream';

describe('tafsir upstream resolution', () => {
  it('treats localhost and loopback as local-only URLs', () => {
    expect(isLocalTafsirUrl('http://localhost:8080/api')).toBe(true);
    expect(isLocalTafsirUrl('http://127.0.0.1:8080/api')).toBe(true);
    expect(isLocalTafsirUrl('https://aws-vm.reedfish-temperature.ts.net/api')).toBe(false);
  });

  it('skips localhost in production and keeps remote fallbacks', () => {
    const candidates = resolveTafsirUpstreamCandidates({
      configured: 'http://localhost:8080/api',
      nodeEnv: 'production',
    });

    expect(candidates).not.toContain('http://localhost:8080/api');
    expect(candidates[0]).toBe(DEFAULT_TAFSIR_UPSTREAMS[0]);
    expect(candidates).toContain('http://100.95.236.21:8080/api');
  });

  it('keeps a configured remote URL first and still adds fallbacks', () => {
    const candidates = resolveTafsirUpstreamCandidates({
      configured: 'https://aws-vm.reedfish-temperature.ts.net/api',
      nodeEnv: 'production',
    });

    expect(candidates[0]).toBe('https://aws-vm.reedfish-temperature.ts.net/api');
    expect(candidates.length).toBeGreaterThan(1);
  });

  it('keeps localhost first in development so a real local tafsir server still wins', () => {
    const candidates = resolveTafsirUpstreamCandidates({
      configured: 'http://localhost:8080/api',
      nodeEnv: 'development',
    });

    expect(candidates[0]).toBe('http://localhost:8080/api');
    expect(candidates).toContain('http://100.95.236.21:8080/api');
  });

  it('detects code-server style auth walls that are not the tafsir API', () => {
    expect(isNonTafsirAuthWall(401, { error: 'Unauthorized' })).toBe(true);
    expect(isNonTafsirAuthWall(401, { status: 'error', message: 'Missing API key' })).toBe(false);
    expect(isNonTafsirAuthWall(200, { error: 'Unauthorized' })).toBe(false);
  });
});
