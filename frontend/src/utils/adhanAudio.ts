/**
 * Shared Adhan audio helpers.
 * Full Adhan can only play while the page/PWA is open (or after the user taps
 * a notification). Background OS notifications cannot play custom long audio
 * on mobile Chrome/PWA — only the system ring.
 */

let globalAdhanAudio: HTMLAudioElement | null = null;
let audioUnlocked = false;

export const setupAdhanAudioUnlock = () => {
  if (typeof window === 'undefined' || audioUnlocked) return;

  const unlock = () => {
    try {
      const primer = new Audio('/sounds/adhan.mp3');
      primer.muted = true;
      primer.volume = 0;
      primer
        .play()
        .then(() => {
          primer.pause();
          primer.currentTime = 0;
          audioUnlocked = true;
        })
        .catch(() => {
          audioUnlocked = true;
        });
    } catch {
      audioUnlocked = true;
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
};

export const playAdhanAudio = (options?: { maxDurationMs?: number }) => {
  const maxDurationMs = options?.maxDurationMs ?? 20000;

  try {
    if (globalAdhanAudio) {
      globalAdhanAudio.pause();
      globalAdhanAudio.currentTime = 0;
    }

    globalAdhanAudio = new Audio('/sounds/adhan.mp3');
    globalAdhanAudio.volume = 0.8;
    globalAdhanAudio.play().catch((err) => {
      console.warn('[Adhan] Audio play failed (autoplay may be blocked until user interacts):', err);
    });

    window.setTimeout(() => {
      if (globalAdhanAudio) {
        globalAdhanAudio.pause();
        globalAdhanAudio.currentTime = 0;
      }
    }, maxDurationMs);
  } catch (err) {
    console.warn('[Adhan] Error creating audio element:', err);
  }
};

export const stopAdhanAudio = () => {
  if (!globalAdhanAudio) return;
  globalAdhanAudio.pause();
  globalAdhanAudio.currentTime = 0;
};
