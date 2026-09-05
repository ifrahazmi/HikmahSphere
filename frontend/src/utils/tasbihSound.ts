type TasbihClickKind = 'bead' | 'checkpoint';

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  if (!audioContext) {
    audioContext = new Context();
  }
  return audioContext;
};

export const playTasbihClick = (kind: TasbihClickKind = 'bead'): void => {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume();
  }

  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = kind === 'checkpoint' ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(kind === 'checkpoint' ? 540 : 245, now);
  oscillator.frequency.exponentialRampToValueAtTime(kind === 'checkpoint' ? 210 : 88, now + 0.07);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(kind === 'checkpoint' ? 1800 : 900, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === 'checkpoint' ? 0.14 : 0.075, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'checkpoint' ? 0.16 : 0.08));

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
};
