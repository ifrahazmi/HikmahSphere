const FUNNEL_TAFSIR_BASE = 'https://aws-vm.reedfish-temperature.ts.net/api';
const MAGICDNS_TAFSIR_BASE = 'http://aws-vm.reedfish-temperature.ts.net:8080/api';
const TAILSCALE_IP_TAFSIR_BASE = 'http://100.95.236.21:8080/api';

export const DEFAULT_TAFSIR_UPSTREAMS = [
  FUNNEL_TAFSIR_BASE,
  MAGICDNS_TAFSIR_BASE,
  TAILSCALE_IP_TAFSIR_BASE,
];

export const DEFAULT_MAUDUDI_UPSTREAMS = DEFAULT_TAFSIR_UPSTREAMS.map(
  (base) => `${base.replace(/\/$/, '')}/maududi`
);

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/i;

export const isLocalTafsirUrl = (url?: string | null): boolean => {
  return Boolean(url && LOCAL_HOST_RE.test(url));
};

export const normalizeUpstreamBase = (url?: string | null): string => {
  return (url || '').trim().replace(/\/$/, '');
};

export const resolveTafsirUpstreamCandidates = (options: {
  configured?: string | null;
  defaults?: string[];
  nodeEnv?: string;
}): string[] => {
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV ?? '';
  const defaults = options.defaults ?? DEFAULT_TAFSIR_UPSTREAMS;
  const seen = new Set<string>();
  const candidates: string[] = [];

  const add = (url?: string | null) => {
    const normalized = normalizeUpstreamBase(url);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    // Render (and any production host) cannot reach the developer's localhost.
    if (nodeEnv === 'production' && isLocalTafsirUrl(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  add(options.configured);
  defaults.forEach(add);
  return candidates;
};

export const isNonTafsirAuthWall = (status: number, payload: unknown): boolean => {
  if (status !== 401 && status !== 403 && status !== 302) {
    return false;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return true;
  }
  const record = payload as Record<string, unknown>;
  // code-server and similar login walls: {"error":"Unauthorized"}
  return record.error === 'Unauthorized' && !record.status && !record.data;
};

type UpstreamFetchResult = {
  ok: boolean;
  status: number;
  payload: any;
  base: string;
};

const UPSTREAM_TIMEOUT_MS = 8_000;

export const fetchFromTafsirUpstreams = async (
  path: string,
  query: string,
  bases: string[]
): Promise<UpstreamFetchResult> => {
  let lastFailure: { status: number; payload: any; base: string } | null = null;
  let lastNetworkError: Error | null = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const response = await fetch(`${base}${path}${query}`, { signal: controller.signal });
      const payload: any = await response.json().catch(() => null);

      if (isNonTafsirAuthWall(response.status, payload)) {
        lastFailure = { status: response.status, payload, base };
        continue;
      }

      return {
        ok: response.ok,
        status: response.status,
        payload,
        base,
      };
    } catch (error: any) {
      lastNetworkError = error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastFailure) {
    return {
      ok: false,
      status: lastFailure.status,
      payload: lastFailure.payload,
      base: lastFailure.base,
    };
  }

  throw lastNetworkError || new Error('All tafsir upstreams failed');
};
