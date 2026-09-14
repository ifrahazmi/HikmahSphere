import { getHapticPattern, triggerHaptic, type HapticKind } from './hapticFeedback';

export type TasbihHapticKind = Extract<HapticKind, 'bead' | 'checkpoint'>;

export { canVibrate, isHapticEnabled } from './hapticFeedback';

export const getTasbihHapticPattern = (kind: TasbihHapticKind = 'bead'): number | number[] => {
  return getHapticPattern(kind);
};

export const vibrateTasbihClick = (kind: TasbihHapticKind = 'bead'): boolean => {
  return triggerHaptic(kind);
};
