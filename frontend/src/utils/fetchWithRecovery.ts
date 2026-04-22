type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type FetchWithRecoveryOptions = {
  cacheKey?: string;
  cacheTtlMs?: number;
  fallbackMessage?: string;
  maxRetries?: number;
  retryOnStatuses?: number[];
  timeoutMs?: number;
} & RequestInit;

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRYABLE_STATUSES = [429, 502, 503, 504];
const MAX_AUTO_RETRY_DELAY_MS = 12_000;

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export class FetchRecoveryError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(message: string, options?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = 'FetchRecoveryError';
    this.status = options?.status;
    this.retryAfterMs = options?.retryAfterMs;
  }
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getRequestKey = (url: string, init: RequestInit, overrideKey?: string): string => {
  if (overrideKey) {
    return overrideKey;
  }

  const method = (init.method || 'GET').toUpperCase();
  return `${method}:${url}`;
};

const getCachedValue = <T>(cacheKey: string, cacheTtlMs: number): T | null => {
  if (cacheTtlMs <= 0) {
    return null;
  }

  const entry = responseCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return entry.value as T;
};

const setCachedValue = <T>(cacheKey: string, cacheTtlMs: number, value: T): void => {
  if (cacheTtlMs <= 0) {
    return;
  }

  responseCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + cacheTtlMs,
  });
};

const parseRetryAfterMs = (response: Response): number | null => {
  const retryAfterHeader = response.headers.get('Retry-After');
  if (retryAfterHeader) {
    const asSeconds = Number(retryAfterHeader);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return asSeconds * 1000;
    }

    const asDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
  }

  const rateLimitResetHeader = response.headers.get('RateLimit-Reset');
  if (!rateLimitResetHeader) {
    return null;
  }

  const parsedValue = Number(rateLimitResetHeader);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  if (parsedValue <= 86_400) {
    return parsedValue * 1000;
  }

  if (parsedValue > 1_000_000_000_000) {
    return Math.max(0, parsedValue - Date.now());
  }

  if (parsedValue > 1_000_000_000) {
    return Math.max(0, parsedValue * 1000 - Date.now());
  }

  return null;
};

const getRetryDelayMs = (attempt: number, response?: Response): number => {
  const headerDelay = response ? parseRetryAfterMs(response) : null;
  if (headerDelay !== null) {
    return Math.min(Math.max(500, headerDelay), MAX_AUTO_RETRY_DELAY_MS);
  }

  const exponentialDelay = 800 * (2 ** (attempt - 1));
  const jitter = Math.floor(Math.random() * 300);
  return Math.min(exponentialDelay + jitter, MAX_AUTO_RETRY_DELAY_MS);
};

const isRetryableNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError'
    || message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
  );
};

const buildErrorMessage = (
  response: Response,
  fallbackMessage: string,
  payload: any
): string => {
  const payloadMessage = payload?.message || payload?.error;

  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response);
    if (retryAfterMs && retryAfterMs > MAX_AUTO_RETRY_DELAY_MS) {
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return payloadMessage || `Too many requests. Please wait about ${seconds}s and try again.`;
    }

    return payloadMessage || 'Too many requests for Quran data right now. Please wait a moment and try again.';
  }

  return payloadMessage || fallbackMessage || `HTTP ${response.status}`;
};

const fetchResponseWithRecovery = async (
  url: string,
  options: FetchWithRecoveryOptions
): Promise<Response> => {
  const {
    fallbackMessage = 'Request failed',
    maxRetries = DEFAULT_MAX_RETRIES,
    retryOnStatuses = DEFAULT_RETRYABLE_STATUSES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ...requestInit
  } = options;

  let lastNetworkError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...requestInit,
        signal: controller.signal,
      });

      if (!retryOnStatuses.includes(response.status) || attempt > maxRetries) {
        return response;
      }

      await sleep(getRetryDelayMs(attempt, response));
    } catch (error) {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(fallbackMessage);

      if (!isRetryableNetworkError(normalizedError) || attempt > maxRetries) {
        throw normalizedError;
      }

      lastNetworkError = normalizedError;
      await sleep(getRetryDelayMs(attempt));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastNetworkError || new Error(fallbackMessage);
};

export const fetchJsonWithRecovery = async <T>(
  url: string,
  options: FetchWithRecoveryOptions = {}
): Promise<T> => {
  const {
    cacheKey,
    cacheTtlMs = 0,
    fallbackMessage = 'Request failed',
    ...requestInit
  } = options;
  const requestKey = getRequestKey(url, requestInit, cacheKey);
  const method = (requestInit.method || 'GET').toUpperCase();
  const useSharedCache = method === 'GET';

  if (useSharedCache) {
    const cached = getCachedValue<T>(requestKey, cacheTtlMs);
    if (cached !== null) {
      return cached;
    }

    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      return existingRequest as Promise<T>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetchResponseWithRecovery(url, { fallbackMessage, ...requestInit });
    const payload = await response.clone().json().catch(() => null);

    if (!response.ok) {
      const message = buildErrorMessage(response, fallbackMessage, payload);
      throw new FetchRecoveryError(message, {
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response) ?? undefined,
      });
    }

    if (payload === null) {
      throw new FetchRecoveryError(fallbackMessage);
    }

    if (useSharedCache) {
      setCachedValue(requestKey, cacheTtlMs, payload);
    }

    return payload as T;
  })();

  if (useSharedCache) {
    inFlightRequests.set(requestKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (useSharedCache) {
      inFlightRequests.delete(requestKey);
    }
  }
};

export const isRateLimitError = (error: unknown): boolean => {
  return error instanceof FetchRecoveryError && error.status === 429;
};
