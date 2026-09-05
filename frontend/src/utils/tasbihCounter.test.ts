import {
  applyTasbihStep,
  buildThreadPath,
  consumeBeadScroll,
  getBeadArcPosition,
  getVisibleBeadNumber,
  isTasbihCheckpoint,
  resolveSingleBeadStep,
} from './tasbihCounter';

const PRESETS = [
  { id: 'subhanallah', target: 33 },
  { id: 'alhamdulillah', target: 33 },
  { id: 'allahu-akbar', target: 34 },
  { id: 'astaghfirullah', target: 100 },
];

describe('applyTasbihStep', () => {
  it('increments the current dhikr without switching early', () => {
    const result = applyTasbihStep({
      presetId: 'subhanallah',
      count: 10,
      dailyCounts: { subhanallah: 10 },
      direction: 1,
      presets: PRESETS,
    });

    expect(result).toEqual({
      presetId: 'subhanallah',
      count: 11,
      dailyCounts: { subhanallah: 11 },
      advanced: false,
      checkpoint: false,
    });
  });

  it('advances SubhanAllah -> Alhamdulillah after 33', () => {
    const result = applyTasbihStep({
      presetId: 'subhanallah',
      count: 32,
      dailyCounts: { subhanallah: 32 },
      direction: 1,
      presets: PRESETS,
    });

    expect(result.presetId).toBe('alhamdulillah');
    expect(result.count).toBe(0);
    expect(result.dailyCounts.subhanallah).toBe(33);
    expect(result.advanced).toBe(true);
    expect(result.checkpoint).toBe(true);
  });

  it('advances Alhamdulillah -> Allahu Akbar after 33', () => {
    const result = applyTasbihStep({
      presetId: 'alhamdulillah',
      count: 32,
      dailyCounts: { subhanallah: 33, alhamdulillah: 32 },
      direction: 1,
      presets: PRESETS,
    });

    expect(result.presetId).toBe('allahu-akbar');
    expect(result.count).toBe(0);
    expect(result.dailyCounts.alhamdulillah).toBe(33);
  });

  it('wraps Allahu Akbar -> SubhanAllah after 34', () => {
    const result = applyTasbihStep({
      presetId: 'allahu-akbar',
      count: 33,
      dailyCounts: { 'allahu-akbar': 33 },
      direction: 1,
      presets: PRESETS,
    });

    expect(result.presetId).toBe('subhanallah');
    expect(result.count).toBe(0);
    expect(result.dailyCounts['allahu-akbar']).toBe(34);
  });

  it('applies rapid successive increments without skipping a dhikr', () => {
    let state: {
      presetId: string;
      count: number;
      dailyCounts: Record<string, number>;
    } = {
      presetId: 'subhanallah',
      count: 31,
      dailyCounts: { subhanallah: 31, alhamdulillah: 0, 'allahu-akbar': 0 },
    };

    for (let index = 0; index < 4; index += 1) {
      state = applyTasbihStep({
        ...state,
        direction: 1,
        presets: PRESETS,
      });
    }

    expect(state.presetId).toBe('alhamdulillah');
    expect(state.count).toBe(2);
    expect(state.dailyCounts.subhanallah).toBe(33);
    expect(state.dailyCounts.alhamdulillah).toBe(2);
  });

  it('undoes an auto-advance back onto the previous dhikr', () => {
    const result = applyTasbihStep({
      presetId: 'alhamdulillah',
      count: 0,
      dailyCounts: { subhanallah: 33, alhamdulillah: 0 },
      direction: -1,
      presets: PRESETS,
    });

    expect(result.presetId).toBe('subhanallah');
    expect(result.count).toBe(32);
    expect(result.dailyCounts.subhanallah).toBe(32);
    expect(result.advanced).toBe(true);
  });
});

describe('checkpoint and arc geometry', () => {
  it('marks every 33rd bead as a checkpoint', () => {
    expect(isTasbihCheckpoint(0)).toBe(false);
    expect(isTasbihCheckpoint(32)).toBe(false);
    expect(isTasbihCheckpoint(33)).toBe(true);
    expect(isTasbihCheckpoint(66)).toBe(true);
  });

  it('places the 33rd checkpoint on the thumb stone after 32 counts', () => {
    expect(getVisibleBeadNumber(32, 3, 7)).toBe(33);
    expect(isTasbihCheckpoint(getVisibleBeadNumber(32, 3, 7))).toBe(true);
    expect(isTasbihCheckpoint(getVisibleBeadNumber(31, 3, 7))).toBe(false);
  });

  it('bows the thread toward the selected thumb', () => {
    const rightCenter = getBeadArcPosition(4, 9, { width: 200, height: 320, handedness: 'right' });
    const leftCenter = getBeadArcPosition(4, 9, { width: 200, height: 320, handedness: 'left' });
    const rightEnd = getBeadArcPosition(0, 9, { width: 200, height: 320, handedness: 'right' });

    expect(rightCenter.x).toBeGreaterThan(100);
    expect(leftCenter.x).toBeLessThan(100);
    expect(rightCenter.x).toBeGreaterThan(rightEnd.x);
  });

  it('builds a thread path through the beads', () => {
    const path = buildThreadPath([
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(path.startsWith('M 10.00 0.00')).toBe(true);
    expect(path).toContain('C');
  });
});

describe('consumeBeadScroll', () => {
  it('emits at most one forward step even on a long swipe', () => {
    expect(consumeBeadScroll(35).steps).toBe(0);
    expect(consumeBeadScroll(36)).toEqual({ remaining: 0, steps: 1 });
    expect(consumeBeadScroll(80)).toEqual({ remaining: 0, steps: 1 });
  });

  it('emits reverse steps when scrolling up', () => {
    expect(consumeBeadScroll(-36)).toEqual({ remaining: 0, steps: -1 });
    expect(consumeBeadScroll(-20).steps).toBe(0);
  });

  it('resolves one screen scroll to one stone', () => {
    expect(resolveSingleBeadStep(10)).toBe(0);
    expect(resolveSingleBeadStep(32)).toBe(1);
    expect(resolveSingleBeadStep(180)).toBe(1);
    expect(resolveSingleBeadStep(-40)).toBe(-1);
  });
});
