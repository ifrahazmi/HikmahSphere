import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import toast from 'react-hot-toast';
import {
  ArrowPathIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FireIcon,
  MapPinIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  ArrowDownTrayIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../config';
import {
  PRAYER_KEYS,
  QURAN_STATUS_LABEL,
  QuranStatus,
  PrayerName,
  PrayerStatus,
  TrackerRecords,
  addDays,
  countByStatus,
  formatCompactDate,
  formatDateKey,
  formatReadableDate,
  getAggregatedStats,
  getBestStreak,
  getCurrentStreak,
  getDailyActivity,
  getDayScore,
  getLoggedCount,
  getQuranScore,
  getSalahTrackerStorageKey,
  isPerfectDay,
  normalizeDayRecord,
  normalizeRecords,
  parseDateKey,
  readTrackerFromStorage,
  writeTrackerToStorage,
} from '../utils/salahTracker';

interface PrayerConfig {
  key: PrayerName;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  gradient: string;
}

interface PrayerWindow {
  start: string;
  end: string;
}

interface PrayerTimings {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  midnight: string;
}

type ExportFormat = 'json' | 'pic';
type ExportSectionKey =
  | 'weeklyTrend'
  | 'currentStreak'
  | 'bestStreak'
  | 'sevenDayAverages'
  | 'salahHeatmap'
  | 'quranHeatmap';

interface ExportSectionOption {
  key: ExportSectionKey;
  label: string;
}

const PRAYER_CONFIGS: PrayerConfig[] = [
  { key: 'fajr', label: 'Fajr', icon: SunIcon, gradient: 'from-cyan-500 to-blue-500' },
  { key: 'dhuhr', label: 'Dhuhr', icon: SunIcon, gradient: 'from-amber-500 to-orange-500' },
  { key: 'asr', label: 'Asr', icon: SunIcon, gradient: 'from-lime-500 to-emerald-500' },
  { key: 'maghrib', label: 'Maghrib', icon: MoonIcon, gradient: 'from-rose-500 to-orange-500' },
  { key: 'isha', label: 'Isha', icon: MoonIcon, gradient: 'from-indigo-500 to-violet-500' },
];

const STATUS_ORDER: PrayerStatus[] = ['prayed', 'qada', 'missed'];

const STATUS_META: Record<PrayerStatus, { label: string; badge: string; activeButton: string }> = {
  pending: {
    label: 'Pending',
    badge: 'bg-gray-100 text-gray-600',
    activeButton: 'bg-gray-700 text-white border-gray-700',
  },
  prayed: {
    label: 'Prayed',
    badge: 'bg-emerald-100 text-emerald-700',
    activeButton: 'bg-emerald-600 text-white border-emerald-600',
  },
  qada: {
    label: 'Qada',
    badge: 'bg-amber-100 text-amber-700',
    activeButton: 'bg-amber-500 text-white border-amber-500',
  },
  missed: {
    label: 'Missed',
    badge: 'bg-rose-100 text-rose-700',
    activeButton: 'bg-rose-600 text-white border-rose-600',
  },
};

const QURAN_STATUS_OPTIONS: Array<{ status: QuranStatus; label: string; description: string; activeClass: string }> = [
  {
    status: 'none',
    label: 'Not Read',
    description: 'No Quran reading marked',
    activeClass: 'bg-gray-700 text-white border-gray-700',
  },
  {
    status: 'read',
    label: 'Read',
    description: 'Read Quran (Arabic only)',
    activeClass: 'bg-sky-600 text-white border-sky-600',
  },
  {
    status: 'translation',
    label: 'Translation',
    description: 'Read with translation',
    activeClass: 'bg-blue-600 text-white border-blue-600',
  },
  {
    status: 'tafseer',
    label: 'Tafseer',
    description: 'Read with tafseer',
    activeClass: 'bg-violet-600 text-white border-violet-600',
  },
];

const EXPORT_SECTION_OPTIONS: ExportSectionOption[] = [
  { key: 'weeklyTrend', label: 'Weekly Trend (Salah + Quran)' },
  { key: 'currentStreak', label: 'Current Streak (In Days)' },
  { key: 'bestStreak', label: 'Best Streak (In Days)' },
  { key: 'sevenDayAverages', label: '7-Day Averages' },
  { key: 'salahHeatmap', label: 'Salah Heatmap (30 Days)' },
  { key: 'quranHeatmap', label: 'Quran Activity Heatmap (30 Days)' },
];

const DEFAULT_PRAYER_TIMINGS: PrayerTimings = {
  fajr: '05:00',
  sunrise: '06:20',
  dhuhr: '12:30',
  asr: '15:45',
  maghrib: '18:15',
  isha: '19:45',
  midnight: '00:00',
};

const nowIso = () => new Date().toISOString();

const getIsoTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mergeRecordsByLatest = (localRecords: TrackerRecords, remoteRecords: TrackerRecords): TrackerRecords => {
  const merged: TrackerRecords = {};
  const allDateKeys = new Set([...Object.keys(localRecords), ...Object.keys(remoteRecords)]);

  allDateKeys.forEach((dateKey) => {
    const localRaw = localRecords[dateKey];
    const remoteRaw = remoteRecords[dateKey];

    if (!localRaw && remoteRaw) {
      merged[dateKey] = normalizeDayRecord(remoteRaw);
      return;
    }

    if (!remoteRaw && localRaw) {
      merged[dateKey] = normalizeDayRecord(localRaw);
      return;
    }

    if (!localRaw || !remoteRaw) return;

    const localDay = normalizeDayRecord(localRaw);
    const remoteDay = normalizeDayRecord(remoteRaw);
    const localUpdatedAt = getIsoTimestamp(localDay.updatedAt);
    const remoteUpdatedAt = getIsoTimestamp(remoteDay.updatedAt);

    merged[dateKey] = localUpdatedAt >= remoteUpdatedAt ? localDay : remoteDay;
  });

  return merged;
};

const cleanTimeValue = (value: unknown): string => {
  if (typeof value !== 'string') return '--:--';

  const match = value.match(/(\d{1,2}:\d{2})/);
  if (!match) return '--:--';

  const [hoursRaw, minutesRaw] = match[1].split(':');
  const hour = Math.max(0, Math.min(23, Number(hoursRaw) || 0));
  const minute = Math.max(0, Math.min(59, Number(minutesRaw) || 0));

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const extractPrayerTimings = (payload: any): PrayerTimings => {
  const rawTimes = payload?.data?.times || payload?.data?.timings || payload?.times || payload?.timings || {};

  return {
    fajr: cleanTimeValue(rawTimes.Fajr || rawTimes.fajr || DEFAULT_PRAYER_TIMINGS.fajr),
    sunrise: cleanTimeValue(rawTimes.Sunrise || rawTimes.sunrise || DEFAULT_PRAYER_TIMINGS.sunrise),
    dhuhr: cleanTimeValue(rawTimes.Dhuhr || rawTimes.dhuhr || DEFAULT_PRAYER_TIMINGS.dhuhr),
    asr: cleanTimeValue(rawTimes.Asr || rawTimes.asr || DEFAULT_PRAYER_TIMINGS.asr),
    maghrib: cleanTimeValue(rawTimes.Maghrib || rawTimes.maghrib || DEFAULT_PRAYER_TIMINGS.maghrib),
    isha: cleanTimeValue(rawTimes.Isha || rawTimes.isha || DEFAULT_PRAYER_TIMINGS.isha),
    midnight: cleanTimeValue(rawTimes.Midnight || rawTimes.midnight || DEFAULT_PRAYER_TIMINGS.midnight),
  };
};

const buildPrayerWindows = (timings: PrayerTimings): Record<PrayerName, PrayerWindow> => ({
  fajr: { start: timings.fajr, end: timings.sunrise },
  dhuhr: { start: timings.dhuhr, end: timings.asr },
  asr: { start: timings.asr, end: timings.maghrib },
  maghrib: { start: timings.maghrib, end: timings.isha },
  isha: { start: timings.isha, end: timings.midnight },
});

const getPrayerHeatmapTone = (score: number): string => {
  if (score >= 100) return 'border-teal-200 bg-teal-500';
  if (score >= 75) return 'border-emerald-200 bg-emerald-400';
  if (score >= 45) return 'border-amber-200 bg-amber-300';
  if (score > 0) return 'border-rose-200 bg-rose-300';
  return 'border-gray-200 bg-gray-100';
};

const getQuranHeatmapTone = (score: number): string => {
  if (score >= 100) return 'border-violet-200 bg-violet-500';
  if (score >= 80) return 'border-violet-200 bg-violet-400';
  if (score >= 60) return 'border-violet-200 bg-violet-300';
  return 'border-gray-200 bg-gray-100';
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const SalahTracker: React.FC = () => {
  const { user: authUser } = useAuth();
  const todayDateKey = useMemo(() => formatDateKey(new Date()), []);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [records, setRecords] = useState<TrackerRecords>({});
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);
  const [isHydratingRemoteStore, setIsHydratingRemoteStore] = useState(false);
  const [isRemoteSyncReady, setIsRemoteSyncReady] = useState(false);
  const [prayerTimings, setPrayerTimings] = useState<PrayerTimings>(DEFAULT_PRAYER_TIMINGS);
  const [timeSource, setTimeSource] = useState('Default prayer windows are shown.');
  const [isSyncingTimes, setIsSyncingTimes] = useState(false);
  const exportPreviewRef = useRef<HTMLDivElement>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pic');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSelections, setExportSelections] = useState<Record<ExportSectionKey, boolean>>({
    weeklyTrend: true,
    currentStreak: true,
    bestStreak: true,
    sevenDayAverages: true,
    salahHeatmap: true,
    quranHeatmap: true,
  });

  const storageKey = useMemo(() => {
    return getSalahTrackerStorageKey(authUser ? { id: authUser.id, email: authUser.email } : null);
  }, [authUser]);

  useEffect(() => {
    let isCancelled = false;

    const localRecords = readTrackerFromStorage(storageKey);
    setIsStoreLoaded(false);
    setIsRemoteSyncReady(false);
    setRecords(localRecords);
    setSelectedDateKey(formatDateKey(new Date()));
    setIsStoreLoaded(true);

    const token = localStorage.getItem('token');
    if (!authUser?.id || !token) {
      setIsHydratingRemoteStore(false);
      setIsRemoteSyncReady(true);
      return () => {
        isCancelled = true;
      };
    }

    const hydrateRemoteStore = async () => {
      try {
        setIsHydratingRemoteStore(true);

        const response = await fetch(`${API_URL}/salah-tracker`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Salah Tracker fetch failed: ${response.status}`);
        }

        const payload = await response.json();
        const remoteRecords = normalizeRecords(payload?.data?.records);

        if (!isCancelled) {
          setRecords((currentRecords) => mergeRecordsByLatest(currentRecords, remoteRecords));
        }
      } catch (error) {
        console.error('Failed to hydrate Salah Tracker from server:', error);
      } finally {
        if (!isCancelled) {
          setIsHydratingRemoteStore(false);
          setIsRemoteSyncReady(true);
        }
      }
    };

    hydrateRemoteStore();

    return () => {
      isCancelled = true;
    };
  }, [authUser?.id, storageKey]);

  useEffect(() => {
    if (!isStoreLoaded) return;
    writeTrackerToStorage(storageKey, records);
  }, [records, storageKey, isStoreLoaded]);

  const selectedRecord = useMemo(() => normalizeDayRecord(records[selectedDateKey]), [records, selectedDateKey]);

  const selectedScore = useMemo(() => getDayScore(selectedRecord), [selectedRecord]);
  const selectedLoggedCount = useMemo(() => getLoggedCount(selectedRecord), [selectedRecord]);
  const selectedPrayedCount = useMemo(() => countByStatus(selectedRecord, 'prayed'), [selectedRecord]);
  const selectedQadaCount = useMemo(() => countByStatus(selectedRecord, 'qada'), [selectedRecord]);
  const selectedMissedCount = useMemo(() => countByStatus(selectedRecord, 'missed'), [selectedRecord]);
  const selectedQuranScore = useMemo(() => getQuranScore(selectedRecord), [selectedRecord]);

  const prayerWindows = useMemo(() => buildPrayerWindows(prayerTimings), [prayerTimings]);

  const memberSinceDateKey = useMemo(() => {
    if (!authUser?.createdAt) {
      return todayDateKey;
    }

    const parsed = new Date(authUser.createdAt);
    if (Number.isNaN(parsed.getTime())) {
      return todayDateKey;
    }

    return formatDateKey(parsed);
  }, [authUser?.createdAt, todayDateKey]);

  const weeklyData = useMemo(() => {
    const anchorDate = parseDateKey(selectedDateKey);

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(anchorDate, index - 6);
      const dateKey = formatDateKey(date);
      const dayRecord = normalizeDayRecord(records[dateKey]);

      return {
        dateKey,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        prayerScore: getDayScore(dayRecord),
        quranScore: getQuranScore(dayRecord),
      };
    });
  }, [records, selectedDateKey]);

  const weeklyRangeLabel = useMemo(() => {
    if (weeklyData.length === 0) {
      return '';
    }

    const from = formatCompactDate(weeklyData[0].dateKey);
    const to = formatCompactDate(weeklyData[weeklyData.length - 1].dateKey);
    return `${from} to ${to}`;
  }, [weeklyData]);

  const prayerHeatmapData = useMemo(() => {
    const anchorDate = parseDateKey(todayDateKey);

    return Array.from({ length: 30 }, (_, index) => {
      const date = addDays(anchorDate, index - 29);
      const dateKey = formatDateKey(date);
      const dayRecord = normalizeDayRecord(records[dateKey]);

      return {
        dateKey,
        score: getDayScore(dayRecord),
        perfect: isPerfectDay(dayRecord),
      };
    });
  }, [records, todayDateKey]);

  const quranHeatmapData = useMemo(() => {
    const anchorDate = parseDateKey(todayDateKey);

    return Array.from({ length: 30 }, (_, index) => {
      const date = addDays(anchorDate, index - 29);
      const dateKey = formatDateKey(date);
      const dayRecord = normalizeDayRecord(records[dateKey]);

      return {
        dateKey,
        score: getQuranScore(dayRecord),
        status: dayRecord.quran.status,
      };
    });
  }, [records, todayDateKey]);

  const weeklyPrayerConsistency = useMemo(() => {
    const total = weeklyData.reduce((sum, day) => sum + day.prayerScore, 0);
    return Math.round(total / weeklyData.length);
  }, [weeklyData]);

  const weeklyQuranConsistency = useMemo(() => {
    const total = weeklyData.reduce((sum, day) => sum + day.quranScore, 0);
    return Math.round(total / weeklyData.length);
  }, [weeklyData]);

  const perfectDaysInPrayerHeatmap = useMemo(() => {
    return prayerHeatmapData.filter((day) => day.perfect).length;
  }, [prayerHeatmapData]);

  const quranReadDaysInHeatmap = useMemo(() => {
    return quranHeatmapData.filter((day) => day.status !== 'none').length;
  }, [quranHeatmapData]);

  const currentStreak = useMemo(() => getCurrentStreak(records, todayDateKey), [records, todayDateKey]);
  const bestStreak = useMemo(() => getBestStreak(records), [records]);
  const aggregateStats = useMemo(() => getAggregatedStats(records), [records]);
  const recentActivity = useMemo(() => getDailyActivity(records, 180), [records]);

  useEffect(() => {
    if (!isStoreLoaded || isHydratingRemoteStore || !isRemoteSyncReady || !authUser?.id) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const syncTimer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/salah-tracker`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            version: 2,
            records,
            stats: {
              ...aggregateStats,
              currentStreak,
              bestStreak,
            },
            activity: recentActivity,
          }),
        });

        if (!response.ok) {
          throw new Error(`Salah Tracker sync failed: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to sync Salah Tracker to server:', error);
      }
    }, 800);

    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [
    aggregateStats,
    authUser?.id,
    bestStreak,
    currentStreak,
    isHydratingRemoteStore,
    isRemoteSyncReady,
    isStoreLoaded,
    recentActivity,
    records,
  ]);

  const trendChart = useMemo(() => {
    const width = 320;
    const height = 140;
    const padding = 16;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const buildPoints = (scores: number[]): string => {
      if (scores.length === 0) return '';
      if (scores.length === 1) {
        const y = padding + innerHeight * (1 - clamp(scores[0], 0, 100) / 100);
        return `${padding},${y.toFixed(2)}`;
      }

      return scores
        .map((score, index) => {
          const x = padding + (innerWidth / (scores.length - 1)) * index;
          const y = padding + innerHeight * (1 - clamp(score, 0, 100) / 100);
          return `${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
    };

    const prayerScores = weeklyData.map((day) => day.prayerScore);
    const quranScores = weeklyData.map((day) => day.quranScore);

    const buildDots = (scores: number[], colorClass: string) => {
      return scores.map((score, index) => {
        const x = padding + (innerWidth / Math.max(1, scores.length - 1)) * index;
        const y = padding + innerHeight * (1 - clamp(score, 0, 100) / 100);
        return <circle key={`${colorClass}-${index}`} cx={x} cy={y} r={3} className={colorClass} />;
      });
    };

    return {
      width,
      height,
      gridY: [0, 25, 50, 75, 100].map((tick) => ({
        tick,
        y: padding + innerHeight * (1 - tick / 100),
      })),
      prayerLine: buildPoints(prayerScores),
      quranLine: buildPoints(quranScores),
      prayerDots: buildDots(prayerScores, 'fill-emerald-600'),
      quranDots: buildDots(quranScores, 'fill-violet-600'),
    };
  }, [weeklyData]);

  const selectedExportKeys = useMemo(() => {
    return EXPORT_SECTION_OPTIONS.filter((section) => exportSelections[section.key]).map((section) => section.key);
  }, [exportSelections]);

  const hasSelectedExportSection = selectedExportKeys.length > 0;

  const toggleExportSelection = (key: ExportSectionKey) => {
    setExportSelections((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  const selectAllExportSections = () => {
    setExportSelections({
      weeklyTrend: true,
      currentStreak: true,
      bestStreak: true,
      sevenDayAverages: true,
      salahHeatmap: true,
      quranHeatmap: true,
    });
  };

  const clearAllExportSections = () => {
    setExportSelections({
      weeklyTrend: false,
      currentStreak: false,
      bestStreak: false,
      sevenDayAverages: false,
      salahHeatmap: false,
      quranHeatmap: false,
    });
  };

  const handleExport = async () => {
    if (!hasSelectedExportSection) {
      toast.error('Select at least one section to export.');
      return;
    }

    const selectedLabels = EXPORT_SECTION_OPTIONS.filter((section) => exportSelections[section.key]).map(
      (section) => section.label,
    );

    if (exportFormat === 'json') {
      const exportPayload: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        selectedDate: selectedDateKey,
        includedSections: selectedLabels,
        user: {
          name: authUser?.name || 'User',
          email: authUser?.email || '',
        },
      };

      if (exportSelections.weeklyTrend) {
        exportPayload.weeklyTrend = weeklyData;
      }
      if (exportSelections.currentStreak) {
        exportPayload.currentStreakInDays = currentStreak;
      }
      if (exportSelections.bestStreak) {
        exportPayload.bestStreakInDays = bestStreak;
      }
      if (exportSelections.sevenDayAverages) {
        exportPayload.sevenDayAverages = {
          salah: weeklyPrayerConsistency,
          quran: weeklyQuranConsistency,
        };
      }
      if (exportSelections.salahHeatmap) {
        exportPayload.salahHeatmap30Days = prayerHeatmapData;
      }
      if (exportSelections.quranHeatmap) {
        exportPayload.quranHeatmap30Days = quranHeatmapData;
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `hikmah-tracker-status-${selectedDateKey}.json`);
      toast.success('Tracker JSON exported.');
      return;
    }

    if (!exportPreviewRef.current) {
      toast.error('Unable to generate export image.');
      return;
    }

    setIsExporting(true);
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const canvas = await html2canvas(exportPreviewRef.current, {
        useCORS: true,
        backgroundColor: '#f8fafc',
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((createdBlob) => resolve(createdBlob), 'image/png', 1);
      });

      if (!blob) {
        throw new Error('Image blob generation failed');
      }

      downloadBlob(blob, `hikmah-tracker-status-${selectedDateKey}.png`);
      toast.success('Tracker status image exported.');
    } catch (error) {
      console.error('Export image failed:', error);
      toast.error('Failed to export image.');
    } finally {
      setIsExporting(false);
    }
  };

  const updateSelectedRecord = useCallback(
    (updater: (current: ReturnType<typeof normalizeDayRecord>) => ReturnType<typeof normalizeDayRecord>) => {
      setRecords((previous) => {
        const current = normalizeDayRecord(previous[selectedDateKey]);
        const next = updater(current);

        return {
          ...previous,
          [selectedDateKey]: {
            ...next,
            updatedAt: nowIso(),
          },
        };
      });
    },
    [selectedDateKey],
  );

  const handleStatusChange = (prayerName: PrayerName, status: PrayerStatus) => {
    updateSelectedRecord((current) => ({
      ...current,
      prayers: {
        ...current.prayers,
        [prayerName]: {
          ...current.prayers[prayerName],
          status,
          updatedAt: nowIso(),
        },
      },
    }));
  };

  const handlePrayerNoteChange = (prayerName: PrayerName, note: string) => {
    updateSelectedRecord((current) => ({
      ...current,
      prayers: {
        ...current.prayers,
        [prayerName]: {
          ...current.prayers[prayerName],
          note,
          updatedAt: nowIso(),
        },
      },
    }));
  };

  const handleQuranStatusChange = (status: QuranStatus) => {
    updateSelectedRecord((current) => ({
      ...current,
      quran: {
        status,
        updatedAt: nowIso(),
      },
    }));
  };

  const handleDailyNoteChange = (note: string) => {
    updateSelectedRecord((current) => ({
      ...current,
      dailyNote: note,
      updatedAt: nowIso(),
    }));
  };

  const handleMarkAllPrayed = () => {
    updateSelectedRecord((current) => {
      const nextPrayers = { ...current.prayers };

      PRAYER_KEYS.forEach((prayerKey) => {
        nextPrayers[prayerKey] = {
          ...nextPrayers[prayerKey],
          status: 'prayed',
          updatedAt: nowIso(),
        };
      });

      return {
        ...current,
        prayers: nextPrayers,
      };
    });

    toast.success('All five prayers are marked as prayed.');
  };

  const handleResetDay = () => {
    setRecords((previous) => {
      const next = { ...previous };
      delete next[selectedDateKey];
      return next;
    });

    toast.success('Selected day has been reset.');
  };

  const canGoToPreviousDay = selectedDateKey > memberSinceDateKey;

  const goToPreviousDay = () => {
    if (!canGoToPreviousDay) return;

    setSelectedDateKey((previousDateKey) => {
      const next = addDays(parseDateKey(previousDateKey), -1);
      const nextDateKey = formatDateKey(next);
      return nextDateKey < memberSinceDateKey ? memberSinceDateKey : nextDateKey;
    });
  };

  const canGoToNextDay = selectedDateKey < todayDateKey;

  const goToNextDay = () => {
    if (!canGoToNextDay) return;

    setSelectedDateKey((previousDateKey) => {
      const next = addDays(parseDateKey(previousDateKey), 1);
      return formatDateKey(next);
    });
  };

  const goToToday = () => {
    setSelectedDateKey(todayDateKey);
  };

  const syncPrayerTimes = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setTimeSource('Using default prayer windows. Browser geolocation is unavailable.');
      return;
    }

    setIsSyncingTimes(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000 * 60 * 10,
        });
      });

      const school = authUser?.madhab === 'hanafi' ? '2' : '1';
      const response = await fetch(
        `${API_URL}/prayers/times?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&method=3&school=${school}`,
      );
      const payload = await response.json();

      if (payload?.status === 'success') {
        setPrayerTimings(extractPrayerTimings(payload));

        const city = payload?.data?.location?.city;
        const country = payload?.data?.location?.country;
        const fallbackCoords = `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`;
        setTimeSource(`Live prayer windows from ${city && country ? `${city}, ${country}` : fallbackCoords}.`);
      } else {
        setTimeSource('Using default prayer windows. Could not fetch live prayer times.');
      }
    } catch (error) {
      console.error('Failed to sync prayer times:', error);
      setTimeSource('Using default prayer windows. Allow location access to sync live times.');
    } finally {
      setIsSyncingTimes(false);
    }
  }, [authUser?.madhab]);

  useEffect(() => {
    syncPrayerTimes();
  }, [syncPrayerTimes]);

  if (!authUser) {
    return (
      <>
        <PageSEO
          title="Salah Tracker"
          description="Track your daily salah consistency and worship streaks."
          path="/salah-tracker"
          noIndex
          noFollow
        />
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-20">
          <div className="mx-auto max-w-lg px-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
              <p className="text-base text-gray-700">Please sign in to view your Salah Tracker.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!isStoreLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-24">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <p className="text-sm font-medium text-emerald-700">Loading your Salah Tracker...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageSEO
        title="Salah Tracker"
        description="Track every daily prayer with streaks, weekly consistency, and progress insights."
        path="/salah-tracker"
        noIndex
        noFollow
      />

      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-100/60 pt-0 sm:pt-16">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.25),transparent_58%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.16),transparent_52%)]" />
            <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.35fr_1fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <SparklesIcon className="h-4 w-4" />
                  Daily Worship Discipline
                </div>

                <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Salah Tracker</h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
                  Log every prayer and Quran reading once a day to build consistent habits.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    onClick={goToPreviousDay}
                    disabled={!canGoToPreviousDay}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      canGoToPreviousDay
                        ? 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
                        : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous
                  </button>

                  <button
                    onClick={goToToday}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <CalendarDaysIcon className="h-4 w-4" />
                    Today
                  </button>

                  <button
                    onClick={goToNextDay}
                    disabled={!canGoToNextDay}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      canGoToNextDay
                        ? 'border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
                        : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                  >
                    Next
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>

                  <span className="ml-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                    {formatReadableDate(selectedDateKey)}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500 sm:text-sm">
                  <button
                    onClick={syncPrayerTimes}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${isSyncingTimes ? 'animate-spin' : ''}`} />
                    {isSyncingTimes ? 'Syncing...' : 'Refresh Prayer Times'}
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5">
                    <MapPinIcon className="h-4 w-4 text-emerald-600" />
                    {timeSource}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-violet-700">
                    Tracking from member since {formatReadableDate(memberSinceDateKey)}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-emerald-50 p-4">
                  <p className="text-sm italic leading-relaxed text-gray-700">
                    "Indeed, Allah does not guide him who is a transgressor and a liar."
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                    — Surah Ghafir, 40:28
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-sm">
                <p className="text-sm font-medium uppercase tracking-wide text-gray-500">Selected Day Score</p>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className="relative h-32 w-44 rounded-full sm:h-36 sm:w-100"
                    style={{
                      background: `conic-gradient(#059669 ${selectedScore}%, #d1fae5 ${selectedScore}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white">
                      <span className="text-2xl font-bold leading-none text-gray-900 sm:text-3xl">{selectedScore}%</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
                      <CheckCircleIcon className="h-4 w-4" />
                      Prayed: {selectedPrayedCount}
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">
                      <ClockIcon className="h-4 w-4" />
                      Qada: {selectedQadaCount}
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
                      <XCircleIcon className="h-4 w-4" />
                      Missed: {selectedMissedCount}
                    </p>
                    <p className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-1 text-violet-700">
                      <BookOpenIcon className="h-4 w-4" />
                      Quran: {selectedQuranScore}% ({QURAN_STATUS_LABEL[selectedRecord.quran.status]})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Completed Log</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{selectedLoggedCount}/5</p>
              <p className="mt-1 text-sm text-gray-600">Prayers marked for selected day</p>
            </article>

            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Streak</p>
              <p className="mt-2 inline-flex items-center gap-2 text-3xl font-bold text-emerald-700">
                <FireIcon className="h-7 w-7" />
                {currentStreak}
              </p>
              <p className="mt-1 text-sm text-gray-600">Consecutive active salah days</p>
            </article>

            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Best Streak</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{bestStreak}</p>
              <p className="mt-1 text-sm text-gray-600">Your longest streak so far</p>
            </article>

            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">7-Day Averages</p>
              <p className="mt-2 text-lg font-bold text-gray-900">Salah {weeklyPrayerConsistency}%</p>
              <p className="mt-1 text-lg font-bold text-violet-700">Quran {weeklyQuranConsistency}%</p>
            </article>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr_1fr]">
            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-lg sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Prayer Checklist</h2>
                  <p className="text-sm text-gray-600">Status, note, and precise prayer window for each salah.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleMarkAllPrayed}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Mark All Prayed
                  </button>
                  <button
                    onClick={handleResetDay}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Reset Day
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {PRAYER_CONFIGS.map((prayer) => {
                  const entry = selectedRecord.prayers[prayer.key];
                  const PrayerIcon = prayer.icon;
                  const window = prayerWindows[prayer.key];

                  return (
                    <article
                      key={prayer.key}
                      className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white via-white to-emerald-50/40 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${prayer.gradient} text-white shadow-sm`}
                          >
                            <PrayerIcon className="h-5 w-5" />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-gray-900">{prayer.label}</h3>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[entry.status].badge}`}>
                                {STATUS_META[entry.status].label}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-gray-600">
                              Time: {window.start} - {window.end}
                            </p>
                            {prayer.key === 'isha' && (
                              <p className="mt-1 text-xs font-medium text-violet-700">Isha ends at midnight.</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {STATUS_ORDER.map((status) => {
                            const isActive = entry.status === status;
                            return (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(prayer.key, status)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                                  isActive
                                    ? STATUS_META[status].activeButton
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
                                }`}
                              >
                                {STATUS_META[status].label}
                              </button>
                            );
                          })}

                          {entry.status !== 'pending' && (
                            <button
                              onClick={() => handleStatusChange(prayer.key, 'pending')}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 transition hover:border-gray-300 hover:text-gray-700"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3">
                        <input
                          type="text"
                          value={entry.note}
                          onChange={(event) => handlePrayerNoteChange(prayer.key, event.target.value)}
                          placeholder="Optional note (jama'ah, late due to travel, etc.)"
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <BookOpenIcon className="h-5 w-5 text-sky-700" />
                  <h3 className="text-base font-semibold text-gray-900">Quran Activity (Once Daily)</h3>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {QURAN_STATUS_OPTIONS.map((option) => {
                    const isActive = selectedRecord.quran.status === option.status;
                    return (
                      <button
                        key={option.status}
                        onClick={() => handleQuranStatusChange(option.status)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? option.activeClass
                            : 'border-blue-100 bg-white text-gray-700 hover:border-sky-300 hover:text-sky-700'
                        }`}
                      >
                        <p className="font-semibold">{option.label}</p>
                        <p className={`text-xs ${isActive ? 'text-white/90' : 'text-gray-500'}`}>{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="dailyNote" className="mb-2 block text-sm font-semibold text-gray-800">
                  Daily Reflection
                </label>
                <textarea
                  id="dailyNote"
                  rows={4}
                  value={selectedRecord.dailyNote}
                  onChange={(event) => handleDailyNoteChange(event.target.value)}
                  placeholder="Write a short reflection about your day and worship..."
                  className="w-full rounded-2xl border border-gray-200 px-3 py-3 text-sm text-gray-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-2 text-xs text-gray-500">Your tracker data auto-saves in your browser for this account.</p>
              </div>
            </div>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Weekly Trend (Salah + Quran)</h3>
                <p className="mt-1 text-sm text-gray-600">Live day-by-day ups and downs. Green = Salah, Purple = Quran.</p>
                <p className="mt-1 text-xs text-gray-500">Range: {weeklyRangeLabel}</p>

                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Salah
                  </span>
                  <span className="inline-flex items-center gap-1 text-violet-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                    Quran
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <svg viewBox={`0 0 ${trendChart.width} ${trendChart.height}`} className="h-44 w-full">
                    {trendChart.gridY.map((row) => (
                      <line
                        key={row.tick}
                        x1={16}
                        y1={row.y}
                        x2={trendChart.width - 16}
                        y2={row.y}
                        className="stroke-gray-200"
                        strokeWidth={1}
                      />
                    ))}

                    <polyline
                      points={trendChart.prayerLine}
                      fill="none"
                      className="stroke-emerald-600"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points={trendChart.quranLine}
                      fill="none"
                      className="stroke-violet-600"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {trendChart.prayerDots}
                    {trendChart.quranDots}
                  </svg>

                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {weeklyData.map((day) => (
                      <div key={day.dateKey} className="text-center">
                        <p className="text-[11px] font-medium text-gray-500">{day.label}</p>
                        <p className="text-[10px] text-emerald-700">{day.prayerScore}%</p>
                        <p className="text-[10px] text-violet-700">{day.quranScore}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Salah Heatmap (30 Days)</h3>
                <p className="mt-1 text-sm text-gray-600">Perfect days: {perfectDaysInPrayerHeatmap}/30</p>

                <div className="mt-4 grid grid-cols-10 gap-1.5">
                  {prayerHeatmapData.map((day) => (
                    <div
                      key={day.dateKey}
                      className={`h-5 w-full rounded border ${getPrayerHeatmapTone(day.score)}`}
                      title={`${day.dateKey}: ${day.score}%`}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Quran Activity Heatmap (30 Days)</h3>
                <p className="mt-1 text-sm text-gray-600">Read days: {quranReadDaysInHeatmap}/30</p>

                <div className="mt-4 grid grid-cols-10 gap-1.5">
                  {quranHeatmapData.map((day) => (
                    <div
                      key={day.dateKey}
                      className={`h-5 w-full rounded border ${getQuranHeatmapTone(day.score)}`}
                      title={`${day.dateKey}: ${QURAN_STATUS_LABEL[day.status]}`}
                    />
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Not read</span>
                  <span>Tafseer</span>
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ArrowDownTrayIcon className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Export Tracker Status</h3>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Select sections, choose format, and export as JSON or clean status image.
                </p>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Format</label>
                  <select
                    value={exportFormat}
                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="pic">pic</option>
                    <option value="json">json</option>
                  </select>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={selectAllExportSections}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-emerald-300 hover:text-emerald-700"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllExportSections}
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-rose-300 hover:text-rose-700"
                  >
                    Clear All
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {EXPORT_SECTION_OPTIONS.map((section) => (
                    <label
                      key={section.key}
                      className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700 transition hover:border-emerald-200"
                    >
                      <input
                        type="checkbox"
                        checked={exportSelections[section.key]}
                        onChange={() => toggleExportSelection(section.key)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{section.label}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleExport}
                  disabled={isExporting || !hasSelectedExportSection}
                  className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    isExporting || !hasSelectedExportSection
                      ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                      : 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                  }`}
                >
                  <ArrowDownTrayIcon className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                  {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
                </button>
              </section>
            </aside>
          </section>
        </div>
      </div>

      <div className="pointer-events-none fixed -left-[99999px] top-0 z-[-1]">
        <div ref={exportPreviewRef} className="w-[1080px] rounded-[28px] border border-emerald-100 bg-white p-8 text-gray-900 shadow-2xl">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-violet-50 p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <h2 className="whitespace-nowrap text-[32px] font-bold">HikmahSphere Salah and Quran Tracker Status</h2>
                <p className="mt-2 text-sm text-gray-600">Date: {formatReadableDate(selectedDateKey)}</p>
                <p className="mt-1 text-sm text-gray-600">
                  User: {authUser?.name} {authUser?.email ? `(${authUser.email})` : ''}
                </p>
                <p className="mt-1 text-sm text-violet-700">Member Since: {formatReadableDate(memberSinceDateKey)}</p>
              </div>

              <div className="mt-14 max-w-[340px] shrink-0 rounded-xl border border-violet-100 bg-white/80 p-3 text-right">
                <p className="text-xs italic leading-relaxed text-gray-700">
                  "Indeed, Allah does not guide him who is a transgressor and a liar."
                </p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                  — Surah Ghafir, 40:28
                </p>
              </div>
            </div>
          </div>

          {exportSelections.weeklyTrend && (
            <section className="mt-6 rounded-2xl border border-gray-200 p-5">
              <h3 className="text-xl font-semibold">Weekly Trend (Salah + Quran)</h3>
              <p className="mt-1 text-sm text-gray-600">Range: {weeklyRangeLabel}</p>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {weeklyData.map((day) => (
                  <div key={`export-week-${day.dateKey}`} className="rounded-xl border border-gray-100 bg-gray-50 p-2 text-center">
                    <p className="text-xs font-semibold text-gray-500">{day.label}</p>
                    <div className="mt-2 flex h-24 items-end justify-center gap-1">
                      <div
                        className="w-3 rounded-t bg-emerald-500"
                        style={{ height: `${Math.max(8, day.prayerScore)}%` }}
                        title={`Salah ${day.prayerScore}%`}
                      />
                      <div
                        className="w-3 rounded-t bg-violet-500"
                        style={{ height: `${Math.max(8, day.quranScore)}%` }}
                        title={`Quran ${day.quranScore}%`}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-emerald-700">S {day.prayerScore}%</p>
                    <p className="text-[11px] text-violet-700">Q {day.quranScore}%</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(exportSelections.currentStreak || exportSelections.bestStreak || exportSelections.sevenDayAverages) && (
            <section className="mt-6 grid grid-cols-3 gap-3">
              {exportSelections.currentStreak && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Current Streak</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-800">{currentStreak} Days</p>
                </div>
              )}
              {exportSelections.bestStreak && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Best Streak</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-800">{bestStreak} Days</p>
                </div>
              )}
              {exportSelections.sevenDayAverages && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-violet-700">7-Day Averages</p>
                  <p className="mt-2 text-lg font-bold text-emerald-800">Salah {weeklyPrayerConsistency}%</p>
                  <p className="text-lg font-bold text-violet-800">Quran {weeklyQuranConsistency}%</p>
                </div>
              )}
            </section>
          )}

          {exportSelections.salahHeatmap && (
            <section className="mt-6 rounded-2xl border border-emerald-100 p-5">
              <h3 className="text-xl font-semibold">Salah Heatmap (30 Days)</h3>
              <div className="mt-4 grid grid-cols-10 gap-1.5">
                {prayerHeatmapData.map((day) => (
                  <div
                    key={`export-salah-${day.dateKey}`}
                    className={`h-6 rounded border ${getPrayerHeatmapTone(day.score)}`}
                    title={`${day.dateKey}: ${day.score}%`}
                  />
                ))}
              </div>
            </section>
          )}

          {exportSelections.quranHeatmap && (
            <section className="mt-6 rounded-2xl border border-violet-100 p-5">
              <h3 className="text-xl font-semibold">Quran Activity Heatmap (30 Days)</h3>
              <div className="mt-4 grid grid-cols-10 gap-1.5">
                {quranHeatmapData.map((day) => (
                  <div
                    key={`export-quran-${day.dateKey}`}
                    className={`h-6 rounded border ${getQuranHeatmapTone(day.score)}`}
                    title={`${day.dateKey}: ${QURAN_STATUS_LABEL[day.status]}`}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
};

export default SalahTracker;
