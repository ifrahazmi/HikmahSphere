/**
 * Shared Adhan audio helpers.
 * Full Adhan can only play while the page/PWA is open (or after the user taps
 * a notification). Background OS notifications cannot play custom long audio
 * on mobile Chrome/PWA — only the system ring.
 */

const ADHAN_SRC = '/sounds/adhan.mp3';

let globalAdhanAudio: HTMLAudioElement | null = null;
let preloadedAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;
let stopTimer: number | null = null;

const clearStopTimer = () => {
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
};

export const preloadAdhanAudio = (): void => {
  if (typeof window === 'undefined' || preloadedAudio) return;

  try {
    preloadedAudio = new Audio(ADHAN_SRC);
    preloadedAudio.preload = 'auto';
    preloadedAudio.load();
  } catch (err) {
    console.warn('[Adhan] Preload failed:', err);
  }
};

export const setupAdhanAudioUnlock = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;

  const unlock = () => {
    try {
      const primer = preloadedAudio || new Audio(ADHAN_SRC);
      primer.muted = true;
      primer.volume = 0;
      primer
        .play()
        .then(() => {
          primer.pause();
          primer.currentTime = 0;
          audioUnlocked = true;
          preloadAdhanAudio();
        })
        .catch(() => {
          audioUnlocked = true;
          preloadAdhanAudio();
        });
    } catch {
      audioUnlocked = true;
      preloadAdhanAudio();
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
};

const createPlaybackAudio = (): HTMLAudioElement => {
  if (preloadedAudio) {
    const audio = preloadedAudio;
    preloadedAudio = null;
    return audio;
  }
  return new Audio(ADHAN_SRC);
};

const startPlayback = (
  audio: HTMLAudioElement,
  maxDurationMs?: number
): void => {
  clearStopTimer();

  if (globalAdhanAudio) {
    globalAdhanAudio.pause();
    globalAdhanAudio.currentTime = 0;
  }

  globalAdhanAudio = audio;
  globalAdhanAudio.volume = 0.8;

  const playPromise = globalAdhanAudio.play();
  if (playPromise) {
    playPromise
      .then(() => {
        console.log('[Adhan] Playback started');
      })
      .catch((err) => {
        console.warn('[Adhan] Audio play failed (autoplay may be blocked until user interacts):', err);
      });
  }

  if (maxDurationMs && maxDurationMs > 0) {
    stopTimer = window.setTimeout(() => {
      stopAdhanAudio();
    }, maxDurationMs);
  } else {
    globalAdhanAudio.addEventListener(
      'ended',
      () => {
        globalAdhanAudio = null;
      },
      { once: true }
    );
  }
};

/** Call only from a direct user gesture (button onClick) for reliable mobile playback. */
export const playAdhanFromUserGesture = (): void => {
  try {
    const audio = createPlaybackAudio();
    startPlayback(audio);
  } catch (err) {
    console.warn('[Adhan] Error creating audio element:', err);
  }
};

export const playAdhanAudio = (options?: { maxDurationMs?: number }) => {
  const maxDurationMs = options?.maxDurationMs ?? 0;

  try {
    const audio = createPlaybackAudio();
    startPlayback(audio, maxDurationMs > 0 ? maxDurationMs : undefined);
  } catch (err) {
    console.warn('[Adhan] Error creating audio element:', err);
  }
};

export const stopAdhanAudio = () => {
  clearStopTimer();
  if (!globalAdhanAudio) return;
  globalAdhanAudio.pause();
  globalAdhanAudio.currentTime = 0;
  globalAdhanAudio = null;
  preloadAdhanAudio();
};
