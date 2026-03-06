import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, BookmarkIcon, PlayIcon, ShareIcon, StopIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';
import { DUA_LIBRARY, getDuaBySlug } from '../data/dhikrDuaLibrary';
import { useAuth } from '../hooks/useAuth';

const BOOKMARKS_STORAGE_KEY = 'hikmahsphere:dhikr-dua:bookmarks';
const TRANSLATION_LANGUAGE_KEY = 'hikmahsphere:dhikr-dua:translation-language';
const LAST_VIEWED_STORAGE_KEY = 'hikmahsphere:dhikr-dua:last-viewed';

const ARABIC_HEADINGS = [
  'أَعُوذُ بِاللَّهِ مِنَ الشَّيطَانِ الرَّجِيمِ',
  'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
  'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  'بسم الله الرحمن الرحيم',
];

const splitArabicHeading = (arabicText: string): { heading: string; body: string } => {
  const clean = arabicText.trim();
  for (const heading of ARABIC_HEADINGS) {
    if (clean.startsWith(heading)) {
      const body = clean.slice(heading.length).trim();
      return { heading, body };
    }
  }
  return { heading: '', body: clean };
};

const DuaDetail: React.FC = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const dua = useMemo(() => getDuaBySlug(slug), [slug]);

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [lastViewedDuaId, setLastViewedDuaId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [translationLanguage, setTranslationLanguage] = useState<'english' | 'urdu'>('english');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isHydratingCloudStateRef = useRef(false);
  const hasLoadedCloudStateRef = useRef(false);

  useEffect(() => {
    const savedBookmarks = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (savedBookmarks) {
      const parsed = JSON.parse(savedBookmarks);
      if (Array.isArray(parsed)) setBookmarkedIds(parsed);
    }

    const savedLastViewed = localStorage.getItem(LAST_VIEWED_STORAGE_KEY);
    if (savedLastViewed) {
      setLastViewedDuaId(savedLastViewed);
    }

    const savedTranslationLanguage = localStorage.getItem(TRANSLATION_LANGUAGE_KEY);
    if (savedTranslationLanguage === 'urdu' || savedTranslationLanguage === 'english') {
      setTranslationLanguage(savedTranslationLanguage);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarkedIds));
  }, [bookmarkedIds]);

  useEffect(() => {
    localStorage.setItem(TRANSLATION_LANGUAGE_KEY, translationLanguage);
  }, [translationLanguage]);

  useEffect(() => {
    if (!lastViewedDuaId) return;
    localStorage.setItem(LAST_VIEWED_STORAGE_KEY, lastViewedDuaId);
  }, [lastViewedDuaId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!dua) return;
    setLastViewedDuaId(dua.id);
  }, [dua]);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      hasLoadedCloudStateRef.current = false;
      isHydratingCloudStateRef.current = false;
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const loadUserDhikrState = async () => {
      isHydratingCloudStateRef.current = true;

      try {
        const response = await fetch(`${API_URL}/dhikr/user-state`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch dhikr user state (${response.status})`);
        }

        const result = await response.json();
        const remote = (result?.data || {}) as Record<string, unknown>;

        const remoteBookmarks = Array.isArray(remote.bookmarks)
          ? Array.from(
              new Set(
                remote.bookmarks
                  .filter((item): item is string => typeof item === 'string')
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            )
          : [];

        const remoteLastViewed =
          typeof remote.lastViewedDuaId === 'string' && remote.lastViewedDuaId.trim()
            ? remote.lastViewedDuaId
            : null;

        const remoteSettings =
          remote.settings && typeof remote.settings === 'object'
            ? (remote.settings as Record<string, unknown>)
            : {};

        const remoteTranslation =
          remoteSettings.translationLanguage === 'urdu' ? 'urdu' : 'english';

        const hasRemoteState =
          Boolean(remote.updatedAt) || remoteBookmarks.length > 0 || !!remoteLastViewed;

        if (hasRemoteState) {
          setBookmarkedIds(remoteBookmarks);
          setTranslationLanguage(remoteTranslation);
          if (remoteLastViewed) {
            setLastViewedDuaId(remoteLastViewed);
          }
        } else {
          const localBookmarksRaw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
          let localBookmarks: unknown = [];
          if (localBookmarksRaw) {
            try {
              localBookmarks = JSON.parse(localBookmarksRaw);
            } catch {
              localBookmarks = [];
            }
          }
          const normalizedLocalBookmarks = Array.isArray(localBookmarks)
            ? Array.from(
                new Set(
                  localBookmarks
                    .filter((item): item is string => typeof item === 'string')
                    .map((item) => item.trim())
                    .filter(Boolean)
                )
              )
            : bookmarkedIds;
          const localLastViewed = localStorage.getItem(LAST_VIEWED_STORAGE_KEY) || lastViewedDuaId;
          const localTranslation =
            localStorage.getItem(TRANSLATION_LANGUAGE_KEY) === 'urdu' ? 'urdu' : translationLanguage;

          await fetch(`${API_URL}/dhikr/user-state`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookmarks: normalizedLocalBookmarks,
              lastViewedDuaId: localLastViewed,
              settings: {
                translationLanguage: localTranslation,
              },
            }),
          });
        }
      } catch (error) {
        console.error('Failed to load Dhikr state in DuaDetail:', error);
      } finally {
        hasLoadedCloudStateRef.current = true;
        isHydratingCloudStateRef.current = false;
      }
    };

    loadUserDhikrState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (!hasLoadedCloudStateRef.current || isHydratingCloudStateRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const timeout = window.setTimeout(async () => {
      try {
        await fetch(`${API_URL}/dhikr/user-state`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bookmarks: bookmarkedIds,
            lastViewedDuaId,
            settings: {
              translationLanguage,
            },
          }),
        });
      } catch (error) {
        console.error('Failed to sync Dhikr state in DuaDetail:', error);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [bookmarkedIds, lastViewedDuaId, translationLanguage, isAuthenticated, authLoading]);

  const toggleBookmark = () => {
    if (!dua) return;
    setBookmarkedIds((previous) => {
      if (previous.includes(dua.id)) return previous.filter((item) => item !== dua.id);
      return [...previous, dua.id];
    });
  };

  const shareDua = async () => {
    if (!dua) return;

    const url = `${window.location.origin}/dua/${dua.slug}`;
    const text = `${dua.title}\n\n${dua.translation}\n\n${url}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: dua.title, text, url });
        return;
      } catch (error) {
        console.error(error);
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast.success('Dua link copied.');
    }
  };

  const toggleAudio = () => {
    if (!dua) return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      return;
    }

    if (dua.audioUrl) {
      const audio = new Audio(dua.audioUrl);
      audioRef.current = audio;
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('Audio failed to play.');
      };
      audio.play().catch((error) => {
        console.error(error);
        setIsPlaying(false);
        toast.error('Unable to play audio.');
      });
      return;
    }

    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`${dua.arabic}. ${dua.translation}`);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => {
        setIsPlaying(false);
        toast.error('Text-to-speech failed.');
      };
      setIsPlaying(true);
      window.speechSynthesis.speak(utterance);
      return;
    }

    toast.error('Audio is unavailable in this browser.');
  };

  const hajjStep = useMemo(() => {
    if (!dua || dua.categoryId !== 'hajj-umrah') return null;
    const hajjDuas = DUA_LIBRARY.filter((entry) => entry.categoryId === 'hajj-umrah');
    const index = hajjDuas.findIndex((entry) => entry.id === dua.id);
    return index >= 0 ? index + 1 : null;
  }, [dua]);

  if (!dua) {
    return (
      <div className="min-h-[70vh] bg-gradient-to-b from-emerald-50 via-white to-emerald-50 px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-100 bg-white p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Dua not found</h1>
          <p className="mt-2 text-sm text-gray-600">This dua page may have moved.</p>
          <Link to="/dhikr-dua" className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Back to Dhikr & Dua
          </Link>
        </div>
      </div>
    );
  }

  const isBookmarked = bookmarkedIds.includes(dua.id);
  const { heading: arabicHeading, body: arabicBody } = splitArabicHeading(dua.arabic);
  const selectedTranslation = translationLanguage === 'urdu' ? dua.translationUrdu : dua.translation;

  return (
    <>
      <PageSEO
        title={`${dua.title} Dua`}
        description={dua.translation}
        path={`/dua/${dua.slug}`}
        keywords={[dua.title, 'dua', 'dhikr', dua.reference.source, dua.reference.book]}
        type="article"
      />

      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 px-4 py-10">
        <article className="mx-auto max-w-4xl rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-8">
          <Link to="/dhikr-dua" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <ArrowLeftIcon className="h-4 w-4" /> Back to Dhikr & Dua
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-gray-900">{dua.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-sm text-gray-600">{dua.sectionTitle}</p>
            {hajjStep && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                Step {hajjStep}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{dua.shortDescription}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleBookmark}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
            >
              {isBookmarked ? <BookmarkSolidIcon className="h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
              {isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </button>
            <button
              type="button"
              onClick={shareDua}
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700"
            >
              <ShareIcon className="h-4 w-4" /> Share
            </button>
            <button
              type="button"
              onClick={toggleAudio}
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
            >
              {isPlaying ? <StopIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              {isPlaying ? 'Stop' : 'Listen'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Translation</span>
            <button
              type="button"
              onClick={() => setTranslationLanguage('english')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                translationLanguage === 'english'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-200 text-emerald-700'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setTranslationLanguage('urdu')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                translationLanguage === 'urdu'
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-emerald-200 text-emerald-700'
              }`}
            >
              Urdu
            </button>
          </div>

          <section className="mt-6 space-y-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Arabic</p>
              <div className="rounded-xl bg-emerald-50 p-4 text-right text-emerald-950">
                {arabicHeading && <p className="mb-2 text-2xl font-indopak-nastaleeq">{arabicHeading}</p>}
                <p className="text-4xl leading-relaxed font-indopak-nastaleeq">
                  {arabicBody || dua.arabic}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">Transliteration</p>
              <p className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
                {dua.transliteration}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Translation ({translationLanguage === 'urdu' ? 'Urdu' : 'English'})
              </p>
              <p className={`rounded-xl bg-emerald-50/80 p-4 text-sm text-gray-800 ${
                translationLanguage === 'urdu' ? 'font-jameel-noori text-right text-[1.7rem] leading-[3.05rem] sm:text-[2.4rem] sm:leading-[4.1rem]' : ''
              }`}>
                {selectedTranslation}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700">Reference</p>
              <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                <p><strong>Source:</strong> {dua.reference.source}</p>
                <p><strong>Book:</strong> {dua.reference.book}</p>
                <p><strong>Hadith Number:</strong> {dua.reference.hadithNumber}</p>
                <p><strong>Grade:</strong> {dua.reference.grade}</p>
                {dua.reference.notes && <p><strong>Notes:</strong> {dua.reference.notes}</p>}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">Virtue</p>
              <p className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
                {dua.virtue}
              </p>
            </div>
          </section>
        </article>
      </div>
    </>
  );
};

export default DuaDetail;
