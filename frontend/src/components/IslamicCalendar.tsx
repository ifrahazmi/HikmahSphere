import React from 'react';

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

// Hijri month names (1-indexed)
const HIJRI_MONTHS: string[] = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
  'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', 'Dhul Qada', 'Dhul Hijja',
];

const IslamicCalendar: React.FC<IslamicCalendarProps> = ({ whiteDays, todayHijri }) => {
  const currentDate = new Date();

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  // Today's anchor from islamicapi (passed as prop)
  const todayDayNum      = currentDate.getDate();
  const anchorHijriDay   = parseInt(todayHijri?.day ?? '0') || 0;
  const anchorMonthNum   = todayHijri?.month?.number ?? 0;
  const anchorMonthEn    = todayHijri?.month?.en ?? '';
  const anchorYear       = parseInt(todayHijri?.year ?? '0') || 0;

  // Compute Hijri info for any calendar cell by offset from today's known anchor
  const getHijriForDate = (d: Date): { day: number; monthNum: number; monthEn: string; year: number } => {
    if (!anchorHijriDay || !anchorMonthNum) return { day: 0, monthNum: 0, monthEn: '', year: 0 };
    const offset = d.getDate() - todayDayNum;
    let hDay = anchorHijriDay + offset;
    let hMonthNum = anchorMonthNum;
    let hYear = anchorYear;
    // Wrap forward (assume 30-day months — close enough within one Gregorian month span)
    while (hDay > 30) { hDay -= 30; hMonthNum++; if (hMonthNum > 12) { hMonthNum = 1; hYear++; } }
    // Wrap backward
    while (hDay <= 0) { hMonthNum--; if (hMonthNum < 1) { hMonthNum = 12; hYear--; } hDay += 30; }
    const monthEn = hMonthNum === anchorMonthNum ? anchorMonthEn : (HIJRI_MONTHS[hMonthNum - 1] ?? '');
    return { day: hDay, monthNum: hMonthNum, monthEn, year: hYear };
  };

  // Header label: use anchor month (dominant month for this Gregorian month)
  const hijriMonthName = anchorMonthEn && anchorYear
    ? `${anchorMonthEn} ${anchorYear} AH`
    : new Intl.DateTimeFormat('en-TN-u-ca-islamic', { month: 'long', year: 'numeric' }).format(currentDate);

  // Helper: local YYYY-MM-DD to avoid UTC-shift for timezones like IST +5:30
  const toLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Get weekday of the first day of the month (0-6)
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full border-l-4 border-emerald-500">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Islamic Calendar</h2>
      </div>
      
      <div className="mb-2">
        <div className="flex flex-col mb-4">
            <span className="text-lg font-semibold text-emerald-600">{hijriMonthName}</span>
            <span className="text-sm text-gray-500">{monthName} {year}</span>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="font-bold text-gray-400 py-2">{d}</div>
          ))}
          
          {/* Padding for start of month */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
             <div key={`empty-${i}`} />
          ))}

          {days.map(date => {
            const isToday = new Date().toDateString() === date.toDateString();
            // Use local timezone to avoid UTC-shift mismatch (e.g. IST +5:30)
            const localISO = toLocalISO(date);
            const whiteDayDates = new Set(Object.values(whiteDays?.days ?? {}).filter(Boolean));
            const isWhiteDay = whiteDayDates.has(localISO);
            // Compute Hijri day from islamicapi anchor (no extra API calls)
            const hijriInfo = getHijriForDate(date);
            const hijriDay = hijriInfo.day > 0 ? String(hijriInfo.day) : '';
            // Is this day in a different Hijri month than the anchor? Show abbreviated month
            const showMonth = hijriInfo.day === 1 && hijriInfo.monthNum !== anchorMonthNum;
            // Determine which white day label (13th/14th/15th) for tooltip
            const whiteDayLabel = isWhiteDay
              ? Object.entries(whiteDays?.days ?? {}).find(([, v]) => v === localISO)?.[0]
              : null;

            return (
              <div
                key={date.toISOString()}
                title={isWhiteDay ? `White Day (${whiteDayLabel})` : undefined}
                className={`p-2 rounded-lg flex flex-col items-center justify-center transition-colors relative ${
                  isToday
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isWhiteDay
                      ? 'bg-amber-100 ring-1 ring-amber-300 text-gray-800'
                      : 'hover:bg-emerald-50 text-gray-700'
                }`}
              >
                <span className={`font-semibold ${
                  isToday ? 'text-white' : isWhiteDay ? 'text-amber-800' : 'text-gray-900'
                }`}>{date.getDate()}</span>
                <span className={`text-[10px] leading-tight ${
                  isToday ? 'text-emerald-100' : isWhiteDay ? 'text-amber-600' : 'text-emerald-600'
                }`}>{hijriDay}</span>
                {showMonth && (
                  <span className={`text-[8px] leading-tight ${
                    isToday ? 'text-emerald-100' : 'text-gray-400'
                  }`}>{hijriInfo.monthEn.slice(0, 3)}</span>
                )}
                {isWhiteDay && !isToday && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* White Days Legend */}
      <div className="mt-3 border-t pt-3 space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="flex-shrink-0 w-3 h-3 rounded bg-amber-100 ring-1 ring-amber-300 relative">
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full"></span>
          </span>
          <span className="font-medium text-amber-800">White Days (Al-Ayyam Al-Beed)</span>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed pl-5">
          13th, 14th &amp; 15th of every Hijri month — Sunnah to fast. The moon is full and nights are bright.
        </p>
        {whiteDays?.days && (
          <div className="pl-5 flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {Object.entries(whiteDays.days).map(([label, iso]) => {
              if (!iso) return null;
              const d = new Date(iso + 'T00:00:00');
              const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return (
                <span key={label} className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                  <span className="font-medium">{label}:</span>
                  <span>{formatted}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default IslamicCalendar;
