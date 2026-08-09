import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowsPointingInIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.35;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pointerDistance = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => Math.hypot(a.x - b.x, a.y - b.y);

const pointerMidpoint = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

type ZoomablePhotoViewerProps = {
  src: string;
  alt: string;
};

export const ZoomablePhotoViewer: React.FC<ZoomablePhotoViewerProps> = ({ src, alt }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    distance: number;
    scale: number;
    offset: { x: number; y: number };
  } | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const lastTapRef = useRef(0);

  const commitTransform = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    const clampedScale = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const next = clampedScale <= 1.01 ? { x: 0, y: 0 } : nextOffset;
    scaleRef.current = clampedScale <= 1.01 ? 1 : clampedScale;
    offsetRef.current = next;
    setScale(scaleRef.current);
    setOffset(next);
  }, []);

  const zoomFromBase = useCallback((
    baseScale: number,
    baseOffset: { x: number; y: number },
    nextScale: number,
    clientX: number,
    clientY: number
  ) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const focusX = clientX - rect.left - rect.width / 2;
    const focusY = clientY - rect.top - rect.height / 2;
    const clamped = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const ratio = clamped / Math.max(baseScale, 0.01);
    commitTransform(clamped, {
      x: (baseOffset.x - focusX) * ratio + focusX,
      y: (baseOffset.y - focusY) * ratio + focusY,
    });
  }, [commitTransform]);

  const zoomToward = useCallback((nextScale: number, clientX: number, clientY: number) => {
    zoomFromBase(scaleRef.current, offsetRef.current, nextScale, clientX, clientY);
  }, [zoomFromBase]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      zoomToward(scaleRef.current + delta, event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [zoomToward]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());
    if (points.length === 2) {
      dragRef.current = null;
      pinchRef.current = {
        distance: pointerDistance(points[0], points[1]),
        scale: scaleRef.current,
        offset: { ...offsetRef.current },
      };
      return;
    }
    if (scaleRef.current > 1) {
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: offsetRef.current.x,
        offsetY: offsetRef.current.y,
      };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2 && pinchRef.current) {
      const distance = pointerDistance(points[0], points[1]);
      const midpoint = pointerMidpoint(points[0], points[1]);
      const nextScale = pinchRef.current.scale * (distance / Math.max(pinchRef.current.distance, 1));
      zoomFromBase(pinchRef.current.scale, pinchRef.current.offset, nextScale, midpoint.x, midpoint.y);
      return;
    }

    if (dragRef.current && scaleRef.current > 1) {
      commitTransform(scaleRef.current, {
        x: dragRef.current.offsetX + (event.clientX - dragRef.current.x),
        y: dragRef.current.offsetY + (event.clientY - dragRef.current.y),
      });
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const onDoubleActivate = (clientX: number, clientY: number) => {
    if (scaleRef.current > 1.05) {
      commitTransform(1, { x: 0, y: 0 });
      return;
    }
    zoomToward(2.5, clientX, clientY);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    const isTap =
      !dragRef.current ||
      (Math.abs(event.clientX - dragRef.current.x) < 8 &&
        Math.abs(event.clientY - dragRef.current.y) < 8);
    endPointer(event);
    if (event.pointerType !== 'mouse' && isTap && pointersRef.current.size === 0) {
      if (now - lastTapRef.current < 280) {
        onDoubleActivate(event.clientX, event.clientY);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
    }
  };

  const zoomPercent = Math.round(scale * 100);

  return (
    <div className="relative">
      <div
        ref={viewportRef}
        className={`relative h-[78svh] w-full overflow-hidden rounded-xl bg-slate-950 touch-none ${
          scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endPointer}
        onDoubleClick={(event) => onDoubleActivate(event.clientX, event.clientY)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="pointer-events-none h-full w-full select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl bg-white/15 p-1 text-white backdrop-blur-sm">
          <button
            type="button"
            onClick={() => {
              const viewport = viewportRef.current?.getBoundingClientRect();
              if (!viewport) return;
              zoomToward(
                scaleRef.current - ZOOM_STEP,
                viewport.left + viewport.width / 2,
                viewport.top + viewport.height / 2
              );
            }}
            disabled={scale <= MIN_ZOOM}
            className="rounded-lg p-2 hover:bg-white/15 disabled:opacity-40"
            aria-label="Zoom out"
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5" />
          </button>
          <span className="min-w-[3.25rem] text-center text-sm font-semibold tabular-nums">{zoomPercent}%</span>
          <button
            type="button"
            onClick={() => {
              const viewport = viewportRef.current?.getBoundingClientRect();
              if (!viewport) return;
              zoomToward(
                scaleRef.current + ZOOM_STEP,
                viewport.left + viewport.width / 2,
                viewport.top + viewport.height / 2
              );
            }}
            disabled={scale >= MAX_ZOOM}
            className="rounded-lg p-2 hover:bg-white/15 disabled:opacity-40"
            aria-label="Zoom in"
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => commitTransform(1, { x: 0, y: 0 })}
            disabled={scale <= MIN_ZOOM}
            className="rounded-lg p-2 hover:bg-white/15 disabled:opacity-40"
            aria-label="Reset zoom"
          >
            <ArrowsPointingInIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-white/75">Pinch, scroll, or double-tap to zoom · drag to move</p>
      </div>
    </div>
  );
};

type ZoomablePhotoLightboxProps = {
  src: string;
  alt: string;
  title?: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

export const ZoomablePhotoLightbox: React.FC<ZoomablePhotoLightboxProps> = ({
  src,
  alt,
  title,
  onClose,
  onPrev,
  onNext,
}) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') onPrev?.();
      if (event.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title || alt}
    >
      <button
        type="button"
        aria-label="Close photo"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-5xl max-h-[96svh] flex flex-col px-3 sm:px-0">
        <div className="flex items-center justify-between text-white mb-3 gap-3">
          <p className="text-sm font-medium min-w-0 truncate">{title || alt}</p>
          <div className="flex items-center gap-2 shrink-0">
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="rounded-xl bg-white/15 hover:bg-white/25 p-2"
                aria-label="Previous photo"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                className="rounded-xl bg-white/15 hover:bg-white/25 p-2"
                aria-label="Next photo"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/15 hover:bg-white/25 p-2"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        <ZoomablePhotoViewer key={src} src={src} alt={alt} />
      </div>
    </div>
  );
};
