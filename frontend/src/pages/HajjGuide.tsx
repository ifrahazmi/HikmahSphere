import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import brandLogo from '../data/logo.png';
import spiritualHajjImage from '../data/spiritual-Hajj.png';
import hajjInfographicImage from '../data/Hajj-Guide-Steps.jpg';
import './HajjGuide.css';

const INTRODUCTION_TEXT =
  'Hajj is the sacred pilgrimage that Muslims make to Makkah to worship Allah in a special way. It is very important because it is the fifth pillar of Islam and teaches obedience, patience, unity, and remembrance of Allah. Every Muslim who is physically and financially able must perform Hajj once in a lifetime. Hajj takes place in Makkah during the Islamic month of Dhul Hijjah. During these blessed days, millions of Muslims travel from around the world and stand side by side in worship. It is a journey of the heart as well as the body, where pilgrims seek forgiveness, mercy, and a fresh start with Allah.';

const HAJJ_STEPS = [
  {
    title: 'Intend for Hajj and enter the state of Ihram before Miqat',
    description:
      'Before reaching the Miqat, the pilgrim makes a sincere intention for Hajj and enters Ihram. Men wear two simple white cloths, women dress modestly, and everyone avoids certain actions so the heart stays focused on worship.',
  },
  {
    title: 'Tawaf al-Qudoom',
    description:
      'Pilgrims arrive in Makkah and perform Tawaf al-Qudoom by walking around the Kaaba seven times. This is the welcoming Tawaf and begins the journey with remembrance of Allah.',
  },
  {
    title: "Sa'i between Safa and Marwa",
    description:
      "Pilgrims walk between the hills of Safa and Marwa seven times. This remembers the trust of Hajar, who searched for water while relying on Allah's help.",
  },
  {
    title: 'Go to Mina',
    description:
      'Pilgrims travel to Mina and spend the night there in prayer, remembrance, and rest. This prepares them for the most important days of Hajj.',
  },
  {
    title: 'Spend time in Arafat',
    description:
      'Pilgrims stand in Arafat, making dua and asking Allah for mercy and forgiveness. This is the most important part of Hajj and the heart of the pilgrimage.',
  },
  {
    title: 'Spend night in Muzdalifah and collect pebbles',
    description:
      'After sunset, pilgrims go to Muzdalifah, pray, rest, and collect small pebbles. These pebbles will be used for the stoning ritual in Mina.',
  },
  {
    title: 'Stone Jamarah al-Aqabah',
    description:
      'Pilgrims throw seven pebbles at Jamarah al-Aqabah. This act shows rejection of Shaytan and commitment to obey Allah.',
  },
  {
    title: 'Sacrifice animal (Qurbani)',
    description:
      'A sacrifice is offered to remember the obedience of Prophet Ibrahim, peace be upon him. It is also a way of sharing food and care with others.',
  },
  {
    title: 'Shave or trim hair',
    description:
      'Men usually shave the head or trim the hair, while women trim a small part of their hair. This marks humility and a new stage in the pilgrimage.',
  },
  {
    title: 'Tawaf al-Ifadah',
    description:
      'Pilgrims return to Makkah and perform Tawaf al-Ifadah around the Kaaba. This is an essential Tawaf of Hajj and is done with devotion and gratitude.',
  },
  {
    title: 'Stone all three Jamarat',
    description:
      'On the following days, pilgrims throw pebbles at Jamarat al-Ula, Jamarat al-Wusta, and Jamarat al-Aqabah. This continues the reminder to stay firm against evil and remain obedient to Allah.',
  },
  {
    title: 'Farewell Tawaf',
    description:
      'Before leaving Makkah, pilgrims perform the Farewell Tawaf as their last act at the Kaaba. It is a peaceful goodbye to the sacred journey of Hajj.',
  },
];

interface GuidePage {
  fileName: string;
  pageNumber: number;
  url: string;
}

const GUIDE_MANIFEST_ENDPOINT = '/api/hajj-guide/pages';
const DEFAULT_GUIDE_PAGE = 1;
const DEFAULT_GUIDE_ZOOM = 100;
const DEFAULT_INFOGRAPHIC_ZOOM = 1;
const MAX_INFOGRAPHIC_ZOOM = 4;
const MIN_INFOGRAPHIC_ZOOM = 1;
const MIN_GUIDE_ZOOM = 70;
const MAX_GUIDE_ZOOM = 180;

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getPointerDistance = (
  firstPointer: { x: number; y: number },
  secondPointer: { x: number; y: number }
) => Math.hypot(secondPointer.x - firstPointer.x, secondPointer.y - firstPointer.y);

const HajjGuide: React.FC = () => {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guidePages, setGuidePages] = useState<GuidePage[]>([]);
  const [guidePage, setGuidePage] = useState(DEFAULT_GUIDE_PAGE);
  const [guideZoom, setGuideZoom] = useState(DEFAULT_GUIDE_ZOOM);
  const [isGuideLoading, setIsGuideLoading] = useState(false);
  const [guideLoadError, setGuideLoadError] = useState<string | null>(null);
  const [loadedGuidePages, setLoadedGuidePages] = useState<Record<number, boolean>>({});
  const [isInfographicOpen, setIsInfographicOpen] = useState(false);
  const [infographicZoom, setInfographicZoom] = useState(DEFAULT_INFOGRAPHIC_ZOOM);
  const [infographicOffset, setInfographicOffset] = useState({ x: 0, y: 0 });
  const infographicViewportRef = useRef<HTMLDivElement | null>(null);
  const infographicZoomRef = useRef(DEFAULT_INFOGRAPHIC_ZOOM);
  const infographicOffsetRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(DEFAULT_INFOGRAPHIC_ZOOM);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const guideManifestRequestRef = useRef<Promise<GuidePage[]> | null>(null);
  const preloadedGuideUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

    updateViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateViewport);
      return () => mediaQuery.removeEventListener('change', updateViewport);
    }

    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isGuideOpen && !isInfographicOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInfographicOpen(false);
        setIsGuideOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isGuideOpen, isInfographicOpen]);

  const markGuidePageLoaded = (pageNumber: number) => {
    setLoadedGuidePages((currentPages) => {
      if (currentPages[pageNumber]) {
        return currentPages;
      }

      return {
        ...currentPages,
        [pageNumber]: true,
      };
    });
  };

  const loadGuidePages = async (): Promise<GuidePage[]> => {
    if (guidePages.length > 0) {
      return guidePages;
    }

    if (guideManifestRequestRef.current) {
      return guideManifestRequestRef.current;
    }

    setIsGuideLoading(true);
    setGuideLoadError(null);

    guideManifestRequestRef.current = fetch(GUIDE_MANIFEST_ENDPOINT, {
      credentials: 'same-origin',
      cache: 'force-cache',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Guide request failed with status ${response.status}`);
        }

        const payload = await response.json();
        const pages = Array.isArray(payload?.data?.pages) ? payload.data.pages : [];

        if (pages.length === 0) {
          throw new Error('No guide pages were returned by the server.');
        }

        const normalizedPages = pages.map((page: GuidePage) => ({
          fileName: String(page.fileName),
          pageNumber: Number(page.pageNumber),
          url: String(page.url),
        }));

        setGuidePages(normalizedPages);
        setGuidePage((currentPage) => Math.min(Math.max(currentPage, 1), normalizedPages.length));

        return normalizedPages;
      })
      .catch((error: Error) => {
        setGuideLoadError(error.message || 'Unable to load the Hajj guide pages.');
        throw error;
      })
      .finally(() => {
        setIsGuideLoading(false);
        guideManifestRequestRef.current = null;
      });

    return guideManifestRequestRef.current;
  };

  const preloadGuidePages = (pagesToPreload: GuidePage[]) => {
    pagesToPreload.forEach((page) => {
      if (preloadedGuideUrlsRef.current.has(page.url)) {
        return;
      }

      preloadedGuideUrlsRef.current.add(page.url);

      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = () => markGuidePageLoaded(page.pageNumber);
      image.onerror = () => {
        preloadedGuideUrlsRef.current.delete(page.url);
      };
      image.src = page.url;
    });
  };

  const constrainInfographicOffset = (nextOffset: { x: number; y: number }, nextZoom: number) => {
    if (nextZoom <= 1 || !infographicViewportRef.current) {
      return { x: 0, y: 0 };
    }

    const viewportRect = infographicViewportRef.current.getBoundingClientRect();
    const maxOffsetX = Math.max(((nextZoom - 1) * viewportRect.width) / 2, 0);
    const maxOffsetY = Math.max(((nextZoom - 1) * viewportRect.height) / 2, 0);

    return {
      x: clampValue(nextOffset.x, -maxOffsetX, maxOffsetX),
      y: clampValue(nextOffset.y, -maxOffsetY, maxOffsetY),
    };
  };

  const applyInfographicView = (nextZoom: number, nextOffset = infographicOffsetRef.current) => {
    const clampedZoom = clampValue(nextZoom, MIN_INFOGRAPHIC_ZOOM, MAX_INFOGRAPHIC_ZOOM);
    const clampedOffset = constrainInfographicOffset(nextOffset, clampedZoom);

    infographicZoomRef.current = clampedZoom;
    infographicOffsetRef.current = clampedOffset;
    setInfographicZoom(clampedZoom);
    setInfographicOffset(clampedOffset);
  };

  const resetInfographicView = () => {
    activePointersRef.current.clear();
    pinchStartDistanceRef.current = null;
    dragStartRef.current = null;
    applyInfographicView(DEFAULT_INFOGRAPHIC_ZOOM, { x: 0, y: 0 });
  };

  const openGuide = () => {
    setGuidePage(DEFAULT_GUIDE_PAGE);
    setGuideZoom(DEFAULT_GUIDE_ZOOM);
    setGuideLoadError(null);
    setIsGuideOpen(true);
    void loadGuidePages()
      .then((pages) => {
        preloadGuidePages(pages);
      })
      .catch(() => undefined);
  };
  const closeGuide = () => setIsGuideOpen(false);
  const openInfographic = () => {
    resetInfographicView();
    setIsInfographicOpen(true);
  };
  const closeInfographic = () => {
    setIsInfographicOpen(false);
    resetInfographicView();
  };

  const increaseGuideZoom = () => {
    setGuideZoom((currentZoom) => Math.min(currentZoom + 10, MAX_GUIDE_ZOOM));
  };

  const decreaseGuideZoom = () => {
    setGuideZoom((currentZoom) => Math.max(currentZoom - 10, MIN_GUIDE_ZOOM));
  };

  const goToPreviousGuidePage = () => {
    setGuidePage((currentPage) => Math.max(currentPage - 1, 1));
  };

  const goToNextGuidePage = () => {
    setGuidePage((currentPage) => Math.min(currentPage + 1, guidePages.length || 1));
  };

  const handleGuidePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPage = Number(event.target.value);

    if (Number.isNaN(nextPage) || nextPage < 1) {
      setGuidePage(1);
      return;
    }

    setGuidePage(Math.min(nextPage, guidePages.length || 1));
  };
  const activeGuidePage = guidePages[guidePage - 1] || null;
  const totalGuidePages = guidePages.length;
  const isActiveGuidePageLoaded = activeGuidePage ? Boolean(loadedGuidePages[activeGuidePage.pageNumber]) : false;

  const handleInfographicZoomIn = () => {
    applyInfographicView(infographicZoomRef.current + 0.25);
  };

  const handleInfographicZoomOut = () => {
    applyInfographicView(infographicZoomRef.current - 0.25);
  };

  const handleInfographicWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoomDelta = event.deltaY < 0 ? 0.2 : -0.2;
    applyInfographicView(infographicZoomRef.current + zoomDelta);
  };

  const handleInfographicPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 1 && infographicZoomRef.current > 1) {
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        offsetX: infographicOffsetRef.current.x,
        offsetY: infographicOffsetRef.current.y,
      };
    }

    if (activePointersRef.current.size === 2) {
      const [firstPointer, secondPointer] = Array.from(activePointersRef.current.values());
      pinchStartDistanceRef.current = getPointerDistance(firstPointer, secondPointer);
      pinchStartZoomRef.current = infographicZoomRef.current;
      dragStartRef.current = null;
    }
  };

  const handleInfographicPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) {
      return;
    }

    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 2) {
      event.preventDefault();
      const [firstPointer, secondPointer] = Array.from(activePointersRef.current.values());
      const currentDistance = getPointerDistance(firstPointer, secondPointer);

      if (!pinchStartDistanceRef.current) {
        pinchStartDistanceRef.current = currentDistance;
        pinchStartZoomRef.current = infographicZoomRef.current;
        return;
      }

      const nextZoom = pinchStartZoomRef.current * (currentDistance / pinchStartDistanceRef.current);
      applyInfographicView(nextZoom);
      return;
    }

    if (activePointersRef.current.size === 1 && dragStartRef.current && infographicZoomRef.current > 1) {
      event.preventDefault();
      applyInfographicView(infographicZoomRef.current, {
        x: dragStartRef.current.offsetX + event.clientX - dragStartRef.current.x,
        y: dragStartRef.current.offsetY + event.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleInfographicPointerRelease = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activePointersRef.current.delete(event.pointerId);

    if (activePointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (activePointersRef.current.size === 1 && infographicZoomRef.current > 1) {
      const [remainingPointer] = Array.from(activePointersRef.current.values());
      dragStartRef.current = {
        x: remainingPointer.x,
        y: remainingPointer.y,
        offsetX: infographicOffsetRef.current.x,
        offsetY: infographicOffsetRef.current.y,
      };
      return;
    }

    dragStartRef.current = null;
  };

  return (
    <>
      <PageSEO
        title="Hajj Guide"
        description="A beginner-friendly Hajj guide with a simple introduction, step-by-step ritual summary, and an interactive complete page-by-page guide."
        path="/hajj-guide"
        keywords={[
          'Hajj guide',
          'Hajj steps',
          'beginner Hajj guide',
          'Hikmah Sphere Hajj',
          'Islamic pilgrimage guide',
        ]}
        image="/logo.png"
      />

      <div className="hajj-guide-page min-h-screen px-4 pb-14 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-10">
          <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <div className="hajj-guide-hero-pattern grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-12">
              <div className="flex flex-col justify-center">
                <div className="mb-6 flex items-center gap-4">
                  <div className="hajj-guide-logo-glow flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-sm">
                    <img src={brandLogo} alt="Hikmah Sphere logo" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-950 sm:text-3xl">Hikmah Sphere</p>
                    <p className="mt-1 text-sm uppercase tracking-[0.22em] text-amber-700">
                      Authentic Islamic Knowledge
                    </p>
                  </div>
                </div>

                <div className="mb-4 inline-flex w-fit rounded-full border border-amber-200 bg-white/80 px-4 py-1 text-sm font-semibold text-amber-800">
                  The Fifth Pillar of Islam
                </div>

                <h1 className="max-w-3xl text-4xl font-bold leading-tight text-emerald-950 sm:text-5xl">
                  1. Introduction to Hajj
                </h1>
                <div className="mt-6 lg:hidden">
                  <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-3 shadow-2xl">
                    <img
                      src={spiritualHajjImage}
                      alt="Pilgrims gathering during Hajj"
                      className="max-h-[420px] w-full rounded-[1.5rem] object-cover"
                    />
                  </div>
                </div>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
                  {INTRODUCTION_TEXT}
                </p>

                <div className="mt-6 flex flex-wrap gap-3 text-sm font-medium text-emerald-900">
                  <span className="rounded-full bg-white/90 px-4 py-2 shadow-sm">Makkah</span>
                  <span className="rounded-full bg-white/90 px-4 py-2 shadow-sm">Dhul Hijjah</span>
                  <span className="rounded-full bg-white/90 px-4 py-2 shadow-sm">Once in a lifetime for those able</span>
                </div>
              </div>

              <div className="relative hidden items-center justify-center lg:flex">
                <div className="absolute inset-8 rounded-full bg-emerald-700/10 blur-3xl" aria-hidden="true" />
                <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-3 shadow-2xl">
                  <img
                    src={spiritualHajjImage}
                    alt="Pilgrims gathering during Hajj"
                    className="max-h-[520px] w-full rounded-[1.5rem] object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)] sm:p-6 lg:p-8">
            <div className="hajj-guide-infographic-frame rounded-[2rem] border border-emerald-100 p-5 sm:p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                Hajj Guide Infographic
              </p>
              <h2 className="mt-3 text-3xl font-bold text-emerald-950">
                2. Step-by-Step explanation of the infographic
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-700">
                This simple image gives a quick view of the main Hajj journey from Ihram to the Farewell Tawaf.
              </p>

              <button
                type="button"
                onClick={openInfographic}
                className="mt-6 block w-full overflow-hidden rounded-[1.75rem] border border-amber-100 bg-white p-3 text-left shadow-inner transition hover:border-amber-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 sm:p-4"
              >
                <div className="relative">
                  <img
                    src={hajjInfographicImage}
                    alt="Hajj Guide Infographic showing the main Hajj steps"
                    className="max-h-[980px] w-full rounded-[1.35rem] object-contain"
                  />
                  <div className="pointer-events-none absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-md">
                    <ArrowsPointingOutIcon className="h-4 w-4" />
                    Tap or click to enlarge
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {HAJJ_STEPS.map((step, index) => (
                <article
                  key={step.title}
                  className="hajj-guide-step-card h-full rounded-[1.4rem] border border-emerald-100 bg-white p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-900 text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold leading-6 text-emerald-950">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{step.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:px-8 lg:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex items-center gap-3">
                  <img
                    src={brandLogo}
                    alt="Hikmah Sphere logo mark"
                    className="h-12 w-12 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-2 opacity-90"
                  />
                  <span className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-700">
                    Complete Hajj Guide
                  </span>
                </div>

                <h2 className="text-3xl font-bold text-emerald-950">
                  3. Complete Step-by-Step Hajj Guide
                </h2>
                <p className="mt-3 text-base leading-7 text-slate-700">
                  For a detailed explanation of every ritual, preparation tips, and the full Hajj journey, refer to our complete Hajj guide.
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Open the guide to move page by page through all 17 image pages. The page images start loading in the background when the viewer opens.
                </p>
              </div>

              <div className="flex items-start">
                <button
                  type="button"
                  onClick={openGuide}
                  className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition duration-200 hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  View Complete Hajj Guide
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-emerald-100 bg-emerald-950 px-6 py-8 text-center text-white shadow-[0_20px_60px_rgba(4,120,87,0.28)] sm:px-8">
            <p className="text-lg font-semibold text-amber-300">Learn more Islamic guidance at Hikmah Sphere</p>
            <p className="mt-4 text-xl font-bold">Hajj Guide prepared by Hikmah Sphere</p>
            <p className="mt-2 text-sm text-emerald-100">Trusted Islamic knowledge without ads.</p>
          </section>
        </div>

        {isGuideOpen && (
          <div
            className="hajj-guide-overlay fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6"
            onClick={closeGuide}
            role="presentation"
          >
            <div
              className="hajj-guide-modal hajj-guide-guide-shell flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hajj-guide-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-4 border-b border-emerald-100 bg-white/95 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Interactive Page Guide</p>
                    <h3 id="hajj-guide-modal-title" className="text-2xl font-bold text-emerald-950">
                      Complete Step-by-Step Hajj Guide
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-auto">
                    <button
                      type="button"
                      onClick={closeGuide}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      aria-label="Close complete Hajj guide"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={goToPreviousGuidePage}
                      disabled={guidePage === 1}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Prev
                    </button>
                    {isMobileViewport ? (
                      <div className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900">
                        Page {guidePage}{totalGuidePages > 0 ? ` / ${totalGuidePages}` : ''}
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900">
                        Page
                        <input
                          type="number"
                          min={1}
                          max={totalGuidePages || 1}
                          value={guidePage}
                          onChange={handleGuidePageInputChange}
                          className="w-20 rounded-full border border-emerald-200 px-3 py-1 text-sm font-medium text-slate-700 focus:border-emerald-400 focus:outline-none"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={goToNextGuidePage}
                      disabled={totalGuidePages === 0 || guidePage >= totalGuidePages}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {!isMobileViewport && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={decreaseGuideZoom}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
                      >
                        <MagnifyingGlassMinusIcon className="h-4 w-4" />
                        Zoom out
                      </button>
                      <div className="rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white">
                        {guideZoom}%
                      </div>
                      <button
                        type="button"
                        onClick={increaseGuideZoom}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50"
                      >
                        <MagnifyingGlassPlusIcon className="h-4 w-4" />
                        Zoom in
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
                <div className="h-full overflow-auto rounded-[1.5rem] border border-slate-200 bg-white p-3 sm:p-4">
                  {guideLoadError ? (
                    <div className="flex h-full min-h-[360px] items-center justify-center text-center">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">Unable to load the Hajj guide</p>
                        <p className="mt-2 max-w-md text-sm text-slate-600">{guideLoadError}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setGuideLoadError(null);
                            void loadGuidePages()
                              .then((pages) => {
                                preloadGuidePages(pages);
                              })
                              .catch(() => undefined);
                          }}
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-white"
                        >
                          Retry loading pages
                        </button>
                      </div>
                    </div>
                  ) : isGuideLoading || !activeGuidePage ? (
                    <div className="flex h-full min-h-[360px] items-center justify-center text-sm font-medium text-slate-600">
                      Preparing guide pages...
                    </div>
                  ) : (
                    <div className="hajj-guide-page-viewer relative flex min-h-full items-start justify-center">
                      {!isActiveGuidePageLoaded && (
                        <div className="absolute inset-0 z-[1] flex items-center justify-center rounded-[1.25rem] bg-white/88 text-sm font-medium text-slate-600">
                          Loading page {guidePage}...
                        </div>
                      )}
                      <img
                        key={`${activeGuidePage.fileName}-${guideZoom}-${isMobileViewport ? 'mobile' : 'desktop'}`}
                        src={activeGuidePage.url}
                        alt={`Complete Hajj guide page ${guidePage}`}
                        className="hajj-guide-page-image block h-auto rounded-[1.25rem] border border-slate-200 bg-white"
                        style={{ width: isMobileViewport ? '100%' : `${guideZoom}%` }}
                        onLoad={() => markGuidePageLoaded(activeGuidePage.pageNumber)}
                        onError={() => setGuideLoadError(`Unable to load page ${activeGuidePage.pageNumber}. Please try again.`)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isInfographicOpen && (
          <div
            className="hajj-guide-overlay fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:p-6"
            onClick={closeInfographic}
            role="presentation"
          >
            <div
              className="hajj-guide-modal flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hajj-guide-image-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-col gap-4 border-b border-white/10 bg-slate-900/95 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Expanded Infographic</p>
                    <h3 id="hajj-guide-image-modal-title" className="text-2xl font-bold text-white">
                      Hajj Guide Infographic
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">
                      Use two fingers to zoom on touch devices, or use the buttons and mouse wheel on desktop.
                    </p>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={handleInfographicZoomOut}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/30 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-white/10 sm:px-4 sm:text-sm"
                    >
                      <MagnifyingGlassMinusIcon className="h-4 w-4" />
                      Zoom out
                    </button>
                    <div className="flex items-center justify-center rounded-full bg-emerald-800 px-3 py-2 text-xs font-semibold text-white sm:px-4 sm:text-sm">
                      {Math.round(infographicZoom * 100)}%
                    </div>
                    <button
                      type="button"
                      onClick={handleInfographicZoomIn}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-200/30 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-white/10 sm:px-4 sm:text-sm"
                    >
                      <MagnifyingGlassPlusIcon className="h-4 w-4" />
                      Zoom in
                    </button>
                    <button
                      type="button"
                      onClick={resetInfographicView}
                      className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:px-4 sm:text-sm"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={closeInfographic}
                      className="col-span-2 inline-flex h-11 w-full items-center justify-center rounded-full border border-white/15 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:col-span-1 sm:h-11 sm:w-11"
                      aria-label="Close infographic viewer"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 bg-slate-950 p-3 sm:p-4">
                <div
                  ref={infographicViewportRef}
                  className="hajj-guide-image-stage flex h-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]"
                  onWheel={handleInfographicWheel}
                  onPointerDown={handleInfographicPointerDown}
                  onPointerMove={handleInfographicPointerMove}
                  onPointerUp={handleInfographicPointerRelease}
                  onPointerCancel={handleInfographicPointerRelease}
                >
                  <img
                    src={hajjInfographicImage}
                    alt="Expanded Hajj Guide Infographic"
                    className="h-auto max-h-full w-full max-w-full select-none object-contain"
                    draggable={false}
                    style={{
                      transform: `translate(${infographicOffset.x}px, ${infographicOffset.y}px) scale(${infographicZoom})`,
                      transformOrigin: 'center center',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default HajjGuide;
