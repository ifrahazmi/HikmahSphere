import React, { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { API_URL } from '../../config';

const WINDOW_SIZE = 5;
const ROTATE_MS = 2500;
const SHIFT_MS = 320;

export type PublicGift = {
  paymentDate: string;
  amount: number;
  bankName: string;
  paymentMethod: string;
};

type RecentPublicGiftsProps = {
  tone: 'light' | 'dark';
  ctaHref?: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error' }
  | { status: 'ready'; gifts: PublicGift[] };

const REDACTED = 'XXXX';
const EMPTY_GIFTS: PublicGift[] = [];

const formatGiftDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatAmount = (amount: number): string =>
  `₹${Number(amount).toLocaleString('en-IN')}`;

const METHOD_LABELS: Record<string, string> = {
  'Bank Transfer': 'Bank Transfer',
  'UPI Transfer': 'UPI',
  Cash: 'Cash',
  Cheque: 'Cheque',
  'QR Scanner': 'QR',
};

const methodLabel = (method: string): string => {
  const trimmed = method.trim();
  if (!trimmed) return '';
  return METHOD_LABELS[trimmed] ?? trimmed.replace(/\s+Transfer$/i, '').trim();
};

const bankLabel = (name: string): string => name.trim() || 'Bank';

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
};

const GiftRow: React.FC<{ gift: PublicGift; tone: 'light' | 'dark'; showDivider?: boolean }> = ({
  gift,
  tone,
  showDivider = true,
}) => {
  const isDark = tone === 'dark';
  const bank = bankLabel(gift.bankName);
  const method = methodLabel(gift.paymentMethod);
  const redactedClass = `font-mono tracking-[0.28em] text-[0.7rem] sm:text-[0.75rem] font-semibold ${
    isDark ? 'text-slate-300' : 'text-slate-500'
  }`;

  return (
    <div
      className={`h-[var(--gift-row-h)] px-3 sm:px-4 flex items-center ${
        showDivider ? `border-b ${isDark ? 'border-white/10' : 'border-emerald-100/80'}` : ''
      }`}
    >
      <div className="min-w-0 flex-1 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[6.75rem_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 items-center">
        <time
          dateTime={gift.paymentDate}
          className={`order-1 text-xs sm:text-sm tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-500'}`}
        >
          {formatGiftDate(gift.paymentDate)}
        </time>

        <div className="order-3 col-span-2 sm:order-2 sm:col-span-1 min-w-0 flex items-center gap-x-2 overflow-hidden">
          <span className={`${redactedClass} shrink-0`} title="Donor name hidden">
            {REDACTED}
          </span>
          <span className={`shrink-0 text-[0.65rem] ${isDark ? 'text-white/25' : 'text-slate-300'}`}>·</span>
          <span className={`text-xs sm:text-sm truncate min-w-0 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
            {bank}
          </span>
          {method ? (
            <>
              <span className={`shrink-0 text-[0.65rem] ${isDark ? 'text-white/25' : 'text-slate-300'}`}>·</span>
              <span className={`shrink-0 text-xs sm:text-sm ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                {method}
              </span>
            </>
          ) : null}
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase ${
              isDark
                ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            Maktab
          </span>
          <span className={`shrink-0 text-[0.65rem] ${isDark ? 'text-white/25' : 'text-slate-300'}`}>·</span>
          <span className={`${redactedClass} shrink-0`} title="UPI and account hidden">
            {REDACTED}
          </span>
        </div>

        <p
          className={`order-2 sm:order-3 justify-self-end text-sm sm:text-base font-semibold tabular-nums ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {formatAmount(gift.amount)}
        </p>
      </div>
    </div>
  );
};

const GiftSkeleton: React.FC<{ tone: 'light' | 'dark' }> = ({ tone }) => {
  const pulse = tone === 'dark' ? 'bg-white/10' : 'bg-slate-200/80';
  return (
    <div className="h-[var(--gift-row-h)] px-3 sm:px-4 flex items-center gap-3">
      <div className={`h-3 w-20 rounded ${pulse}`} />
      <div className={`h-3 flex-1 rounded ${pulse}`} />
      <div className={`h-3 w-16 rounded ${pulse}`} />
    </div>
  );
};

const RecentPublicGifts: React.FC<RecentPublicGiftsProps> = ({ tone, ctaHref }) => {
  const headingId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [start, setStart] = useState(0);
  const [shifting, setShifting] = useState(false);
  const [paused, setPaused] = useState(false);

  const isDark = tone === 'dark';
  const gifts = load.status === 'ready' ? load.gifts : EMPTY_GIFTS;
  const canRotate = gifts.length > WINDOW_SIZE && !reducedMotion;

  useEffect(() => {
    let cancelled = false;

    const loadGifts = async () => {
      try {
        const response = await fetch(`${API_URL}/maktab/public/recent-gifts`);
        const json = await response.json();
        if (cancelled) return;

        const raw = json?.data?.gifts;
        if (!response.ok || json?.status !== 'success' || !Array.isArray(raw)) {
          setLoad({ status: 'error' });
          return;
        }

        const parsed: PublicGift[] = raw
          .slice(0, 10)
          .map((row: Partial<PublicGift>) => ({
            paymentDate: typeof row.paymentDate === 'string' ? row.paymentDate : String(row.paymentDate ?? ''),
            amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
            bankName: typeof row.bankName === 'string' ? row.bankName : '',
            paymentMethod: typeof row.paymentMethod === 'string' ? row.paymentMethod : '',
          }))
          .filter((row: PublicGift) => row.paymentDate && Number.isFinite(row.amount) && row.amount > 0);

        setLoad(parsed.length > 0 ? { status: 'ready', gifts: parsed } : { status: 'empty' });
      } catch {
        if (!cancelled) setLoad({ status: 'error' });
      }
    };

    void loadGifts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canRotate || paused || shifting) return undefined;
    const timer = window.setInterval(() => setShifting(true), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [canRotate, paused, shifting, start]);

  const visibleCount = Math.min(WINDOW_SIZE, gifts.length);
  const renderCount = canRotate ? WINDOW_SIZE + 1 : visibleCount;

  const windowItems = useMemo(() => {
    if (gifts.length === 0) return [];
    return Array.from({ length: renderCount }, (_, offset) => {
      const index = (start + offset) % gifts.length;
      return { index, gift: gifts[index] };
    });
  }, [gifts, renderCount, start]);

  const handleShiftEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform' || !shifting) return;
    setStart((prev) => (gifts.length === 0 ? 0 : (prev + 1) % gifts.length));
    setShifting(false);
  };

  if (load.status === 'empty' || load.status === 'error') {
    return null;
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h3
          id={headingId}
          className={`text-lg sm:text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}
          style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
        >
          Recent public gifts
        </h3>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Latest support for the Maktab, shown without names or UPI.
        </p>
      </div>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${
          isDark
            ? 'bg-white/5 text-slate-300 ring-1 ring-white/10'
            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
        }`}
      >
        <LockClosedIcon className="w-3.5 h-3.5" />
        Privacy protected
      </span>
    </div>
  );

  const ledger = (
    <div
      className={`rounded-2xl overflow-hidden [--gift-row-h:4.75rem] sm:[--gift-row-h:3.55rem] ${
        isDark
          ? 'bg-white/5 ring-1 ring-white/10 shadow-xl shadow-black/20'
          : 'bg-white ring-1 ring-emerald-100 shadow-sm'
      }`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      role="region"
      aria-labelledby={headingId}
      aria-roledescription={canRotate ? 'marquee' : undefined}
    >
      <div
        className="relative overflow-hidden"
        style={{
          height: `calc(${load.status === 'loading' ? WINDOW_SIZE : visibleCount} * var(--gift-row-h))`,
        }}
      >
        {load.status === 'loading' ? (
          <div className="animate-pulse">
            {Array.from({ length: WINDOW_SIZE }, (_, i) => (
              <GiftSkeleton key={i} tone={tone} />
            ))}
          </div>
        ) : (
          <div
            className="will-change-transform"
            style={{
              transform: shifting ? 'translateY(calc(-1 * var(--gift-row-h)))' : 'translateY(0)',
              transition: shifting ? `transform ${SHIFT_MS}ms ease-out` : 'none',
            }}
            onTransitionEnd={handleShiftEnd}
          >
            {windowItems.map(({ gift, index }, offset) => (
              gift ? (
              <div
                key={`${index}-${gift.paymentDate}-${gift.amount}`}
                className={shifting && offset === 0 ? 'opacity-0' : 'opacity-100'}
                style={{
                  transition: shifting ? 'opacity 400ms ease-out' : 'none',
                }}
              >
                <GiftRow gift={gift} tone={tone} showDivider={offset < renderCount - 1} />
              </div>
              ) : null
            ))}
          </div>
        )}
        {canRotate ? (
          <>
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-2 bg-gradient-to-b ${
                isDark ? 'from-black/25' : 'from-white'
              } to-transparent`}
            />
            <div
              className={`pointer-events-none absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t ${
                isDark ? 'from-black/25' : 'from-white'
              } to-transparent`}
            />
          </>
        ) : null}
      </div>
    </div>
  );

  const cta =
    ctaHref && load.status === 'ready' ? (
      <p className="mt-4">
        <Link
          to={ctaHref}
          className={`text-sm font-semibold underline-offset-4 hover:underline ${
            isDark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-700 hover:text-emerald-800'
          }`}
        >
          Sponsor a seat
        </Link>
        <span className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}> — join those already giving.</span>
      </p>
    ) : null;

  const body = (
    <div>
      {header}
      {ledger}
      {cta}
    </div>
  );

  if (isDark) {
    return (
      <section
        className="relative bg-slate-950 text-white border-t border-white/10"
        aria-labelledby={headingId}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">{body}</div>
      </section>
    );
  }

  return body;
};

export default RecentPublicGifts;
