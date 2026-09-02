import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBackendReadinessUrl } from '../config';

export type StartupStepKey = 'internet' | 'frontend' | 'backend' | 'database';
export type StartupStepStatus = 'waiting' | 'checking' | 'slow' | 'success' | 'error';
export type StartupOutcome = 'checking' | 'ready' | 'offline' | 'failed';

export type StartupStep = {
  status: StartupStepStatus;
  message: string;
};

export type StartupReadinessState = {
  outcome: StartupOutcome;
  steps: Record<StartupStepKey, StartupStep>;
};

const SLOW_AFTER_MS = 5_000;
const MIN_CHECK_SCREEN_MS = 2_000;
const OFFLINE_AFTER_MS = 15_000;
const ATTEMPT_BUDGET_MS = 30_000;
const RETRY_DELAY_MS = 1_500;
const ONLINE_PROBE_MARKER = 'hikmahsphere-online';

const initialSteps = (): Record<StartupStepKey, StartupStep> => ({
  internet: { status: 'checking', message: 'Checking your connection…' },
  frontend: { status: 'checking', message: 'Verifying app files…' },
  backend: { status: 'waiting', message: 'Waiting to reach the server…' },
  database: { status: 'waiting', message: 'Waiting for the server…' },
});

export const isInstalledMobilePwa = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const userAgent = navigator.userAgent || '';
  const iPadOs =
    navigator.platform === 'MacIntel'
    && typeof navigator.maxTouchPoints === 'number'
    && navigator.maxTouchPoints > 1;
  const mobile = /Android|iPhone|iPad|iPod/i.test(userAgent) || iPadOs;

  return standalone && mobile;
};

const isReadinessPayload = (value: unknown): value is {
  services: { backend: 'operational'; database: 'operational' | 'unavailable' };
} => {
  if (!value || typeof value !== 'object') return false;
  const services = (value as { services?: unknown }).services;
  if (!services || typeof services !== 'object') return false;
  const typed = services as { backend?: unknown; database?: unknown };
  return typed.backend === 'operational'
    && (typed.database === 'operational' || typed.database === 'unavailable');
};

export const useStartupReadiness = (enabled = isInstalledMobilePwa()) => {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<StartupReadinessState>(() => ({
    outcome: enabled ? 'checking' : 'ready',
    steps: initialSteps(),
  }));

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState((current) => current.outcome === 'ready'
        ? current
        : { outcome: 'ready', steps: initialSteps() });
      return;
    }

    let stopped = false;
    let terminal = false;
    let networkReady = false;
    let frontendReady = false;
    let backendReady = false;
    let databaseReady = false;
    let frontendProbeInFlight = false;
    let backendProbeInFlight = false;
    let readyPending = false;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timers = new Set<number>();

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        callback();
      }, delayMs);
      timers.add(timer);
    };

    const updateStep = (key: StartupStepKey, step: StartupStep) => {
      if (stopped || terminal) return;
      setState((current) => ({
        ...current,
        steps: { ...current.steps, [key]: step },
      }));
    };

    const markInternetReady = () => {
      if (networkReady || terminal) return;
      networkReady = true;
      updateStep('internet', { status: 'success', message: 'Internet connected' });
    };

    const finishIfReady = () => {
      if (terminal || readyPending || !networkReady || !frontendReady || !backendReady || !databaseReady) {
        return;
      }
      readyPending = true;
      const remainingMs = Math.max(0, MIN_CHECK_SCREEN_MS - (Date.now() - startedAt));
      schedule(() => {
        if (stopped || terminal) return;
        terminal = true;
        controller.abort();
        timers.forEach((timer) => window.clearTimeout(timer));
        timers.clear();
        setState((current) => ({ ...current, outcome: 'ready' }));
      }, remainingMs);
    };

    const probeFrontend = async () => {
      if (stopped || terminal || frontendReady || frontendProbeInFlight || !navigator.onLine) {
        return;
      }
      frontendProbeInFlight = true;
      try {
        const response = await fetch(`/online-check.txt?attempt=${attempt}&t=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'omit',
          signal: controller.signal,
        });
        const text = await response.text();
        if (!response.ok || text.trim() !== ONLINE_PROBE_MARKER) {
          throw new Error('Unexpected frontend probe response');
        }
        markInternetReady();
        frontendReady = true;
        updateStep('frontend', { status: 'success', message: 'App interface loaded' });
        finishIfReady();
      } catch {
        if (!stopped && !terminal && !controller.signal.aborted) {
          schedule(() => void probeFrontend(), RETRY_DELAY_MS);
        }
      } finally {
        frontendProbeInFlight = false;
      }
    };

    const probeBackend = async () => {
      if (stopped || terminal || databaseReady || backendProbeInFlight || !navigator.onLine) {
        return;
      }
      backendProbeInFlight = true;
      try {
        const response = await fetch(getBackendReadinessUrl(), {
          cache: 'no-store',
          credentials: 'omit',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        markInternetReady();

        const payload: unknown = await response.json();
        if (!isReadinessPayload(payload)) {
          throw new Error('Unexpected readiness response');
        }

        backendReady = true;
        updateStep('backend', { status: 'success', message: 'Server is responding' });

        if (payload.services.database === 'operational') {
          databaseReady = true;
          updateStep('database', { status: 'success', message: 'Database connected' });
          finishIfReady();
        } else {
          const slow = Date.now() - startedAt >= SLOW_AFTER_MS;
          updateStep('database', {
            status: slow ? 'slow' : 'checking',
            message: 'Waiting for the database…',
          });
        }
      } catch {
        if (!stopped && !terminal && !controller.signal.aborted) {
          const slow = Date.now() - startedAt >= SLOW_AFTER_MS;
          updateStep('backend', {
            status: slow ? 'slow' : 'checking',
            message: slow ? 'Server is waking up…' : 'Connecting to the server…',
          });
        }
      } finally {
        backendProbeInFlight = false;
        if (!stopped && !terminal && !databaseReady) {
          schedule(() => void probeBackend(), RETRY_DELAY_MS);
        }
      }
    };

    const startAvailableProbes = () => {
      if (terminal || stopped || !navigator.onLine) return;
      void probeFrontend();
      void probeBackend();
    };

    setState({ outcome: 'checking', steps: initialSteps() });

    schedule(() => {
      if (terminal) return;
      setState((current) => {
        const steps = { ...current.steps };
        if (!networkReady) {
          steps.internet = { status: 'slow', message: 'Your connection is taking longer than usual…' };
        }
        if (!frontendReady) {
          steps.frontend = { status: 'slow', message: 'App files are loading slowly…' };
        }
        if (!backendReady) {
          steps.backend = { status: 'slow', message: 'Server is waking up…' };
        }
        if (backendReady && !databaseReady) {
          steps.database = { status: 'slow', message: 'Database is taking longer than usual…' };
        }
        return { ...current, steps };
      });
    }, SLOW_AFTER_MS);

    schedule(() => {
      if (terminal || networkReady) return;
      terminal = true;
      controller.abort();
      setState((current) => ({
        outcome: 'offline',
        steps: {
          ...current.steps,
          internet: { status: 'error', message: 'Internet is unavailable' },
          frontend: { status: 'waiting', message: 'Waiting for internet' },
          backend: { status: 'waiting', message: 'Waiting for internet' },
          database: { status: 'waiting', message: 'Waiting for internet' },
        },
      }));
    }, OFFLINE_AFTER_MS);

    schedule(() => {
      if (terminal) return;
      terminal = true;
      controller.abort();
      setState((current) => {
        const steps = { ...current.steps };
        if (!frontendReady) {
          steps.frontend = { status: 'error', message: 'App files could not be verified' };
        }
        if (!backendReady) {
          steps.backend = { status: 'error', message: 'Server could not be reached' };
        }
        if (!databaseReady) {
          steps.database = {
            status: 'error',
            message: backendReady ? 'Database is unavailable' : 'Database could not be checked',
          };
        }
        return { outcome: 'failed', steps };
      });
    }, ATTEMPT_BUDGET_MS);

    const onOnline = () => {
      if (terminal) {
        if (!stopped) {
          setState((current) => current.outcome === 'offline'
            ? {
                ...current,
                steps: {
                  ...current.steps,
                  internet: { status: 'error', message: 'Connection detected — tap Retry' },
                },
              }
            : current);
        }
        return;
      }
      startAvailableProbes();
    };
    const onOffline = () => {
      if (!terminal) {
        updateStep('internet', { status: 'slow', message: 'Connection lost — waiting to reconnect…' });
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    startAvailableProbes();

    return () => {
      stopped = true;
      controller.abort();
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [attempt, enabled]);

  return useMemo(() => ({
    enabled,
    state,
    retry,
  }), [enabled, retry, state]);
};

