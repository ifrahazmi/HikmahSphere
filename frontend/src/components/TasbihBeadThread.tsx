import React, { useCallback, useMemo, useRef } from 'react';
import {
  buildThreadPath,
  getBeadArcPosition,
  getVisibleBeadNumber,
  isTasbihCheckpoint,
  resolveSingleBeadStep,
  TASBIH_SINGLE_GESTURE_PX,
  type TasbihHandedness,
} from '../utils/tasbihCounter';

const VISIBLE_BEADS = 7;
const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 340;
const WHEEL_LOCK_MS = 280;

type TasbihBeadThreadProps = {
  count: number;
  threadTicks: number;
  isDark: boolean;
  handedness: TasbihHandedness;
  onStep: (direction: 1 | -1) => void;
};

const stoneFill = (isDark: boolean, variant: 0 | 1): string => {
  if (isDark) {
    return variant === 0
      ? 'url(#stoneDarkA)'
      : 'url(#stoneDarkB)';
  }
  return variant === 0 ? 'url(#stoneLightA)' : 'url(#stoneLightB)';
};

const TasbihBeadThread: React.FC<TasbihBeadThreadProps> = ({
  count,
  threadTicks,
  isDark,
  handedness,
  onStep,
}) => {
  const pointerRef = useRef<{ pointerId: number; startY: number; stepped: boolean } | null>(null);
  const svgRef = useRef<SVGGElement | null>(null);
  const wheelLockRef = useRef(false);
  const wheelUnlockTimerRef = useRef<number | null>(null);

  const setPreviewShift = (pixels: number) => {
    if (svgRef.current) {
      svgRef.current.style.setProperty('--bead-shift', `${pixels}px`);
    }
  };

  const commitOneStone = useCallback((direction: 1 | -1) => {
    setPreviewShift(0);
    onStep(direction);
  }, [onStep]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerRef.current = { pointerId: event.pointerId, startY: event.clientY, stepped: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const motion = pointerRef.current;
    if (!motion || motion.pointerId !== event.pointerId) return;
    const totalDelta = event.clientY - motion.startY;
    const preview = Math.max(-TASBIH_SINGLE_GESTURE_PX, Math.min(TASBIH_SINGLE_GESTURE_PX, totalDelta));
    setPreviewShift(motion.stepped ? 0 : preview);
    if (motion.stepped) return;
    const direction = resolveSingleBeadStep(totalDelta);
    if (!direction) return;
    motion.stepped = true;
    commitOneStone(direction);
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const motion = pointerRef.current;
    if (!motion || motion.pointerId !== event.pointerId) return;
    if (!motion.stepped) {
      const direction = resolveSingleBeadStep(event.clientY - motion.startY, TASBIH_SINGLE_GESTURE_PX * 0.75);
      if (direction) {
        commitOneStone(direction);
      }
    }
    setPreviewShift(0);
    pointerRef.current = null;
  };

  const beads = useMemo(() => {
    const mid = Math.floor(VISIBLE_BEADS / 2);
    return Array.from({ length: VISIBLE_BEADS }, (_, index) => {
      const beadNumber = getVisibleBeadNumber(threadTicks, index, VISIBLE_BEADS);
      const position = getBeadArcPosition(index, VISIBLE_BEADS, {
        width: VIEW_WIDTH,
        height: VIEW_HEIGHT,
        handedness,
      });
      return {
        index,
        beadIndex: beadNumber,
        ...position,
        checkpoint: isTasbihCheckpoint(beadNumber),
        isThumb: index === mid,
      };
    });
  }, [handedness, threadTicks]);

  const threadPath = useMemo(
    () => buildThreadPath(beads.map((bead) => ({ x: bead.x, y: bead.y }))),
    [beads]
  );

  const thumbBead = beads.find((bead) => bead.isThumb) || beads[Math.floor(VISIBLE_BEADS / 2)];
  const thumbSide = handedness === 'right' ? 1 : -1;
  const checkpointAtThumb = Boolean(thumbBead?.checkpoint);
  const nextIsCheckpoint = isTasbihCheckpoint(threadTicks + 1);

  return (
    <div
      role="slider"
      aria-label="Scrollable tasbeeh beads"
      aria-valuemin={0}
      aria-valuenow={count}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onWheel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (wheelLockRef.current) return;
        const direction = event.deltaY === 0 ? 0 : event.deltaY > 0 ? 1 : -1;
        if (!direction) return;
        wheelLockRef.current = true;
        commitOneStone(direction);
        if (wheelUnlockTimerRef.current !== null) {
          window.clearTimeout(wheelUnlockTimerRef.current);
        }
        wheelUnlockTimerRef.current = window.setTimeout(() => {
          wheelLockRef.current = false;
          wheelUnlockTimerRef.current = null;
        }, WHEEL_LOCK_MS);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
          event.preventDefault();
          onStep(1);
        }
        if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
          event.preventDefault();
          onStep(-1);
        }
      }}
      className="relative isolate mx-auto h-[min(44vh,19rem)] w-full max-w-[17rem] cursor-ns-resize select-none touch-none overflow-hidden rounded-[1.75rem]"
      style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
    >
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="threadGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isDark ? '#fde68a' : '#fcd34d'} />
            <stop offset="45%" stopColor={isDark ? '#d97706' : '#b45309'} />
            <stop offset="100%" stopColor={isDark ? '#78350f' : '#7c2d12'} />
          </linearGradient>
          <radialGradient id="stoneLightA" cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="18%" stopColor="#a7f3d0" />
            <stop offset="52%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064e3b" />
          </radialGradient>
          <radialGradient id="stoneLightB" cx="34%" cy="26%" r="74%">
            <stop offset="0%" stopColor="#ecfdf5" />
            <stop offset="20%" stopColor="#6ee7b7" />
            <stop offset="55%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#134e4a" />
          </radialGradient>
          <radialGradient id="stoneDarkA" cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#d1fae5" />
            <stop offset="20%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#047857" />
            <stop offset="100%" stopColor="#022c22" />
          </radialGradient>
          <radialGradient id="stoneDarkB" cx="34%" cy="26%" r="74%">
            <stop offset="0%" stopColor="#ccfbf1" />
            <stop offset="20%" stopColor="#2dd4bf" />
            <stop offset="55%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#042f2e" />
          </radialGradient>
          <radialGradient id="checkpointStone" cx="30%" cy="24%" r="78%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="22%" stopColor="#fdba74" />
            <stop offset="48%" stopColor="#c2410c" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
          <filter id="beadShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.6" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>

        <g
          ref={svgRef}
          style={{
            ['--bead-shift' as string]: '0px',
            transform: 'translate3d(0, var(--bead-shift), 0)',
          }}
        >
          <path
            d={threadPath}
            fill="none"
            stroke="url(#threadGold)"
            strokeWidth="4.4"
            strokeLinecap="round"
            opacity="0.95"
          />
          <path
            d={threadPath}
            fill="none"
            stroke={isDark ? '#fef3c7' : '#fff7ed'}
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.55"
          />

          {beads.map((bead) => {
            if (bead.checkpoint) {
              const size = bead.isThumb ? 34 : 29;
              const hex = [
                [bead.x, bead.y - size],
                [bead.x + size * 0.86, bead.y - size * 0.42],
                [bead.x + size * 0.86, bead.y + size * 0.42],
                [bead.x, bead.y + size],
                [bead.x - size * 0.86, bead.y + size * 0.42],
                [bead.x - size * 0.86, bead.y - size * 0.42],
              ]
                .map((point) => point.join(','))
                .join(' ');
              return (
                <g key={`checkpoint-${bead.beadIndex}-${bead.index}`} filter="url(#beadShadow)">
                  <polygon
                    points={hex}
                    fill="#f59e0b"
                    stroke="#7c2d12"
                    strokeWidth="2.4"
                  />
                  <polygon
                    points={hex}
                    fill="#fbbf24"
                    opacity="0.45"
                    transform={`translate(0, ${-size * 0.12})`}
                  />
                  <text
                    x={bead.x}
                    y={bead.y + 4}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="800"
                    fill="#7c2d12"
                  >
                    33
                  </text>
                </g>
              );
            }

            const radius = bead.isThumb ? 26 : 23;
            return (
              <g key={`${bead.beadIndex}-${bead.index}`} filter="url(#beadShadow)">
                <circle
                  cx={bead.x}
                  cy={bead.y}
                  r={radius}
                  fill={stoneFill(isDark, Math.abs(bead.beadIndex) % 2 as 0 | 1)}
                />
                <circle cx={bead.x} cy={bead.y} r="1.8" fill={isDark ? '#78350f' : '#92400e'} />
                <ellipse
                  cx={bead.x - radius * 0.28}
                  cy={bead.y - radius * 0.32}
                  rx={radius * 0.28}
                  ry={radius * 0.16}
                  fill="#fff"
                  opacity="0.42"
                />
              </g>
            );
          })}
        </g>

        <g pointerEvents="none">
          <path
            d={
              thumbSide > 0
                ? `M ${thumbBead.x + 30} ${thumbBead.y - 22} Q ${thumbBead.x + 50} ${thumbBead.y} ${thumbBead.x + 30} ${thumbBead.y + 22}`
                : `M ${thumbBead.x - 30} ${thumbBead.y - 22} Q ${thumbBead.x - 50} ${thumbBead.y} ${thumbBead.x - 30} ${thumbBead.y + 22}`
            }
            fill="none"
            stroke={isDark ? '#fbbf24' : '#d97706'}
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.9"
          />
        </g>
      </svg>
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-8 ${
          isDark ? 'bg-gradient-to-b from-slate-950 to-transparent' : 'bg-gradient-to-b from-white to-transparent'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 ${
          isDark ? 'bg-gradient-to-t from-slate-950 to-transparent' : 'bg-gradient-to-t from-white to-transparent'
        }`}
      />
      {(nextIsCheckpoint || checkpointAtThumb) && (
        <div className="pointer-events-none absolute inset-x-2 bottom-1 z-40 rounded-full bg-amber-500 px-2 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow">
          {checkpointAtThumb ? '33 checkpoint' : 'Gold hex bead = 33'}
        </div>
      )}
    </div>
  );
};

export default TasbihBeadThread;
