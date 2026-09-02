import { act, renderHook } from '@testing-library/react';
import { isInstalledMobilePwa, useStartupReadiness } from './useStartupReadiness';

jest.mock('../config', () => ({
  getBackendReadinessUrl: () => 'https://api.example.test/health/ready',
}));

const readyPayload = (database: 'operational' | 'unavailable' = 'operational') => ({
  status: database === 'operational' ? 'ready' : 'unavailable',
  ready: database === 'operational',
  services: {
    backend: 'operational',
    database,
    cache: 'operational',
  },
});

const frontendResponse = () => Promise.resolve({
  ok: true,
  text: () => Promise.resolve('hikmahsphere-online'),
});

const backendResponse = (
  database: 'operational' | 'unavailable' = 'operational'
) => Promise.resolve({
  ok: database === 'operational',
  json: () => Promise.resolve(readyPayload(database)),
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: online,
  });
};

const mockSuccessfulFetch = (cache: 'operational' | 'unavailable' = 'operational') => {
  (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
    if (String(input).includes('online-check.txt')) {
      return frontendResponse();
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        ...readyPayload(),
        services: { ...readyPayload().services, cache },
      }),
    });
  });
};

describe('useStartupReadiness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setOnline(true);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('finishes after the minimum two-second check window', async () => {
    mockSuccessfulFetch();
    const { result } = renderHook(() => useStartupReadiness(true));

    await flush();
    expect(result.current.state.outcome).toBe('checking');

    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.state.outcome).toBe('ready');
    expect(result.current.state.steps.internet.status).toBe('success');
    expect(result.current.state.steps.frontend.status).toBe('success');
    expect(result.current.state.steps.backend.status).toBe('success');
    expect(result.current.state.steps.database.status).toBe('success');
  });

  it('shows slow states after five seconds and can still recover', async () => {
    let resolveFrontend!: (value: any) => void;
    let resolveBackend!: (value: any) => void;
    const frontend = new Promise((resolve) => { resolveFrontend = resolve; });
    const backend = new Promise((resolve) => { resolveBackend = resolve; });
    (global as any).fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('online-check.txt') ? frontend : backend
    );
    const { result } = renderHook(() => useStartupReadiness(true));

    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    expect(result.current.state.steps.internet.status).toBe('slow');
    expect(result.current.state.steps.backend.message).toContain('waking');

    await act(async () => {
      resolveFrontend(await frontendResponse());
      resolveBackend(await backendResponse());
    });
    await flush();
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.state.outcome).toBe('ready');
  });

  it('stops dependent checks after fifteen seconds without internet', () => {
    setOnline(false);
    (global as any).fetch = jest.fn();
    const { result } = renderHook(() => useStartupReadiness(true));

    act(() => {
      jest.advanceTimersByTime(15_000);
    });

    expect(result.current.state.outcome).toBe('offline');
    expect(result.current.state.steps.internet.status).toBe('error');
    expect(result.current.state.steps.backend.status).toBe('waiting');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('stops at thirty seconds when the Render backend never responds', async () => {
    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).includes('online-check.txt')) return frontendResponse();
      return new Promise(() => undefined);
    });
    const { result } = renderHook(() => useStartupReadiness(true));
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.outcome).toBe('failed');
    expect(result.current.state.steps.backend.status).toBe('error');
    expect(result.current.state.steps.database.status).toBe('error');
  });

  it('keeps the backend green but blocks when MongoDB is unavailable', async () => {
    (global as any).fetch = jest.fn((input: RequestInfo | URL) =>
      String(input).includes('online-check.txt')
        ? frontendResponse()
        : backendResponse('unavailable')
    );
    const { result } = renderHook(() => useStartupReadiness(true));
    await flush();

    expect(result.current.state.steps.backend.status).toBe('success');
    expect(result.current.state.steps.database.status).toBe('checking');

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.outcome).toBe('failed');
    expect(result.current.state.steps.database.message).toBe('Database is unavailable');
  });

  it('allows Redis degradation because MongoDB is the required database', async () => {
    mockSuccessfulFetch('unavailable');
    const { result } = renderHook(() => useStartupReadiness(true));

    await flush();
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.state.outcome).toBe('ready');
  });

  it('rejects invalid frontend and backend probe responses', async () => {
    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      if (String(input).includes('online-check.txt')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<html>cached fallback</html>'),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'unknown' }),
      });
    });
    const { result } = renderHook(() => useStartupReadiness(true));
    await flush();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.state.outcome).toBe('failed');
    expect(result.current.state.steps.frontend.status).toBe('error');
    expect(result.current.state.steps.backend.status).toBe('error');
  });

  it('retries a terminal offline attempt only when requested', async () => {
    setOnline(false);
    (global as any).fetch = jest.fn();
    const { result } = renderHook(() => useStartupReadiness(true));
    act(() => {
      jest.advanceTimersByTime(15_000);
    });

    setOnline(true);
    mockSuccessfulFetch();
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.state.outcome).toBe('offline');
    expect(result.current.state.steps.internet.message).toContain('tap Retry');

    act(() => {
      result.current.retry();
    });
    await flush();
    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(result.current.state.outcome).toBe('ready');
  });

  it('aborts in-flight checks when unmounted', () => {
    let capturedSignal: AbortSignal | undefined;
    (global as any).fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise(() => undefined);
    });
    const { unmount } = renderHook(() => useStartupReadiness(true));

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('isInstalledMobilePwa', () => {
  const setMedia = (standalone: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: standalone })),
    });
  };

  it('enables the gate for installed Android and iOS PWAs', () => {
    setMedia(true);
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
    });
    expect(isInstalledMobilePwa()).toBe(true);

    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile',
    });
    expect(isInstalledMobilePwa()).toBe(true);
  });

  it('bypasses regular browser and desktop launches', () => {
    setMedia(false);
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile',
    });
    expect(isInstalledMobilePwa()).toBe(false);

    setMedia(true);
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
    });
    expect(isInstalledMobilePwa()).toBe(false);
  });
});

