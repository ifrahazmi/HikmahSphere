import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SpeakerWaveIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { playAdhanAudio, playAdhanFromUserGesture } from '../utils/adhanAudio';
import {
  ADHAN_PENDING_EVENT,
  clearPendingAdhan,
  formatPrayerLabel,
  isMobileDevice,
  parseAdhanQueryParams,
  peekPendingAdhan,
  queueAdhanPlayback,
  stripAdhanQueryParams,
  type PendingAdhan,
} from '../utils/adhanPlayback';

/**
 * Full-screen prompt shown after a prayer notification tap or ?playAdhan=1 URL.
 * Mobile always requires one more tap (user gesture) to start audio.
 */
const AdhanPlayPrompt: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingAdhan | null>(() => peekPendingAdhan());

  const dismiss = useCallback(() => {
    clearPendingAdhan();
    setPending(null);
  }, []);

  const showPending = useCallback((next: PendingAdhan) => {
    setPending(next);
    if (!isMobileDevice()) {
      playAdhanAudio();
    }
  }, []);

  const handlePlay = () => {
    playAdhanFromUserGesture();
    dismiss();
  };

  useEffect(() => {
    const onPending = (event: Event) => {
      const detail = (event as CustomEvent<PendingAdhan>).detail;
      if (detail) {
        showPending(detail);
      }
    };

    window.addEventListener(ADHAN_PENDING_EVENT, onPending);
    return () => window.removeEventListener(ADHAN_PENDING_EVENT, onPending);
  }, [showPending]);

  useEffect(() => {
    const { shouldPlay, prayer } = parseAdhanQueryParams(location.search);
    if (!shouldPlay) return;

    const stripped = stripAdhanQueryParams(location.search);
    const nextUrl = `${location.pathname}${stripped}${location.hash}`;
    navigate(nextUrl, { replace: true });

    showPending(queueAdhanPlayback(prayer, 'url'));
  }, [location.search, location.pathname, location.hash, navigate, showPending]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const stored = peekPendingAdhan();
      if (stored) {
        setPending(stored);
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!pending) return null;

  const prayerLabel = formatPrayerLabel(pending.prayer);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adhan-play-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-emerald-600 px-6 py-8 text-center text-white">
          <SpeakerWaveIcon className="mx-auto h-12 w-12 mb-3 opacity-90" aria-hidden="true" />
          <h2 id="adhan-play-title" className="text-xl font-bold">
            Time for {prayerLabel}
          </h2>
          <p className="mt-2 text-sm text-emerald-100">
            {isMobileDevice()
              ? 'Tap below to play the Adhan.'
              : 'Adhan is playing. Tap Play if you do not hear it.'}
          </p>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <button
            type="button"
            onClick={handlePlay}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Play Adhan
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdhanPlayPrompt;
