import {
  BOOTSTRAP_READY_LS_KEY,
  fetchBootstrapManifest,
  isBootstrapReady,
  markBootstrapReady,
} from './pwaBootstrap';

describe('pwaBootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('marks bootstrap ready in localStorage', () => {
    markBootstrapReady();
    expect(localStorage.getItem(BOOTSTRAP_READY_LS_KEY)).toBe('1');
  });

  it('fetches bootstrap manifest', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'v1',
        cacheName: 'hikmahsphere-bootstrap-v1',
        urls: ['/index.html'],
      }),
    });

    const manifest = await fetchBootstrapManifest();
    expect(manifest?.urls).toContain('/index.html');
  });

  it('falls back to localStorage when service worker status is unavailable', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    markBootstrapReady();
    expect(await isBootstrapReady()).toBe(true);
  });
});
