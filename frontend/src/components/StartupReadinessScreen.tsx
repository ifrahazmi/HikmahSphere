import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Database,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  StartupReadinessState,
  StartupStep,
  StartupStepKey,
} from '../hooks/useStartupReadiness';

type StartupReadinessScreenProps = {
  state: StartupReadinessState;
  authReady: boolean;
  onRetry: () => void;
};

const stepDetails: Array<{
  key: StartupStepKey;
  label: string;
  icon: LucideIcon;
}> = [
  { key: 'internet', label: 'Internet connection', icon: Wifi },
  { key: 'frontend', label: 'HikmahSphere app', icon: MonitorSmartphone },
  { key: 'backend', label: 'HikmahSphere server', icon: Server },
  { key: 'database', label: 'Secure database', icon: Database },
];

const StatusIcon: React.FC<{ step: StartupStep }> = ({ step }) => {
  if (step.status === 'success') {
    return <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden />;
  }
  if (step.status === 'error') {
    return <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden />;
  }
  if (step.status === 'checking') {
    return <Loader2 className="h-6 w-6 animate-spin text-emerald-600 motion-reduce:animate-none" aria-hidden />;
  }
  if (step.status === 'slow') {
    return <Loader2 className="h-6 w-6 animate-spin text-amber-500 motion-reduce:animate-none" aria-hidden />;
  }
  return <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600" aria-hidden />;
};

const StartupReadinessScreen: React.FC<StartupReadinessScreenProps> = ({
  state,
  authReady,
  onRetry,
}) => {
  const isOffline = state.outcome === 'offline';
  const isFailure = state.outcome === 'failed';
  const isTerminal = isOffline || isFailure;
  const checksReady = state.outcome === 'ready';

  const heading = isOffline
    ? 'You appear to be offline'
    : isFailure
      ? 'HikmahSphere needs another moment'
      : checksReady && !authReady
        ? 'Restoring your session'
        : 'Preparing HikmahSphere';

  const description = isOffline
    ? 'Check Wi-Fi or mobile data, then try again.'
    : isFailure
      ? 'We could not prepare every service within 30 seconds.'
      : checksReady && !authReady
        ? 'All services are ready. We are securely restoring your account.'
        : 'Running a quick connection and service check before opening the app.';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-6 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950 dark:text-white sm:px-6">
      <main className="mx-auto flex min-h-full w-full max-w-lg items-center justify-center">
        <section
          className="w-full overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90 sm:p-7"
          aria-labelledby="startup-heading"
          aria-describedby="startup-description"
        >
          <div className="text-center">
            {!isOffline && (
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 ring-1 ring-emerald-100 dark:bg-emerald-950/70 dark:ring-emerald-800/60">
                <img
                  src="/logo.png"
                  alt=""
                  className="h-16 w-16 object-contain"
                  aria-hidden="true"
                />
              </div>
            )}

            {isOffline && (
              <img
                src="/disconnect.png"
                alt="No internet connection"
                className="mx-auto mb-4 max-h-40 w-auto max-w-[70%] object-contain"
              />
            )}

            <p className="mb-1 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
              Startup check
            </p>
            <h1 id="startup-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {heading}
            </h1>
            <p id="startup-description" className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>

          <div
            className="mt-6 space-y-3"
            role="status"
            aria-live="polite"
            aria-atomic="false"
          >
            {stepDetails.map(({ key, label, icon: StepIcon }, index) => {
              const step = state.steps[key];
              return (
                <div
                  key={key}
                  className={`relative flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    step.status === 'success'
                      ? 'border-emerald-100 bg-emerald-50/80 dark:border-emerald-900 dark:bg-emerald-950/50'
                      : step.status === 'error'
                        ? 'border-rose-100 bg-rose-50/80 dark:border-rose-900 dark:bg-rose-950/40'
                        : step.status === 'slow'
                          ? 'border-amber-100 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/40'
                          : 'border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                    <StepIcon className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h2 className="truncate text-sm font-semibold">{label}</h2>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {step.message}
                    </p>
                  </div>
                  <StatusIcon step={step} />
                </div>
              );
            })}
          </div>

          {checksReady && !authReady && (
            <p className="mt-5 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Finishing securely…
            </p>
          )}

          {isTerminal && (
            <div className="mt-6">
              <button
                type="button"
                onClick={onRetry}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/20 transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300 active:scale-[0.99] dark:focus-visible:ring-emerald-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry startup check
              </button>
              <div className="mt-4 flex items-start justify-center gap-2 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>If the issue continues, fully close HikmahSphere and open it again.</p>
              </div>
            </div>
          )}

          {!isTerminal && !checksReady && (
            <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
              This check stops automatically after 30 seconds.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};

export default StartupReadinessScreen;
