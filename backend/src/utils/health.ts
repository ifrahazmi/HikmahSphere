export type KeepalivePayload = {
  status: 'success';
  keepalive: true;
  timestamp: string;
  uptimeSeconds: number;
  services: {
    database: 'connected' | 'disconnected';
  };
};

export const createKeepalivePayload = (
  databaseConnected: boolean,
  now: Date = new Date(),
  uptimeSeconds: number = process.uptime()
): KeepalivePayload => ({
  status: 'success',
  keepalive: true,
  timestamp: now.toISOString(),
  uptimeSeconds: Math.max(0, Math.floor(uptimeSeconds)),
  services: {
    database: databaseConnected ? 'connected' : 'disconnected',
  },
});

export type ReadinessServiceStatus = 'operational' | 'unavailable';

export type ReadinessPayload = {
  status: 'ready' | 'degraded' | 'unavailable';
  ready: boolean;
  timestamp: string;
  uptimeSeconds: number;
  services: {
    backend: 'operational';
    database: ReadinessServiceStatus;
    cache: ReadinessServiceStatus;
  };
};

type ReadinessChecks = {
  databaseConnected: boolean;
  pingDatabase: () => Promise<unknown>;
  cacheConnected: boolean;
  pingCache: () => Promise<unknown>;
};

const checkDependency = async (
  connected: boolean,
  ping: () => Promise<unknown>,
  timeoutMs: number
): Promise<ReadinessServiceStatus> => {
  if (!connected) {
    return 'unavailable';
  }

  let timeoutId: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      ping(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Readiness check timed out')), timeoutMs);
      }),
    ]);
    return 'operational';
  } catch {
    return 'unavailable';
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

/**
 * Creates a strict readiness response without leaking dependency details.
 * MongoDB is required for the application; Redis is an optional cache and
 * therefore reports a degraded state without blocking startup.
 */
export const createReadinessPayload = async (
  checks: ReadinessChecks,
  options: {
    timeoutMs?: number;
    now?: Date;
    uptimeSeconds?: number;
  } = {}
): Promise<ReadinessPayload> => {
  const timeoutMs = options.timeoutMs ?? 3_000;
  const [database, cache] = await Promise.all([
    checkDependency(checks.databaseConnected, checks.pingDatabase, timeoutMs),
    checkDependency(checks.cacheConnected, checks.pingCache, timeoutMs),
  ]);

  const ready = database === 'operational';
  const status = !ready ? 'unavailable' : cache === 'operational' ? 'ready' : 'degraded';

  return {
    status,
    ready,
    timestamp: (options.now ?? new Date()).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(options.uptimeSeconds ?? process.uptime())),
    services: {
      backend: 'operational',
      database,
      cache,
    },
  };
};
