export const CLASSIC_TASBIH_IDS = ['subhanallah', 'alhamdulillah', 'allahu-akbar'] as const;
export const TASBIH_BEAD_STEP_PX = 36;
export const TASBIH_SINGLE_GESTURE_PX = 32;
export const TASBIH_CHECKPOINT_INTERVAL = 33;

export type TasbihHandedness = 'right' | 'left';

export const isTasbihCheckpoint = (
  beadIndex: number,
  interval = TASBIH_CHECKPOINT_INTERVAL
): boolean => {
  return Number.isInteger(beadIndex) && beadIndex > 0 && beadIndex % interval === 0;
};

export const getVisibleBeadNumber = (
  threadTicks: number,
  slotIndex: number,
  visibleBeads = 7
): number => {
  const mid = Math.floor(visibleBeads / 2);
  return threadTicks + (slotIndex - mid) + 1;
};

export const getBeadArcPosition = (
  index: number,
  total: number,
  options: {
    width: number;
    height: number;
    handedness: TasbihHandedness;
    shiftPx?: number;
    amplitude?: number;
  }
): { x: number; y: number } => {
  const mid = Math.max(1, (total - 1) / 2);
  const t = (index - mid) / mid;
  const spacing = options.height / Math.max(1, total);
  const bulge = options.handedness === 'right' ? 1 : -1;
  const amplitude = options.amplitude ?? Math.min(52, options.width * 0.28);
  return {
    x: options.width / 2 + bulge * amplitude * (1 - t * t),
    y: (index + 0.5) * spacing + (options.shiftPx || 0),
  };
};

export const buildThreadPath = (
  points: Array<{ x: number; y: number }>
): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  const [first, ...rest] = points;
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  rest.forEach((point, index) => {
    const previous = index === 0 ? first : rest[index - 1];
    const midY = (previous.y + point.y) / 2;
    path += ` C ${previous.x.toFixed(2)} ${midY.toFixed(2)}, ${point.x.toFixed(2)} ${midY.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  });
  return path;
};

export type TasbihPresetTarget = {
  id: string;
  target: number;
};

export type TasbihStepResult = {
  presetId: string;
  count: number;
  dailyCounts: Record<string, number>;
  advanced: boolean;
  checkpoint: boolean;
};

const getPresetTarget = (presets: TasbihPresetTarget[], presetId: string): number => {
  return presets.find((preset) => preset.id === presetId)?.target || 33;
};

const bumpDailyCount = (
  counts: Record<string, number>,
  presetId: string,
  delta: number
): Record<string, number> => {
  const next = Math.max(0, (counts[presetId] || 0) + delta);
  return {
    ...counts,
    [presetId]: next,
  };
};

export const applyTasbihStep = (input: {
  presetId: string;
  count: number;
  dailyCounts: Record<string, number>;
  direction: 1 | -1;
  presets: TasbihPresetTarget[];
}): TasbihStepResult => {
  const { presetId, count, dailyCounts, direction, presets } = input;
  const classicIndex = CLASSIC_TASBIH_IDS.indexOf(presetId as (typeof CLASSIC_TASBIH_IDS)[number]);
  const target = getPresetTarget(presets, presetId);

  if (direction > 0) {
    const nextCount = count + 1;
    const shouldAdvance = classicIndex >= 0 && nextCount >= target;
    if (!shouldAdvance) {
      return {
        presetId,
        count: nextCount,
        dailyCounts: bumpDailyCount(dailyCounts, presetId, 1),
        advanced: false,
        checkpoint: isTasbihCheckpoint(nextCount),
      };
    }

    const nextPresetId = CLASSIC_TASBIH_IDS[(classicIndex + 1) % CLASSIC_TASBIH_IDS.length];
    return {
      presetId: nextPresetId,
      count: 0,
      dailyCounts: bumpDailyCount(dailyCounts, presetId, 1),
      advanced: true,
      checkpoint: true,
    };
  }

  if (count > 0) {
    return {
      presetId,
      count: count - 1,
      dailyCounts: bumpDailyCount(dailyCounts, presetId, -1),
      advanced: false,
      checkpoint: false,
    };
  }

  if (classicIndex > 0) {
    const previousPresetId = CLASSIC_TASBIH_IDS[classicIndex - 1];
    const previousTarget = getPresetTarget(presets, previousPresetId);
    return {
      presetId: previousPresetId,
      count: Math.max(0, previousTarget - 1),
      dailyCounts: bumpDailyCount(dailyCounts, previousPresetId, -1),
      advanced: true,
      checkpoint: false,
    };
  }

  return {
    presetId,
    count: 0,
    dailyCounts,
    advanced: false,
    checkpoint: false,
  };
};

export const consumeBeadScroll = (
  accumulatedPx: number,
  stepPx = TASBIH_BEAD_STEP_PX
): { remaining: number; steps: number } => {
  if (!Number.isFinite(accumulatedPx) || stepPx <= 0) {
    return { remaining: 0, steps: 0 };
  }

  const rawSteps =
    accumulatedPx >= 0
      ? Math.floor(accumulatedPx / stepPx)
      : Math.ceil(accumulatedPx / stepPx);
  const uncapped = rawSteps === 0 ? 0 : rawSteps;
  const steps = uncapped === 0 ? 0 : uncapped > 0 ? 1 : -1;

  return {
    remaining: 0,
    steps,
  };
};

export const resolveSingleBeadStep = (
  deltaY: number,
  thresholdPx = TASBIH_SINGLE_GESTURE_PX
): 1 | -1 | 0 => {
  if (!Number.isFinite(deltaY) || thresholdPx <= 0) {
    return 0;
  }
  if (deltaY >= thresholdPx) return 1;
  if (deltaY <= -thresholdPx) return -1;
  return 0;
};
