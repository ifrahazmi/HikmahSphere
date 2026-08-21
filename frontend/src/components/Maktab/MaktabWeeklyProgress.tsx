import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudArrowUpIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { API_URL, resolveBackendUrl } from '../../config';
import { MAKTAB_TEACHERS, type MaktabTeacherSlug } from '../../data/maktabTeachers';
import { useAuth } from '../../hooks/useAuth';
import {
  addIsoWeeks,
  formatIsoWeekLabel,
  getIsoWeekBounds,
  getIsoWeekFromDate,
} from '../../utils/isoWeek';
import { isImageFile, optimizeImageForUpload, readFileAsDataUrl } from '../../utils/imageUpload';
import { ZoomablePhotoLightbox } from './ZoomablePhotoViewer';

const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const NOTE_MAX = 800;

type WeeklyPhoto = {
  index: number;
  name: string;
  mimeType: string;
  size: number;
};

type WeeklyReport = {
  id: string;
  teacher: string;
  teacherName: string;
  isoWeek: string;
  note: string;
  photos: WeeklyPhoto[];
  updatedAt: string;
};

type ApiEnvelope = {
  status?: string;
  message?: string;
  data?: { report?: WeeklyReport | null };
};

const weeklyPhotoEndpoint = (reportId: string, index: number) =>
  `${API_URL}/maktab/weekly-reports/${reportId}/photos/${index}`;

const compareIsoWeeks = (a: string, b: string): number => {
  const aBounds = getIsoWeekBounds(a);
  const bBounds = getIsoWeekBounds(b);
  if (!aBounds || !bBounds) return 0;
  return aBounds.weekStart.getTime() - bBounds.weekStart.getTime();
};

const WEEK_PICKER_HISTORY = 78;

const listSelectableWeeks = (todayIsoWeek: string): string[] => {
  const newest = addIsoWeeks(todayIsoWeek, 1) ?? todayIsoWeek;
  const weeks: string[] = [];
  let cursor: string | null = newest;
  for (let i = 0; i <= WEEK_PICKER_HISTORY && cursor; i += 1) {
    weeks.push(cursor);
    cursor = addIsoWeeks(cursor, -1);
  }
  return weeks;
};

const weekNavButtonClass =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-md ring-2 ring-white/70 hover:bg-emerald-50 hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-35 disabled:hover:scale-100 disabled:hover:bg-white disabled:hover:shadow-md';

const MaktabWeeklyProgress: React.FC = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole(['superadmin', 'manager']);

  const todayIsoWeek = useMemo(() => getIsoWeekFromDate(new Date()).isoWeek, []);
  const [teacher, setTeacher] = useState<MaktabTeacherSlug>(MAKTAB_TEACHERS[0].slug);
  const [isoWeek, setIsoWeek] = useState(todayIsoWeek);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  const weekPickerRef = useRef<HTMLDivElement>(null);
  const selectedWeekOptionRef = useRef<HTMLButtonElement>(null);

  const fetchReport = useCallback(async (nextTeacher: string, nextWeek: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ teacher: nextTeacher, isoWeek: nextWeek });
      const response = await fetch(`${API_URL}/maktab/weekly-reports?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope;
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load weekly progress');
      }
      setReport(payload.data?.report ?? null);
    } catch (error) {
      console.error(error);
      setReport(null);
      toast.error(error instanceof Error ? error.message : 'Failed to load weekly progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(teacher, isoWeek);
  }, [fetchReport, teacher, isoWeek]);

  useEffect(() => {
    setPhotoUrls({});
    if (!report || !canManage) return undefined;

    let cancelled = false;
    const loadPhotoUrls = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const entries = await Promise.all(
          report.photos.map(async (photo) => {
            const response = await fetch(weeklyPhotoEndpoint(report.id, photo.index), {
              headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json();
            if (!response.ok || !payload.data?.url) {
              throw new Error(payload.message || 'Failed to load weekly photo');
            }
            return [photo.index, resolveBackendUrl(payload.data.url)] as const;
          })
        );
        if (!cancelled) setPhotoUrls(Object.fromEntries(entries));
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Failed to load weekly photos');
        }
      }
    };

    void loadPhotoUrls();
    const refreshTimer = window.setInterval(() => void loadPhotoUrls(), 4 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [canManage, report]);

  const weekLabel = formatIsoWeekLabel(isoWeek);
  const isCurrentWeek = isoWeek === todayIsoWeek;
  const prevWeek = addIsoWeeks(isoWeek, -1);
  const nextWeek = addIsoWeeks(isoWeek, 1);
  const maxForwardWeek = addIsoWeeks(todayIsoWeek, 1);
  const canGoNext = Boolean(nextWeek && maxForwardWeek && compareIsoWeeks(nextWeek, maxForwardWeek) <= 0);
  const selectableWeeks = useMemo(() => listSelectableWeeks(todayIsoWeek), [todayIsoWeek]);

  useEffect(() => {
    if (!weekPickerOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!weekPickerRef.current?.contains(event.target as Node)) {
        setWeekPickerOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWeekPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    selectedWeekOptionRef.current?.scrollIntoView({ block: 'nearest' });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [weekPickerOpen, isoWeek]);

  const featuredPhoto =
    report && report.photos.length > 0 ? photoUrls[report.photos[0].index] : null;

  useEffect(() => {
    if (!publishOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) setPublishOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [publishOpen, deleting]);

  const goWeek = (delta: number) => {
    const next = addIsoWeeks(isoWeek, delta);
    if (!next) return;
    if (delta > 0 && !canGoNext) return;
    setIsoWeek(next);
  };

  const deleteReport = async () => {
    if (!report) return;
    if (!window.confirm('Delete this week’s published register? This cannot be undone.')) {
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please sign in again to manage weekly reports.');
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/maktab/weekly-reports/${report.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope;
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to delete report');
      }
      toast.success('Weekly register removed');
      setReport(null);
      setLightboxIndex(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 mb-3">
          Classroom progress
        </p>
        <h2
          className="text-2xl sm:text-3xl text-slate-900 mb-3"
          style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
        >
          Weekly attendance &amp; learning register
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Weekly register photos are available to authorized administrators and managers.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100/90 bg-white shadow-sm">
        <div className="rounded-t-2xl bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 px-4 sm:px-6 py-4 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="inline-flex rounded-xl bg-white/10 p-1 backdrop-blur-sm self-start"
              role="tablist"
              aria-label="Maktab teacher"
            >
              {MAKTAB_TEACHERS.map((item) => {
                const selected = teacher === item.slug;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTeacher(item.slug)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      selected
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-emerald-50 hover:bg-white/10'
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <div ref={weekPickerRef} className="relative flex items-center justify-between sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setWeekPickerOpen(false);
                  goWeek(-1);
                }}
                disabled={!prevWeek}
                className={weekNavButtonClass}
                aria-label="Previous week"
              >
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => setWeekPickerOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={weekPickerOpen}
                className="min-w-[13.5rem] rounded-xl bg-white px-3 py-2 text-center text-emerald-900 shadow-md ring-2 ring-white/70 hover:bg-emerald-50 transition-colors"
              >
                <span className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-semibold leading-tight">
                  {weekLabel}
                  <ChevronDownIcon
                    className={`w-4 h-4 shrink-0 text-emerald-700 transition-transform ${
                      weekPickerOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-emerald-700/80 mt-0.5">
                  {isCurrentWeek ? 'This week' : isoWeek} · tap to jump
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeekPickerOpen(false);
                  goWeek(1);
                }}
                disabled={!canGoNext}
                className={weekNavButtonClass}
                aria-label="Next week"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>

              {weekPickerOpen && (
                <div
                  role="listbox"
                  aria-label="Select a week"
                  className="absolute right-0 top-full z-30 mt-2 w-[min(100%,20rem)] max-h-72 overflow-y-auto rounded-xl border border-emerald-100 bg-white py-1 text-slate-800 shadow-xl"
                >
                  {selectableWeeks.map((week) => {
                    const selected = week === isoWeek;
                    const current = week === todayIsoWeek;
                    return (
                      <button
                        key={week}
                        ref={selected ? selectedWeekOptionRef : undefined}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setIsoWeek(week);
                          setWeekPickerOpen(false);
                        }}
                        className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white'
                            : 'hover:bg-emerald-50 text-slate-800'
                        }`}
                      >
                        <span>
                          <span className="block font-semibold leading-snug">{formatIsoWeekLabel(week)}</span>
                          <span className={`block text-[11px] mt-0.5 ${selected ? 'text-emerald-100' : 'text-slate-500'}`}>
                            {week}
                            {current ? ' · this week' : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {canManage && (
            <div className="mb-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                {report ? 'Update this week' : 'Publish this week'}
              </button>
              {report && (
                <button
                  type="button"
                  onClick={() => void deleteReport()}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm font-semibold disabled:opacity-50"
                >
                  <TrashIcon className="w-5 h-5" />
                  Remove
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 sm:h-80 rounded-2xl bg-slate-100" />
              <div className="flex gap-3">
                <div className="h-16 w-20 rounded-xl bg-slate-100" />
                <div className="h-16 w-20 rounded-xl bg-slate-100" />
                <div className="h-16 w-20 rounded-xl bg-slate-100" />
              </div>
            </div>
          ) : report && featuredPhoto ? (
            <div>
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="group relative block w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-inner"
              >
                <img
                  src={featuredPhoto}
                  alt={`${report.teacherName} register for ${weekLabel}`}
                  className="w-full max-h-[32rem] object-contain bg-[radial-gradient(circle_at_top,_#1e293b,_#0f172a)]"
                />
                <span className="absolute bottom-3 right-3 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                  Open & zoom
                </span>
              </button>

              {report.photos.length > 1 && (
                <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                  {report.photos.map((photo) => (
                    <button
                      key={photo.index}
                      type="button"
                      onClick={() => setLightboxIndex(photo.index)}
                      className="shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 hover:border-emerald-400 hover:shadow-sm transition-all"
                    >
                      <img
                        src={photoUrls[photo.index]}
                        alt={photo.name || `Register page ${photo.index + 1}`}
                        className="h-20 w-28 object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {report.note && (
                <p className="mt-5 rounded-xl bg-emerald-50/80 border border-emerald-100 px-4 py-3 text-sm text-slate-700 leading-relaxed">
                  {report.note}
                </p>
              )}
            </div>
          ) : report && canManage ? (
            <div className="animate-pulse space-y-4">
              <div className="h-64 sm:h-80 rounded-2xl bg-slate-100" />
              <p className="text-center text-sm text-slate-500">Loading private register photos…</p>
            </div>
          ) : report && !canManage ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-6 py-14 text-center">
              <PhotoIcon className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
              <p className="font-semibold text-slate-900">Register photos are private</p>
              <p className="mt-1 text-sm text-slate-600">An administrator or manager account is required to view them.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-emerald-100">
                <CalendarDaysIcon className="h-7 w-7 text-emerald-600" />
              </div>
              <h3
                className="text-lg text-slate-900 mb-2"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                No register published for this week yet
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {canManage
                  ? 'Upload a photo of this week’s attendance sheet so families can follow along.'
                  : 'Check another week, or come back after the teacher’s register is posted.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {lightboxIndex !== null && report && (
        <ZoomablePhotoLightbox
          src={photoUrls[lightboxIndex]}
          alt={report.photos[lightboxIndex]?.name || 'Register photo'}
          title={`${report.teacherName} · ${weekLabel}${
            report.photos.length > 1 ? ` · ${lightboxIndex + 1} / ${report.photos.length}` : ''
          }`}
          onClose={() => setLightboxIndex(null)}
          onPrev={
            report.photos.length > 1
              ? () =>
                  setLightboxIndex((current) =>
                    current === null ? current : (current - 1 + report.photos.length) % report.photos.length
                  )
              : undefined
          }
          onNext={
            report.photos.length > 1
              ? () =>
                  setLightboxIndex((current) =>
                    current === null ? current : (current + 1) % report.photos.length
                  )
              : undefined
          }
        />
      )}

      {publishOpen && canManage && (
        <PublishWeeklyModal
          teacher={teacher}
          isoWeek={isoWeek}
          weekLabel={weekLabel}
          existing={report}
          photoUrls={photoUrls}
          onClose={() => setPublishOpen(false)}
          onSaved={(nextReport) => {
            setReport(nextReport);
            setPublishOpen(false);
          }}
        />
      )}
    </div>
  );
};

type PublishWeeklyModalProps = {
  teacher: MaktabTeacherSlug;
  isoWeek: string;
  weekLabel: string;
  existing: WeeklyReport | null;
  photoUrls: Record<number, string>;
  onClose: () => void;
  onSaved: (report: WeeklyReport) => void;
};

const PublishWeeklyModal: React.FC<PublishWeeklyModalProps> = ({
  teacher,
  isoWeek,
  weekLabel,
  existing,
  photoUrls,
  onClose,
  onSaved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [removeIndexes, setRemoveIndexes] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const remainingExisting = (existing?.photos ?? []).filter(
    (photo) => !removeIndexes.includes(photo.index)
  );
  const totalPhotos = remainingExisting.length + newFiles.length;

  useEffect(() => {
    return () => {
      newPreviews.forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [newPreviews]);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    const room = MAX_PHOTOS - totalPhotos;
    if (room <= 0) {
      toast.error(`You can attach at most ${MAX_PHOTOS} photos.`);
      return;
    }

    const accepted: File[] = [];
    const previews: string[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!isImageFile(file) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
        toast.error(`${file.name} is not a supported image.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        toast.error(`${file.name} is larger than 10 MB.`);
        continue;
      }
      try {
        const preview = await readFileAsDataUrl(file);
        accepted.push(file);
        previews.push(preview);
      } catch {
        toast.error(`Could not read ${file.name}`);
      }
    }

    if (accepted.length) {
      setNewFiles((prev) => [...prev, ...accepted]);
      setNewPreviews((prev) => [...prev, ...previews]);
    }
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleRemoveExisting = (index: number) => {
    setRemoveIndexes((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index]
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (totalPhotos < 1) {
      toast.error('Add at least one register photo.');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Please sign in again to publish.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('note', note.trim());
      if (!existing) {
        formData.append('teacher', teacher);
        formData.append('isoWeek', isoWeek);
      } else if (removeIndexes.length) {
        formData.append('removeIndexes', JSON.stringify(removeIndexes));
      }

      for (const file of newFiles) {
        const optimized = await optimizeImageForUpload(file, {
          maxWidth: 2000,
          maxHeight: 2000,
          targetMaxBytes: 1.2 * 1024 * 1024,
        });
        formData.append('photos', optimized);
      }

      const url = existing
        ? `${API_URL}/maktab/weekly-reports/${existing.id}`
        : `${API_URL}/maktab/weekly-reports`;
      const response = await fetch(url, {
        method: existing ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope;
      if (!response.ok || !payload.data?.report) {
        throw new Error(payload.message || 'Failed to save weekly report');
      }
      toast.success(existing ? 'Weekly register updated' : 'Weekly register published');
      onSaved(payload.data.report);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save weekly report');
    } finally {
      setSubmitting(false);
    }
  };

  const teacherName = MAKTAB_TEACHERS.find((item) => item.slug === teacher)?.name ?? teacher;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-publish-title"
    >
      <button
        type="button"
        aria-label="Close publish form"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <div className="relative z-10 w-full sm:max-w-xl max-h-[92svh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl shadow-black/30 border border-emerald-100/80">
        <form onSubmit={(event) => void submit(event)}>
          <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-5 sm:px-6 py-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-emerald-100 font-medium mb-1 uppercase tracking-wide">
                  {existing ? 'Update register' : 'Publish register'}
                </p>
                <h2
                  id="weekly-publish-title"
                  className="text-xl sm:text-2xl font-semibold leading-snug"
                  style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                >
                  {teacherName}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="shrink-0 rounded-xl bg-white/15 hover:bg-white/25 p-2 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-emerald-50/90">{weekLabel}</p>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Register photos <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                JPG, PNG, or WebP · up to {MAX_PHOTOS} photos · 10 MB each. Handwritten sheets work best when
                the page is flat and well lit.
              </p>

              {existing && existing.photos.length > 0 && (
                <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {existing.photos.map((photo) => {
                    const removed = removeIndexes.includes(photo.index);
                    return (
                      <button
                        key={photo.index}
                        type="button"
                        onClick={() => toggleRemoveExisting(photo.index)}
                        className={`relative overflow-hidden rounded-xl border ${
                          removed ? 'border-red-300 opacity-40' : 'border-slate-200'
                        }`}
                      >
                        <img
                          src={photoUrls[photo.index]}
                          alt={photo.name}
                          className="h-20 w-full object-cover"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 text-[10px] text-white py-0.5">
                          {removed ? 'Removed' : 'Keep · tap to remove'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {newPreviews.length > 0 && (
                <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {newPreviews.map((preview, index) => (
                    <div key={`${preview}-${index}`} className="relative overflow-hidden rounded-xl border border-emerald-200">
                      <img src={preview} alt={newFiles[index]?.name || 'New photo'} className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="absolute top-1 right-1 rounded-md bg-black/60 p-1 text-white"
                        aria-label="Remove new photo"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={totalPhotos >= MAX_PHOTOS}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                <PhotoIcon className="w-5 h-5" />
                Add photos ({totalPhotos}/{MAX_PHOTOS})
              </button>
            </div>

            <div>
              <label htmlFor="weekly-note" className="block text-sm font-semibold text-slate-800 mb-1.5">
                Short note <span className="text-slate-400 font-medium">(optional)</span>
              </label>
              <textarea
                id="weekly-note"
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g. All children present except two; Juz 1 revision this week."
              />
              <p className="mt-1 text-xs text-slate-400 text-right">
                {note.length}/{NOTE_MAX}
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || totalPhotos < 1}
                className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {submitting ? 'Saving…' : existing ? 'Save changes' : 'Publish week'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default MaktabWeeklyProgress;
