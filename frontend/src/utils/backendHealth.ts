import { getBackendOrigin } from '../config';

export type SystemHealthStatus = 'healthy' | 'degraded' | 'down' | 'loading';

export interface BackendServicesStatus {
  backend: 'operational' | 'down';
  database: 'connected' | 'disconnected' | 'unknown';
  redis: 'connected' | 'disconnected' | 'unknown';
  halalApi?: {
    configured: boolean;
    working: boolean;
    status: string;
    message?: string;
  };
}

export interface BackendHealthDetails {
  status: SystemHealthStatus;
  latencyMs: number;
  httpStatus?: number;
  message: string;
  timestamp: string;
  services: BackendServicesStatus;
  raw?: unknown;
}

const DEFAULT_BACKEND_HEALTH_URL = 'https://hikmahsphere-backend.onrender.com/health';

export const getEffectiveHealthUrl = (): string => {
  const origin = getBackendOrigin();
  if (origin && /^https?:\/\//i.test(origin)) {
    return `${origin}/health`;
  }
  return DEFAULT_BACKEND_HEALTH_URL;
};

export const checkLiveBackendHealth = async (
  timeoutMs = 8000
): Promise<BackendHealthDetails> => {
  const url = getEffectiveHealthUrl();
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startTime;
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        status: 'down',
        latencyMs,
        httpStatus: response.status,
        message: `Backend returned HTTP ${response.status}`,
        timestamp: new Date().toISOString(),
        services: {
          backend: 'down',
          database: 'unknown',
          redis: 'unknown',
        },
      };
    }

    const data: any = await response.json().catch(() => ({}));

    const dbConnected =
      data?.services?.database === 'connected' ||
      data?.services?.database === 'operational';
    const redisConnected =
      data?.services?.redis === 'connected' ||
      data?.services?.redis === 'operational';

    const isHealthy =
      data?.status === 'success' ||
      data?.status === 'ready' ||
      response.status === 200;

    let overallStatus: SystemHealthStatus = 'healthy';
    if (!isHealthy) {
      overallStatus = 'down';
    } else if (data?.services && !dbConnected) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      latencyMs,
      httpStatus: response.status,
      message: data?.message || 'HikmahSphere API is running! 🕌',
      timestamp: data?.timestamp || new Date().toISOString(),
      services: {
        backend: isHealthy ? 'operational' : 'down',
        database: dbConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
        halalApi: data?.services?.halalCheckRapidApi,
      },
      raw: data,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err?.name === 'AbortError';

    return {
      status: 'down',
      latencyMs,
      message: isTimeout
        ? 'Request timed out waiting for backend response'
        : (err?.message || 'Could not reach backend health check URL'),
      timestamp: new Date().toISOString(),
      services: {
        backend: 'down',
        database: 'unknown',
        redis: 'unknown',
      },
    };
  }
};
