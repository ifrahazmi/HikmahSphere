import React, { useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface WhiteDays {
  status?: string;
  days?: {
    '13th'?: string;
    '14th'?: string;
    '15th'?: string;
  };
}

interface TodayHijri {
  day: string;
  month: { number: number; en: string };
  year: string;
}

interface IslamicCalendarProps {
  whiteDays?: WhiteDays;
  todayHijri?: TodayHijri;
}

interface HijriInfo {
  day: number;
  monthEn: string;
  monthShort: string;
  year: number;
}

interface WhiteDayEntry {
  iso: string;
  date: Date;
  label: string;
}

const HIJRI_LONG_FORMATTER = new Intl.DateTimeFormat('en-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const HIJRI_SHORT_FORMATTER = new Intl.DateTimeFormat('en-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const toLocalISO = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const normalizeHijriMonthName = (value: string): string => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
);

const formatOrdinal = (value: number): string => {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1));
};

const getHijriInfo = (date: Date): HijriInfo => {
  const longParts = HIJRI_LONG_FORMATTER.formatToParts(date);
  const shortParts = HIJRI_SHORT_FORMATTER.formatToParts(date);

  return {
    day: parseInt(longParts.find((part) => part.type === 'day')?.value ?? '0', 10) || 0,
    monthEn: longParts.find((part) => part.type === 'month')?.value ?? '',
    monthShort: shortParts.find((part) => part.type === 'month')?.value.replace('.', '') ?? '',
    year: parseInt(longParts.find((part) => part.type === 'year')?.value ?? '0', 10) || 0,
  };
};

const PrayerTimesIslamicCalendar: React.FC<IslamicCalendarProps> = ({ whiteDays, todayHijri }) => {
  const [monthOffset, setMonthOffset] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const today = new Date();
  const todayIso = toLocalISO(today);
  const displayedMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  
  // Using Intl directly for all days to maintain calendar grid continuity.
  // We no longer override 'today' with the Maghrib-adjusted todayHijri, 
  // preventing sequence breaks (like double 14ths) in the calendar layout.
  const displayedDays = getDaysInMonth(displayedMonth).map((date) => {
    const iso = toLocalISO(date);
    const hijri = getHijriInfo(date);
    
    return { date, iso, hijri };
  });

  const monthName = displayedMonth.toLocaleString('default', { month: 'long' });
  const year = displayedMonth.getFullYear();
  const firstDayOfMonth = displayedMonth.getDay();
  const isCurrentMonthView = monthOffset === 0;
  const fallbackHijriLabel = todayHijri?.month?.en && todayHijri?.year
    ? `${todayHijri.month.en} ${todayHijri.year} AH`
    : HIJRI_LONG_FORMATTER.format(displayedMonth);

  const hijriMonthCounts = new Map<string, { label: string; count: number }>();
  const orderedHijriMonthLabels: string[] = [];
  displayedDays.forEach(({ hijri }) => {
    if (!hijri.monthEn || !hijri.year) return;

    const key = `${normalizeHijriMonthName(hijri.monthEn)}-${hijri.year}`;
    const existing = hijriMonthCounts.get(key);

    if (existing) {
      existing.count += 1;
      return;
    }

    orderedHijriMonthLabels.push(`${hijri.monthEn} ${hijri.year} AH`);
    hijriMonthCounts.set(key, {
      label: `${hijri.monthEn} ${hijri.year} AH`,
      count: 1,
    });
  });

  const primaryHijriMonthEntry = Array.from(hijriMonthCounts.entries()).reduce<[string, { label: string; count: number }] | null>(
    (selected, current) => {
      if (!selected || current[1].count > selected[1].count) {
        return current;
      }

      return selected;
    },
    null,
  );
  const primaryHijriMonthLabel = primaryHijriMonthEntry?.[1].label ?? fallbackHijriLabel;
  const currentHijriMonthLabel = isCurrentMonthView && todayHijri?.month?.en && todayHijri?.year
    ? `${todayHijri.month.en} ${todayHijri.year} AH`
    : primaryHijriMonthLabel;
  const displayedHijriMonthLabel = orderedHijriMonthLabels.length > 0
    ? orderedHijriMonthLabels.join(' / ')
    : primaryHijriMonthLabel;
  const showHijriRange = displayedHijriMonthLabel !== currentHijriMonthLabel && orderedHijriMonthLabels.length > 1;

  // Build white days mapping strictly from the continuous calendar grid
  const whiteDayMap = new Map<string, WhiteDayEntry>();

  displayedDays.forEach(({ date, iso, hijri }) => {
    // Only include white days in the displayed month
    if (date.getFullYear() !== displayedMonth.getFullYear()
      || date.getMonth() !== displayedMonth.getMonth()
    ) {
      return;
    }

    // Check if this is a white day (13th, 14th, or 15th of any Hijri month)
    if ([13, 14, 15].includes(hijri.day)) {
      whiteDayMap.set(iso, {
        iso,
        date,
        label: formatOrdinal(hijri.day),
      });
    }
  });

  // Collect all white day dates for calendar highlighting
  const allWhiteDayDates = new Set<string>(whiteDayMap.keys());

  // Build white day entries list for display below calendar
  const whiteDayEntries = Array.from(whiteDayMap.values())
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  const goToPreviousMonth = () => {
    setMonthOffset((currentOffset) => Math.max(0, currentOffset - 1));
  };

  const goToNextMonth = () => {
    setMonthOffset((currentOffset) => currentOffset + 1);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartXRef.current;
    const deltaY = touch.clientY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX < 0) {
      goToNextMonth();
      return;
    }

    goToPreviousMonth();
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 h-full border-l-4 border-emerald-500"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Islamic Calendar</h2>
        </div>

        <div className="flex items-center gap-2">
          {monthOffset > 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="hidden rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 sm:inline-flex"
              type="button"
            >
              Current
            </button>
          )}

          <button
            onClick={goToPreviousMonth}
            className={`rounded-full border p-2 transition-colors ${
              monthOffset === 0
                ? 'cursor-not-allowed border-gray-200 text-gray-300'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
            disabled={monthOffset === 0}
            aria-label="View previous month"
            type="button"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>

          <button
            onClick={goToNextMonth}
            className="rounded-full border border-emerald-200 p-2 text-emerald-700 transition-colors hover:bg-emerald-50"
            aria-label="View next month"
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-4 flex flex-col">
          <span className="text-2xl font-extrabold tracking-tight text-emerald-700">{currentHijriMonthLabel}</span>
          {showHijriRange && (
            <span className="mt-1 inline-flex w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
              {displayedHijriMonthLabel}
            </span>
          )}
          <span className="mt-1 text-sm text-gray-500">{monthName} {year}</span>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayLabel) => (
            <div key={dayLabel} className="py-2 font-bold text-gray-400">{dayLabel}</div>
          ))}

          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${monthOffset}-${index}`} />
          ))}

          {displayedDays.map(({ date, iso, hijri }) => {
            const isToday = iso === todayIso;
            const isWhiteDay = allWhiteDayDates.has(iso);
            const whiteDayEntry = whiteDayMap.get(iso);
            const whiteDayLabel = whiteDayEntry?.label;
            const displayDay = isWhiteDay && whiteDayEntry
              ? whiteDayEntry.label.replace(/\D/g, '') // Extract number from "13th", "14th", etc.
              : (hijri.day > 0 ? String(hijri.day) : '');
            const showMonth = hijri.day === 1;

            return (
              <div
                key={iso}
                title={isWhiteDay ? `White Day (${whiteDayLabel})` : undefined}
                className={`relative flex flex-col items-center justify-center rounded-lg p-2 transition-colors ${
                  isToday
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isWhiteDay
                      ? 'bg-amber-100 text-gray-800 ring-1 ring-amber-300'
                      : 'text-gray-700 hover:bg-emerald-50'
                }`}
              >
                <span className={`font-semibold ${
                  isToday ? 'text-white' : isWhiteDay ? 'text-amber-800' : 'text-gray-900'
                }`}>{date.getDate()}</span>
                <span className={`text-[10px] leading-tight ${
                  isToday ? 'text-emerald-100' : isWhiteDay ? 'text-amber-600' : 'text-emerald-600'
                }`}>{displayDay}</span>
                {showMonth && (
                  <span className={`text-[8px] leading-tight ${
                    isToday ? 'text-emerald-100' : 'text-gray-400'
                  }`}>{hijri.monthShort.slice(0, 3)}</span>
                )}
                {isWhiteDay && !isToday && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 border-t pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="relative h-3 w-3 flex-shrink-0 rounded bg-amber-100 ring-1 ring-amber-300">
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-400"></span>
          </span>
          <span className="font-medium text-amber-800">White Days (Al-Ayyam Al-Beed)</span>
          {whiteDayEntries.length > 0 ? (
            whiteDayEntries.map((entry, index) => (
              <span key={`${entry.iso}-${index}`} className="inline-flex items-center gap-1 text-[10px] text-amber-700 sm:text-[11px]">
                <span className="font-medium">{entry.label}:</span>
                <span>{entry.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
              </span>
            ))
          ) : (
            <span className="text-[10px] text-gray-500 sm:text-[11px]">No White Days in this month.</span>
          )}
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-gray-500 sm:text-[11px]">
          13th, 14th &amp; 15th of every Hijri month. These are sunnah fasting days, named for the bright moonlit nights.
        </p>
      </div>
    </div>
  );
};

export default PrayerTimesIslamicCalendar;
