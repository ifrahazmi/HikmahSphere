import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, ExternalLink, X } from 'lucide-react';
import PingzoStatusWidget, { PingzoStatus } from './PingzoStatusWidget';

export interface ServerStatusModalProps {
  forceOpen?: boolean;
  serverHasIssue?: boolean;
  issueDescription?: string;
  onClose?: () => void;
}

const SESSION_DISMISS_KEY = 'pingzo_server_issue_dismissed_session';

export const ServerStatusModal: React.FC<ServerStatusModalProps> = ({
  forceOpen = false,
  serverHasIssue = false,
  issueDescription,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pingzoStatus, setPingzoStatus] = useState<PingzoStatus>('loading');

  const isDismissedThisVisit = useCallback(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, 'true');
    } catch {
      // Ignore sessionStorage errors
    }
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  // Determine if popup should appear
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    if (isDismissedThisVisit()) {
      return;
    }

    // Pingzo indicates issue or local probe indicates issue
    const pingzoHasIssue =
      pingzoStatus !== 'loading' &&
      pingzoStatus !== 'green';

    if (pingzoHasIssue || serverHasIssue) {
      setIsOpen(true);
    }
  }, [forceOpen, serverHasIssue, pingzoStatus, isDismissedThisVisit]);

  // Close on ESC key for Windows/Desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  return (
    <>
      {/* Invisible listener widget to continuously monitor Pingzo status */}
      <div className="sr-only" aria-hidden="true">
        <PingzoStatusWidget onStatusChange={setPingzoStatus} />
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="server-status-title"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-rose-200/50 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-rose-900/40 dark:bg-slate-900/95 sm:rounded-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400 ring-1 ring-rose-100 dark:ring-rose-800/40">
                  <AlertCircle className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    System Notice
                  </span>
                  <h3 id="server-status-title" className="text-lg font-bold text-slate-900 dark:text-white">
                    Server Status Alert
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                aria-label="Close status alert"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {issueDescription ||
                'The server is currently waking up or experiencing an issue. Real-time updates and incident reports are available on our status page.'}
            </p>

            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="mb-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Current Live Status
              </span>
              <PingzoStatusWidget variant="badge" />
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-center gap-2.5">
              <a
                href="https://pingzoapp.vercel.app/status/ifrahuddin-azmi"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-700 active:scale-[0.99] transition"
              >
                <span>View Status Page</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full sm:w-auto shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/70 transition"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
              This notice shows once per visit.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default ServerStatusModal;
