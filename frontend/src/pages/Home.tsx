import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  BookOpenIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  HeartIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import PageSEO from '../components/PageSEO';
import {
  getHomeFeatures,
  HOME_FAQ,
  HOME_JSON_LD,
  HOME_PILLARS,
  HOME_SEO,
  HOME_STORY,
  HOME_TESTIMONIALS,
  HOME_TRUST,
  MAKTAB_HIGHLIGHTS,
  MAKTAB_SLIDES,
  type HomeFeature,
} from '../data/homeContent';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [heroReady, setHeroReady] = useState(false);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [maktabSlide, setMaktabSlide] = useState(0);
  const [maktabPaused, setMaktabPaused] = useState(false);
  const [ctaInView, setCtaInView] = useState(false);

  const isAdmin = user && (user.role === 'superadmin' || user.isAdmin);
  const isManager = user && user.role === 'manager';
  const hasManagementAccess = Boolean(isAdmin || isManager);
  const features = getHomeFeatures(hasManagementAccess);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeroReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-home-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.getAttribute('data-home-reveal');
          if (id) setVisible((prev) => new Set(prev).add(id));
          if (id === 'cta') setCtaInView(true);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (maktabPaused) return undefined;
    const timer = window.setInterval(() => {
      setMaktabSlide((prev) => (prev + 1) % MAKTAB_SLIDES.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [maktabPaused]);

  const goToMaktabSlide = (index: number) => {
    setMaktabSlide((index + MAKTAB_SLIDES.length) % MAKTAB_SLIDES.length);
  };

  const handleHeroPrimary = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(user ? '/about' : '/auth');
  };

  const handleStartJourney = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(user ? '/profile' : '/auth');
  };

  const handleManagementAction = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasManagementAccess || user) {
      navigate('/zakat');
    } else {
      navigate('/auth');
    }
  };

  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFeatureCardClick = (feature: HomeFeature) => {
    if (feature.disabled) {
      if (feature.title === 'AI Assistant') {
        toast.error('AI Assistant is not yet implemented.');
      }
      return;
    }
    if (feature.path) navigate(feature.path);
  };

  const reveal = (id: string, extra = '') =>
    `transition-all duration-700 ease-out ${
      visible.has(id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
    } ${extra}`;

  return (
    <>
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Outfit:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Helmet>

      <PageSEO
        title={HOME_SEO.title}
        description={HOME_SEO.description}
        path="/"
        keywords={[...HOME_SEO.keywords]}
        siteLinks={[...HOME_SEO.siteLinks]}
      />

      <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD.person)}</script>
      <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD.organization)}</script>
      <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD.software)}</script>
      <script type="application/ld+json">{JSON.stringify(HOME_JSON_LD.faq)}</script>

      <main
        className="home-page overflow-x-hidden"
        style={
          {
            fontFamily: "'Outfit', system-ui, sans-serif",
            '--hs-emerald': '#059669',
            '--hs-teal': '#0f766e',
            '--hs-ink': '#0f172a',
            '--hs-indigo': '#4f46e5',
          } as React.CSSProperties
        }
      >
        {/* Hero — brand first, centered under navbar */}
        <section
          className="relative min-h-[100svh] flex items-center overflow-hidden text-white"
          aria-labelledby="home-hero-heading"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950" />
          <div
            className="absolute inset-0 opacity-50 home-hero-mesh"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 70% 50% at 15% 20%, rgba(16,185,129,0.45), transparent), radial-gradient(ellipse 60% 45% at 85% 70%, rgba(45,212,191,0.28), transparent), radial-gradient(circle at 50% 100%, rgba(15,23,42,0.9), transparent 55%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none home-hero-pattern"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'72\' height=\'72\' viewBox=\'0 0 72 72\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.35\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
          <div className="absolute top-[18%] left-[8%] w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl home-hero-orb" />
          <div className="absolute bottom-[22%] right-[10%] w-72 h-72 rounded-full bg-teal-300/15 blur-3xl home-hero-orb home-hero-orb-delay" />
          <div className="absolute top-[42%] right-[28%] w-40 h-40 rounded-full bg-cyan-400/10 blur-2xl home-hero-orb home-hero-orb-slow" />

          <div
            className={`relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 ${
              heroReady ? 'home-hero-ready' : 'home-hero-pending'
            }`}
          >
            <div className="flex items-center gap-4 mb-8 home-hero-stage home-hero-stage-1">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 shrink-0">
                <div className="absolute inset-0 rounded-full bg-emerald-400/40 blur-md home-logo-glow" />
                <div className="relative w-full h-full rounded-full overflow-hidden bg-white shadow-lg shadow-emerald-950/40 ring-2 ring-emerald-400/40">
                  <img src="/logo.png" alt="HikmahSphere logo" className="h-full w-full object-cover" />
                </div>
              </div>
              <p className="text-emerald-200/95 text-base sm:text-lg lg:text-xl tracking-[0.2em] uppercase font-semibold">
                HikmahSphere
              </p>
            </div>

            <h1
              id="home-hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.08] max-w-3xl mb-5 home-hero-stage home-hero-stage-2"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              One sincere home for worship, learning, and the Ummah
            </h1>
            <p className="text-lg sm:text-xl text-emerald-50/90 max-w-2xl mb-10 leading-relaxed home-hero-stage home-hero-stage-3">
              Prayer, Quran, Dhikr, Zakat, community, and Hajj guidance—together in a free, privacy-first islamic
              platform built for everyday faith.
            </p>

            <div className="flex flex-wrap gap-3 home-hero-stage home-hero-stage-4">
              <button
                type="button"
                onClick={handleHeroPrimary}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-lg shadow-emerald-950/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-900/40"
              >
                {user ? 'Our Mission' : 'Start Your Journey'}
              </button>
              <button
                type="button"
                onClick={scrollToFeatures}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/30 bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
              >
                Explore Features
              </button>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <svg viewBox="0 0 1440 100" className="w-full h-auto" aria-hidden>
              <path
                d="M0 40L60 45C120 50 240 60 360 62C480 64 600 56 720 48C840 40 960 32 1080 34C1200 36 1320 48 1380 54L1440 60V100H0V40Z"
                fill="#020617"
              />
            </svg>
          </div>
        </section>

        {/* Maktab campaign — primary sponsorship story */}
        <section
          className="relative overflow-hidden bg-slate-950 text-white"
          aria-labelledby="home-maktab-heading"
          data-home-reveal="maktab"
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(79,70,229,0.4), transparent), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(16,185,129,0.3), transparent)',
            }}
          />
          <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 ${reveal('maktab')}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              <div className="lg:col-span-5 order-2 lg:order-1">
                <div
                  className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[4/5] overflow-hidden rounded-3xl shadow-2xl shadow-indigo-950/50 ring-1 ring-white/10"
                  onMouseEnter={() => setMaktabPaused(true)}
                  onMouseLeave={() => setMaktabPaused(false)}
                  onFocus={() => setMaktabPaused(true)}
                  onBlur={() => setMaktabPaused(false)}
                  role="region"
                  aria-roledescription="carousel"
                  aria-label="Maktab campaign images"
                >
                  {MAKTAB_SLIDES.map((slide, index) => {
                    const active = index === maktabSlide;
                    const prev =
                      index === (maktabSlide - 1 + MAKTAB_SLIDES.length) % MAKTAB_SLIDES.length;
                    return (
                      <div
                        key={slide.src}
                        className={`absolute inset-0 transition-all duration-1000 ease-out ${
                          active
                            ? 'opacity-100 translate-x-0 scale-100 z-10'
                            : prev
                              ? 'opacity-0 -translate-x-8 scale-105 z-0'
                              : 'opacity-0 translate-x-10 scale-100 z-0'
                        }`}
                        aria-hidden={!active}
                      >
                        <img
                          src={slide.src}
                          alt={slide.alt}
                          className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[6500ms] ease-out ${
                            active ? 'scale-110' : 'scale-100'
                          }`}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-indigo-950/25" />
                      </div>
                    );
                  })}

                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 z-20">
                    <p
                      key={`eyebrow-${maktabSlide}`}
                      className="text-emerald-200 text-xs font-semibold tracking-[0.18em] uppercase mb-1 home-fade-up"
                    >
                      {MAKTAB_SLIDES[maktabSlide].eyebrow}
                    </p>
                    <p
                      key={`caption-${maktabSlide}`}
                      className="text-white text-lg sm:text-xl font-semibold leading-snug home-fade-up"
                    >
                      {MAKTAB_SLIDES[maktabSlide].caption}
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      {MAKTAB_SLIDES.map((slide, index) => (
                        <button
                          key={slide.src}
                          type="button"
                          aria-label={`Show slide ${index + 1}: ${slide.caption}`}
                          aria-current={index === maktabSlide}
                          onClick={() => goToMaktabSlide(index)}
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            index === maktabSlide ? 'w-8 bg-emerald-400' : 'w-2.5 bg-white/35 hover:bg-white/60'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => goToMaktabSlide(maktabSlide - 1)}
                      className="w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-sm border border-white/15 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => goToMaktabSlide(maktabSlide + 1)}
                      className="w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 text-white backdrop-blur-sm border border-white/15 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src="/maktab.png"
                    alt="Maktab"
                    className="w-12 h-12 rounded-xl object-contain bg-white/95 p-1 shadow-md"
                  />
                  <p className="text-indigo-300 text-sm font-semibold tracking-[0.16em] uppercase">
                    HikmahSphere Maktab
                  </p>
                </div>
                <h2
                  id="home-maktab-heading"
                  className="text-3xl sm:text-4xl lg:text-[2.75rem] text-white leading-tight mb-4"
                  style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
                >
                  Free Islamic education for children who need it most
                </h2>
                <p className="text-lg text-slate-300 max-w-xl leading-relaxed mb-8">
                  Admit your child for Quran, Hifz, Urdu, and Deen — or sponsor a seat so another child can learn
                  without cost to their family. Taught by Hafiz teachers, with backup power and free books when needed.
                </p>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9 max-w-xl">
                  {MAKTAB_HIGHLIGHTS.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-slate-200 text-sm sm:text-base">
                      <CheckCircleIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/maktab#admit"
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-lg shadow-emerald-900/40 transition-colors"
                  >
                    Admit your child
                  </Link>
                  <Link
                    to="/maktab#sponsor"
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg shadow-indigo-900/40 transition-colors"
                  >
                    Donate / Sponsor
                  </Link>
                  <Link
                    to="/maktab"
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 text-white font-semibold backdrop-blur-sm transition-colors"
                  >
                    Learn about Maktab
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars + trust once */}
        <section
          className="relative py-20 sm:py-24 bg-gradient-to-b from-white via-emerald-50/40 to-white"
          aria-labelledby="home-pillars-heading"
          data-home-reveal="pillars"
        >
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${reveal('pillars')}`}>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2
                id="home-pillars-heading"
                className="text-3xl sm:text-4xl text-slate-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Why Choose HikmahSphere?
              </h2>
              <p className="text-lg text-slate-600">
                Built with love for the global Muslim community—clear purpose in every pillar.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 lg:gap-6 mb-12">
              {HOME_PILLARS.map((pillar, index) => (
                <div
                  key={pillar.label}
                  data-home-reveal={`pillar-${index}`}
                  className={`text-center p-6 rounded-2xl bg-white/80 border border-emerald-100/80 shadow-sm hover:shadow-md transition-all duration-500 ${
                    visible.has(`pillar-${index}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{
                    transitionDelay: visible.has(`pillar-${index}`) ? `${index * 80}ms` : '0ms',
                  }}
                >
                  <div
                    className={`w-12 h-12 ${pillar.bgColor} rounded-xl flex items-center justify-center mx-auto mb-4`}
                  >
                    <pillar.icon className={`w-6 h-6 ${pillar.color}`} />
                  </div>
                  <h3
                    className="text-base font-bold text-slate-900 mb-2"
                    style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                  >
                    {pillar.label}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{pillar.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              {HOME_TRUST.map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-medium"
                >
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features — canonical catalog */}
        <section
          id="features-section"
          className="relative py-20 sm:py-24 bg-slate-50"
          aria-labelledby="home-features-heading"
          data-home-reveal="features"
        >
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at top, rgba(16,185,129,0.12), transparent 55%), radial-gradient(ellipse at bottom right, rgba(14,116,144,0.1), transparent 45%)',
            }}
          />
          <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${reveal('features')}`}>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2
                id="home-features-heading"
                className="text-3xl sm:text-4xl lg:text-5xl text-slate-900 mb-4"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Tools for every act of worship
              </h2>
              <p className="text-lg text-slate-600">
                Open any feature below—this is the full HikmahSphere catalog in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {features.map((feature, index) => (
                <button
                  key={feature.title}
                  type="button"
                  data-home-reveal={`feature-${index}`}
                  onClick={() => handleFeatureCardClick(feature)}
                  className={`group relative text-left w-full rounded-2xl p-7 bg-white border border-slate-200/80 overflow-hidden transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-200 ${
                    feature.disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    visible.has(`feature-${index}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{
                    transitionDelay: visible.has(`feature-${index}`) ? `${(index % 3) * 70}ms` : '0ms',
                  }}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.06] transition-opacity duration-500`}
                  />
                  <div className="relative">
                    <div
                      className={`w-14 h-14 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-5 overflow-hidden group-hover:scale-110 transition-transform duration-300`}
                    >
                      <img src={feature.icon} alt="" className="w-12 h-12 object-contain" />
                    </div>
                    {feature.disabled && (
                      <span className="absolute top-0 right-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-500 text-white">
                        Coming Soon
                      </span>
                    )}
                    <h3
                      className="text-xl text-slate-900 mb-2 group-hover:text-emerald-700 transition-colors"
                      style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                    >
                      {feature.title}
                    </h3>
                    <p className={`text-sm leading-relaxed ${feature.disabled ? 'text-slate-500' : 'text-slate-600'}`}>
                      {feature.description}
                    </p>
                    {!feature.disabled && (
                      <span className="mt-5 inline-flex items-center gap-2 text-emerald-700 font-semibold text-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        Open
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Site story — different from Features catalog */}
        <section
          className="relative py-20 sm:py-24 overflow-hidden"
          aria-labelledby="home-story-heading"
          data-home-reveal="editorial"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950 to-teal-900" />
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 20% 20%, rgba(16,185,129,0.35), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(45,212,191,0.2), transparent 45%)',
            }}
          />
          <div className={`relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${reveal('editorial')}`}>
            <div className="max-w-3xl mb-12">
              <p className="text-emerald-300/90 text-sm font-semibold tracking-[0.16em] uppercase mb-3">
                Why HikmahSphere exists
              </p>
              <h2
                id="home-story-heading"
                className="text-3xl sm:text-4xl lg:text-5xl text-white mb-5 leading-tight"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                {HOME_STORY.heading}
              </h2>
              <p className="text-lg text-emerald-50/90 leading-relaxed">{HOME_STORY.lead}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-12">
              {HOME_STORY.chapters.map((chapter, index) => (
                <article
                  key={chapter.id}
                  data-home-reveal={`story-${index}`}
                  className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 sm:p-7 transition-all duration-700 ${
                    visible.has(`story-${index}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{
                    transitionDelay: visible.has(`story-${index}`) ? `${index * 90}ms` : '0ms',
                  }}
                >
                  <span className="text-emerald-400/80 text-xs font-bold tracking-widest uppercase">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3
                    className="text-xl text-white mt-2 mb-3"
                    style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                  >
                    {chapter.title}
                  </h3>
                  <p className="text-emerald-50/80 leading-relaxed text-sm sm:text-base">{chapter.body}</p>
                </article>
              ))}
            </div>

            <div
              data-home-reveal="story-moments"
              className={`rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-6 sm:p-8 mb-10 transition-all duration-700 ${
                visible.has('story-moments') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <h3
                className="text-lg sm:text-xl text-white mb-6"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
              >
                Moments the platform is meant to serve
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {HOME_STORY.moments.map((moment) => (
                  <div key={moment.label} className="flex gap-3 items-start">
                    <HeartIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-emerald-50/90 text-sm sm:text-base leading-relaxed">
                      <span className="font-semibold text-white">{moment.label}.</span> {moment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-emerald-100/85 max-w-3xl leading-relaxed text-base sm:text-lg">
              {HOME_STORY.closing}{' '}
              <Link to="/about" className="text-white font-semibold underline underline-offset-4 hover:text-emerald-200">
                Read our mission
              </Link>
              {' · '}
              <button
                type="button"
                onClick={scrollToFeatures}
                className="text-white font-semibold underline underline-offset-4 hover:text-emerald-200"
              >
                Browse tools above
              </button>
            </p>
          </div>
        </section>

        {/* Lower Maktab advertise band */}
        <section className="relative overflow-hidden" aria-labelledby="home-maktab-band-heading" data-home-reveal="maktab-band">
          <div className="absolute inset-0">
            <img src="/maktab/hero.jpg" alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-indigo-950/75 to-emerald-950/55" />
          </div>
          <div className={`relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 ${reveal('maktab-band')}`}>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/maktab.png"
                alt="Maktab"
                className="w-12 h-12 rounded-xl object-contain bg-white/95 p-1 shadow-md"
              />
              <p className="text-emerald-200/90 text-sm font-semibold tracking-[0.16em] uppercase">
                HikmahSphere Maktab
              </p>
            </div>
            <h2
              id="home-maktab-band-heading"
              className="text-3xl sm:text-4xl lg:text-5xl text-white max-w-2xl mb-4 leading-tight"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              Admit your child — or sponsor a seat
            </h2>
            <p className="text-lg text-emerald-50/90 max-w-xl mb-8 leading-relaxed">
              Free Quran, Hifz, Urdu, and Deen education at HikmahSphere Maktab. Enrol your child, or help another
              family keep learning without fees.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/maktab#admit"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-lg transition-colors"
              >
                Admit your child
              </Link>
              <Link
                to="/maktab#sponsor"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg transition-colors"
              >
                Donate / Sponsor
              </Link>
              <Link
                to="/maktab"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/35 bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-sm transition-colors"
              >
                Explore Maktab
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section
          className="relative py-20 sm:py-24 bg-gradient-to-b from-teal-50/80 via-white to-emerald-50/50"
          aria-labelledby="home-voices-heading"
          data-home-reveal="voices"
        >
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${reveal('voices')}`}>
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-5 shadow-sm border border-emerald-100">
                <HeartIcon className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Community love</span>
              </div>
              <h2
                id="home-voices-heading"
                className="text-3xl sm:text-4xl lg:text-5xl text-slate-900 mb-4"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Loved by Muslims worldwide
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Real voices from people who use HikmahSphere in their daily spiritual journey.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {HOME_TESTIMONIALS.map((testimonial, index) => (
                <article
                  key={testimonial.name}
                  data-home-reveal={`voice-${index}`}
                  className={`rounded-2xl p-7 sm:p-8 transition-all duration-700 hover:-translate-y-1 ${
                    testimonial.special
                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 shadow-lg md:col-span-2 lg:col-span-3 max-w-3xl mx-auto w-full'
                      : 'bg-white border border-emerald-100/80 shadow-md hover:shadow-xl'
                  } ${
                    visible.has(`voice-${index}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                >
                  {testimonial.special && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full mb-4">
                      <HeartIcon className="w-3 h-3" />
                      Mother&apos;s Message
                    </div>
                  )}
                  <div className="flex items-center mb-3">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-amber-400 fill-current" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  {!testimonial.special && (
                    <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full mb-4">
                      {testimonial.feature}
                    </span>
                  )}
                  <p className="text-slate-700 leading-relaxed mb-6">{testimonial.text}</p>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        testimonial.special
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                          : 'bg-gradient-to-br from-emerald-400 to-teal-400'
                      }`}
                    >
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{testimonial.name}</p>
                      <p className="text-sm text-slate-500 inline-flex items-center gap-1">
                        <GlobeAltIcon className="w-3.5 h-3.5" />
                        {testimonial.location}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — long-tail SEO content + FAQPage rich results */}
        <section
          className="relative py-20 sm:py-24 bg-white"
          aria-labelledby="home-faq-heading"
          data-home-reveal="faq"
        >
          <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${reveal('faq')}`}>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-emerald-700 text-sm font-semibold tracking-[0.16em] uppercase mb-3">
                Questions & answers
              </p>
              <h2
                id="home-faq-heading"
                className="text-3xl sm:text-4xl text-slate-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Frequently asked questions
              </h2>
              <p className="text-lg text-slate-600">
                Everything you need to know about using HikmahSphere for prayer, Quran, Dhikr, Zakat, and more.
              </p>
            </div>

            <div className="space-y-4">
              {HOME_FAQ.map((item, index) => (
                <details
                  key={item.question}
                  data-home-reveal={`faq-${index}`}
                  className={`group rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm transition-all duration-500 open:border-emerald-200 open:shadow-md ${
                    visible.has(`faq-${index}`) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                  }`}
                  style={{
                    transitionDelay: visible.has(`faq-${index}`) ? `${(index % 4) * 60}ms` : '0ms',
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <h3
                      className="text-base sm:text-lg font-semibold text-slate-900"
                      style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                    >
                      {item.question}
                    </h3>
                    <span className="shrink-0 rounded-full bg-emerald-50 p-2 text-emerald-700 transition-transform duration-300 group-open:rotate-45">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-4 text-slate-600 leading-relaxed text-sm sm:text-base">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA + light Maktab reminder */}
        <section
          className="relative py-20 sm:py-24 overflow-hidden text-white"
          aria-labelledby="home-cta-heading"
          data-home-reveal="cta"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800" />
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '28px 28px',
            }}
          />
          <div className={`relative max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 ${reveal('cta')}`}>
            <h2
              id="home-cta-heading"
              className="text-3xl sm:text-4xl lg:text-5xl mb-5"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              {hasManagementAccess ? 'Manage giving with clarity' : 'Begin with sincerity today'}
            </h2>
            <p className="text-lg text-emerald-50/90 mb-8 leading-relaxed">
              {hasManagementAccess
                ? 'Open Zakat & fund tools to track collections, spending, and transparent records for your community.'
                : 'Create your space on HikmahSphere—or continue exploring prayer, Quran, Dhikr, and more.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <button
                type="button"
                onClick={hasManagementAccess ? handleManagementAction : handleStartJourney}
                className={`inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-white text-emerald-900 font-semibold shadow-lg transition-colors hover:bg-emerald-50 ${
                  ctaInView ? 'home-cta-pulse' : ''
                }`}
              >
                {hasManagementAccess ? 'Open Zakat Management' : user ? 'Open Profile' : 'Get Started Free'}
              </button>
              <Link
                to="/community"
                className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl border border-white/40 hover:bg-white/10 font-semibold transition-colors"
              >
                Join Community
              </Link>
            </div>
            <p className="text-sm sm:text-base text-emerald-100/90">
              Looking for free Islamic education for your child — or want to sponsor a seat?{' '}
              <Link to="/maktab" className="font-semibold text-white underline underline-offset-4 hover:text-emerald-100">
                Visit HikmahSphere Maktab
              </Link>
            </p>
          </div>
        </section>

        {/* Verse close */}
        <section
          className="relative py-16 sm:py-20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white"
          aria-labelledby="home-verse-heading"
          data-home-reveal="verse"
        >
          <div className={`max-w-3xl mx-auto text-center px-4 sm:px-6 lg:px-8 ${reveal('verse')}`}>
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl shadow-lg mb-8">
              <BookOpenIcon className="w-7 h-7 text-white" />
            </div>
            <h2 id="home-verse-heading" className="sr-only">
              Closing verse from the Quran
            </h2>
            <blockquote className="text-3xl sm:text-4xl font-light mb-6 leading-relaxed font-scheherazade text-emerald-100">
              &ldquo;وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا&rdquo;
            </blockquote>
            <p className="text-lg text-slate-300 mb-5 max-w-2xl mx-auto leading-relaxed">
              &ldquo;And hold firmly to the rope of Allah all together and do not become divided&rdquo;
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-px bg-gradient-to-r from-transparent to-emerald-500" />
              <cite className="text-base font-semibold text-emerald-400 not-italic">Quran 3:103</cite>
              <div className="w-12 h-px bg-gradient-to-l from-transparent to-emerald-500" />
            </div>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes homeFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes homeCtaPulse {
          0%, 100% { box-shadow: 0 10px 28px rgba(6, 78, 59, 0.25); }
          50% { box-shadow: 0 14px 36px rgba(6, 78, 59, 0.4); }
        }
        @keyframes homeHeroOrb {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.55; }
          50% { transform: translate(12px, -18px) scale(1.08); opacity: 0.85; }
        }
        @keyframes homeLogoGlow {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.12); }
        }
        @keyframes homeMeshDrift {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.06) translate(-1.5%, 1%); }
          100% { transform: scale(1) translate(0, 0); }
        }
        @keyframes homePatternShift {
          0% { background-position: 0 0; }
          100% { background-position: 72px 72px; }
        }
        .home-fade-up {
          animation: homeFadeUp 0.55s ease-out;
        }
        .home-cta-pulse {
          animation: homeCtaPulse 2.4s ease-in-out infinite;
        }
        .home-hero-orb {
          animation: homeHeroOrb 9s ease-in-out infinite;
        }
        .home-hero-orb-delay {
          animation-delay: 1.4s;
        }
        .home-hero-orb-slow {
          animation-duration: 14s;
          animation-delay: 0.6s;
        }
        .home-logo-glow {
          animation: homeLogoGlow 3.2s ease-in-out infinite;
        }
        .home-hero-mesh {
          animation: homeMeshDrift 18s ease-in-out infinite;
        }
        .home-hero-pattern {
          animation: homePatternShift 28s linear infinite;
        }
        .home-hero-pending .home-hero-stage {
          opacity: 0;
          transform: translateY(18px);
        }
        .home-hero-ready .home-hero-stage {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        .home-hero-ready .home-hero-stage-1 { transition-delay: 0.05s; }
        .home-hero-ready .home-hero-stage-2 { transition-delay: 0.18s; }
        .home-hero-ready .home-hero-stage-3 { transition-delay: 0.32s; }
        .home-hero-ready .home-hero-stage-4 { transition-delay: 0.46s; }
        @media (prefers-reduced-motion: reduce) {
          .home-page * {
            animation: none !important;
            transition-duration: 0.01ms !important;
          }
          .home-hero-pending .home-hero-stage,
          .home-hero-ready .home-hero-stage {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Home;
