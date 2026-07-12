import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { toast } from 'react-hot-toast';
import {
  AcademicCapIcon,
  BookOpenIcon,
  HeartIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import PageSEO from '../components/PageSEO';
import { API_URL } from '../config';

const PROGRAMS = [
  {
    id: 'quran-tajweed',
    title: 'Free Quran & Tajweed',
    description:
      'Sponsor a child’s place in Quran class — Arabic letters, correct recitation, and daily practice with a caring teacher.',
    image: '/maktab/quran-tajweed.jpg',
  },
  {
    id: 'hifz',
    title: 'Hifz Sponsorship',
    description:
      'Help a student begin or continue memorising the Quran with structured Hifz support, revision, and encouragement.',
    image: '/maktab/hifz.jpg',
  },
  {
    id: 'deen-culture',
    title: 'Deen, Hadith & Islamic Culture',
    description:
      'Fund lessons in Aqeedah, Hadith, Seerah, and Islamic manners so children grow with knowledge and character.',
    image: '/maktab/deen-culture.jpg',
  },
  {
    id: 'classroom',
    title: 'Books, Uniform & Classroom Support',
    description:
      'Cover notebooks, Qurans, uniforms, and basic classroom needs so no child is left behind for lack of materials.',
    image: '/maktab/classroom-support.jpg',
  },
] as const;

const AMOUNT_SUGGESTIONS = [500, 1000, 2500, 5000];

const STEPS = [
  {
    title: 'Choose',
    body: 'Pick a program that speaks to you — Quran, Hifz, Deen, or classroom support.',
  },
  {
    title: 'Contribute',
    body: 'Share your details and intended gift. We will follow up with how to complete your sponsorship.',
  },
  {
    title: 'Child learns',
    body: 'Your support helps keep seats free for children who need Islamic education most.',
  },
];

const IMPACT = [
  { label: 'Children supported', value: 'Growing' },
  { label: 'Free seats goal', value: 'Every child' },
  { label: 'Programs', value: '4 focus areas' },
];

type SponsorForm = {
  name: string;
  contact: string;
  program: string;
  amount: string;
  message: string;
};

type SponsorErrors = Partial<Record<keyof SponsorForm, string>>;

/** Strict email: local@domain.tld — rejects name@gmail (missing TLD) and junk domains */
const emailLike = (value: string) => {
  const email = value.trim();
  // local@labels.tld — TLD must be 2–24 letters (requires .com / .in / etc.)
  const pattern =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}$/;
  if (!pattern.test(email)) return false;

  const [, domain = ''] = email.split('@');
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;

  const labels = domain.toLowerCase().split('.');
  if (labels.length < 2) return false;

  const tld = labels[labels.length - 1];
  // Real TLD: letters only, min 2 chars — blocks @gmail, @test, numeric TLDs
  if (!/^[a-z]{2,24}$/.test(tld)) return false;

  if (labels.some((label) => !label || label.length > 63 || label.startsWith('-') || label.endsWith('-'))) {
    return false;
  }

  // Block common placeholder / fake domains
  const fakeDomains = new Set([
    'test.com',
    'example.com',
    'example.org',
    'example.net',
    'invalid.com',
    'false.com',
    'asdf.com',
    'abc.com',
    'xxx.com',
    'domain.com',
    'email.com',
    'temp.com',
    'fake.com',
    'none.com',
    'null.com',
  ]);
  if (fakeDomains.has(domain.toLowerCase())) return false;

  return true;
};

/** Accepts +91, spaces, dashes; requires 10–15 digits */
const phoneLike = (value: string) => {
  const trimmed = value.trim();
  if (!/^[\d+\s().-]{7,22}$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  // Reject all-same digits like 0000000000
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
};

const classifyContact = (value: string): 'email' | 'phone' | 'invalid' => {
  const trimmed = value.trim();
  if (!trimmed) return 'invalid';
  if (trimmed.includes('@') || /[a-zA-Z]/.test(trimmed)) {
    return emailLike(trimmed) ? 'email' : 'invalid';
  }
  return phoneLike(trimmed) ? 'phone' : 'invalid';
};

const Maktab: React.FC = () => {
  const navigate = useNavigate();
  const sponsorRef = useRef<HTMLElement>(null);
  const [heroReady, setHeroReady] = useState(false);
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<SponsorErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof SponsorForm, boolean>>>({});
  const [form, setForm] = useState<SponsorForm>({
    name: '',
    contact: '',
    program: PROGRAMS[0].title,
    amount: '',
    message: '',
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (window.location.hash === '#sponsor') {
      const timer = setTimeout(() => {
        sponsorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-maktab-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-maktab-reveal');
            if (id) setVisible((prev) => new Set(prev).add(id));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const scrollToSponsor = (programTitle?: string) => {
    if (programTitle) {
      setForm((prev) => ({ ...prev, program: programTitle }));
    }
    sponsorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validateField = (key: keyof SponsorForm, value: string): string | undefined => {
    if (key === 'name') {
      if (!value.trim()) return 'Please enter your full name.';
      if (value.trim().length < 2) return 'Name must be at least 2 characters.';
      return undefined;
    }
    if (key === 'contact') {
      if (!value.trim()) return 'Enter a valid phone number or email address.';
      const kind = classifyContact(value);
      if (kind === 'invalid') {
        if (value.includes('@')) {
          return 'Enter a complete email with a valid domain (e.g. name@gmail.com).';
        }
        return 'Enter a valid email (name@gmail.com) or phone (10–15 digits).';
      }
      return undefined;
    }
    if (key === 'amount' && value.trim()) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1) return 'Enter a valid amount of ₹1 or more.';
    }
    return undefined;
  };

  const validateForm = (next: SponsorForm = form): SponsorErrors => {
    const nextErrors: SponsorErrors = {};
    (['name', 'contact', 'amount'] as const).forEach((key) => {
      const err = validateField(key, next[key]);
      if (err) nextErrors[key] = err;
    });
    return nextErrors;
  };

  const updateField = (key: keyof SponsorForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (touched[key] || key === 'contact' || key === 'name') {
        setErrors((prevErr) => {
          const fieldErr = validateField(key, value);
          const copy = { ...prevErr };
          if (fieldErr) copy[key] = fieldErr;
          else delete copy[key];
          return copy;
        });
      }
      return next;
    });
  };

  const markTouched = (key: keyof SponsorForm) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => {
      const fieldErr = validateField(key, form[key]);
      const copy = { ...prev };
      if (fieldErr) copy[key] = fieldErr;
      else delete copy[key];
      return copy;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, contact: true, amount: true, program: true, message: true });
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error(nextErrors.contact || nextErrors.name || 'Please fix the highlighted fields.');
      return;
    }

    const contact = form.contact.trim();
    const kind = classifyContact(contact);
    const isEmail = kind === 'email';
    const email = isEmail ? contact : 'maktab-sponsor@hikmahsphere.site';
    const phone = isEmail ? undefined : contact;
    const messageBody = form.message.trim() || 'Sponsorship enquiry submitted via Maktab page.';

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/support/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email,
          phone,
          type: 'Maktab',
          program: form.program,
          amount: form.amount.trim() || undefined,
          message: messageBody,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        toast.success('JazakAllah Khair — we received your sponsorship enquiry.');
        setForm({
          name: '',
          contact: '',
          program: PROGRAMS[0].title,
          amount: '',
          message: '',
        });
        setErrors({});
        setTouched({});
      } else {
        toast.error(result.message || 'Could not send enquiry. Opening Contact…');
        navigate(
          `/contact?name=${encodeURIComponent(form.name)}&type=Other&message=${encodeURIComponent(
            `[Maktab Sponsor Enquiry]\nPreferred program: ${form.program}\n${
              form.amount ? `Suggested amount (INR): ${form.amount}\n` : ''
            }Contact: ${contact}\n${form.message.trim() ? `Note: ${form.message.trim()}` : ''}`
          )}`
        );
      }
    } catch {
      toast.error('Something went wrong. Opening Contact so you can reach us.');
      navigate(
        `/contact?name=${encodeURIComponent(form.name)}&message=${encodeURIComponent(messageBody)}`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const revealClass = (id: string) =>
    `transition-all duration-700 ease-out ${
      visible.has(id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
    }`;

  const fieldClass = (key: keyof SponsorForm) =>
    `w-full px-4 py-3 rounded-xl border bg-white transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      errors[key] ? 'border-red-400 bg-red-50/40' : 'border-slate-200 hover:border-indigo-300'
    }`;

  const contactKind = form.contact.trim() ? classifyContact(form.contact) : null;

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
        title="Maktab — Free Islamic Education for Children"
        description="Sponsor free Quran, Tajweed, Hifz, and Deen education for children who need it most through HikmahSphere Maktab."
        path="/maktab"
        image="https://hikmahsphere.site/maktab/hero.jpg"
        keywords={[
          'maktab sponsorship',
          'free islamic education',
          'sponsor quran class',
          'hifz sponsorship',
          'hikmahsphere maktab',
        ]}
      />

      <div
        className="min-h-screen text-slate-800"
        style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
      >
        {/* Hero — centered like home header */}
        <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden text-white">
          <img
            src="/maktab/hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-105 maktab-hero-kenburns"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-emerald-950/70 to-indigo-950/75" />
          <div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 30%, rgba(16,185,129,0.45), transparent 45%), radial-gradient(circle at 80% 20%, rgba(99,102,241,0.4), transparent 40%)',
            }}
          />
          <div className="absolute top-[20%] left-[12%] w-56 h-56 rounded-full bg-emerald-400/20 blur-3xl maktab-hero-orb" />
          <div className="absolute bottom-[24%] right-[14%] w-64 h-64 rounded-full bg-indigo-400/20 blur-3xl maktab-hero-orb maktab-hero-orb-delay" />

          <div
            className={`relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 text-center ${
              heroReady ? 'maktab-hero-ready' : 'maktab-hero-pending'
            }`}
          >
            <div className="flex items-center justify-center gap-3 mb-5 maktab-hero-stage maktab-hero-stage-1">
              <img
                src="/maktab.png"
                alt="Maktab"
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-contain bg-white/95 p-1.5 shadow-lg shadow-black/30"
              />
              <p className="text-emerald-200/95 text-sm sm:text-base tracking-[0.2em] uppercase font-semibold">
                HikmahSphere Maktab
              </p>
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] mx-auto max-w-3xl mb-5 maktab-hero-stage maktab-hero-stage-2"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              Free Islamic education for children who need it most
            </h1>
            <p className="text-lg sm:text-xl text-emerald-50/90 max-w-2xl mx-auto mb-10 leading-relaxed maktab-hero-stage maktab-hero-stage-3">
              Sponsor a seat so a child can learn Quran, Hadith, Deen, and culture — without cost to their family.
            </p>
            <div className="flex flex-wrap justify-center gap-3 maktab-hero-stage maktab-hero-stage-4">
              <button
                type="button"
                onClick={() => scrollToSponsor()}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg shadow-indigo-900/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                Donate / Sponsor
              </button>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/35 bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5"
              >
                Contact
              </Link>
            </div>
          </div>
        </section>

        {/* Mission */}
        <section
          data-maktab-reveal="mission"
          className={`relative py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-emerald-50 via-teal-50/80 to-slate-50 ${revealClass('mission')}`}
        >
          <div
            className="absolute inset-0 opacity-[0.35] pointer-events-none"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23059669\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          />
          <div className="relative max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-emerald-700 mb-4">
              <HeartIcon className="w-5 h-5" />
              <span className="text-sm font-semibold tracking-wide uppercase">Our mission</span>
            </div>
            <h2
              className="text-3xl sm:text-4xl text-slate-900 mb-5"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              Knowledge that should never depend on wealth
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              HikmahSphere Maktab exists for children from families who cannot afford fees. We aim to offer free
              Quran, Tajweed, Hadith, Deen, Islamic culture, and Hifz pathways — so every child who wants to learn
              can sit in class with dignity.
            </p>
          </div>
        </section>

        {/* Program cards */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div
              data-maktab-reveal="programs-head"
              className={`text-center mb-12 ${revealClass('programs-head')}`}
            >
              <h2
                className="text-3xl sm:text-4xl text-slate-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Programs you can sponsor
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Choose where your gift goes. Each option is a real classroom need — not a decorative card.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
              {PROGRAMS.map((program, index) => (
                <article
                  key={program.id}
                  data-maktab-reveal={`program-${program.id}`}
                  className={`group overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow ${revealClass(
                    `program-${program.id}`
                  )}`}
                  style={{ transitionDelay: visible.has(`program-${program.id}`) ? `${index * 80}ms` : '0ms' }}
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={program.image}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-6">
                    <h3
                      className="text-xl text-slate-900 mb-2"
                      style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                    >
                      {program.title}
                    </h3>
                    <p className="text-slate-600 mb-5 leading-relaxed">{program.description}</p>
                    <button
                      type="button"
                      onClick={() => scrollToSponsor(program.title)}
                      className="inline-flex items-center gap-2 text-indigo-700 font-semibold hover:text-indigo-900 transition-colors"
                    >
                      Sponsor this program
                      <span aria-hidden>→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section
          data-maktab-reveal="how"
          className={`py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-emerald-950 text-white ${revealClass('how')}`}
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2
                className="text-3xl sm:text-4xl mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                How sponsorship helps
              </h2>
              <p className="text-indigo-100/85 max-w-xl mx-auto">
                A simple path from your intention to a child learning in class.
              </p>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="relative text-center md:text-left">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/30 border border-indigo-300/40 text-indigo-100 font-bold mb-4">
                    {i + 1}
                  </div>
                  <h3
                    className="text-xl mb-2"
                    style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-indigo-100/80 leading-relaxed">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Impact placeholders */}
        <section
          data-maktab-reveal="impact"
          className={`py-16 px-4 sm:px-6 lg:px-8 bg-white ${revealClass('impact')}`}
        >
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700 mb-3">
              A growing program
            </p>
            <h2
              className="text-2xl sm:text-3xl text-slate-900 mb-10"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              Building capacity, one sponsored seat at a time
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {IMPACT.map((item) => (
                <div key={item.label}>
                  <p
                    className="text-2xl sm:text-3xl text-indigo-700 mb-1"
                    style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
                  >
                    {item.value}
                  </p>
                  <p className="text-slate-600 text-sm">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-slate-500 max-w-lg mx-auto">
              Figures stay modest on purpose — this is an early, growing effort. Exact enrollment will be shared as
              the program matures.
            </p>
          </div>
        </section>

        {/* Sponsor panel */}
        <section
          id="sponsor"
          ref={sponsorRef}
          data-maktab-reveal="sponsor"
          className={`scroll-mt-24 py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-100 via-indigo-50/40 to-emerald-50/50 ${revealClass('sponsor')}`}
        >
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 text-indigo-700 mb-3">
                <SparklesIcon className="w-5 h-5" />
                <span className="text-sm font-semibold tracking-wide uppercase">Donate / Sponsor</span>
              </div>
              <h2
                className="text-3xl sm:text-4xl text-slate-900 mb-3"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
              >
                Start a sponsorship enquiry
              </h2>
              <p className="text-slate-600">
                Tell us how you’d like to help. We’ll reply with next steps — no payment is taken on this page yet.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              noValidate
              className="rounded-2xl bg-white border border-indigo-100/80 shadow-lg shadow-indigo-900/5 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-teal-600 px-6 sm:px-8 py-5 text-white">
                <p className="text-sm text-indigo-100 font-medium mb-1">Sponsorship enquiry</p>
                <p className="text-lg font-semibold">We’ll follow up with payment details — nothing is charged here.</p>
              </div>

              <div className="p-6 sm:p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="maktab-name" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="maktab-name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      onBlur={() => markTouched('name')}
                      className={fieldClass('name')}
                      placeholder="e.g. Azmi Rahman"
                      aria-invalid={Boolean(errors.name)}
                    />
                    {errors.name && <p className="mt-1.5 text-xs text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label htmlFor="maktab-contact" className="block text-sm font-semibold text-slate-800 mb-1.5">
                      Phone or email <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="maktab-contact"
                      type="text"
                      autoComplete="email"
                      inputMode="email"
                      value={form.contact}
                      onChange={(e) => updateField('contact', e.target.value)}
                      onBlur={() => markTouched('contact')}
                      className={fieldClass('contact')}
                      placeholder="name@email.com or +91 98765 43210"
                      aria-invalid={Boolean(errors.contact)}
                    />
                    {errors.contact ? (
                      <p className="mt-1.5 text-xs text-red-600">{errors.contact}</p>
                    ) : contactKind === 'email' ? (
                      <p className="mt-1.5 text-xs text-emerald-700">Valid email detected</p>
                    ) : contactKind === 'phone' ? (
                      <p className="mt-1.5 text-xs text-emerald-700">Valid phone number detected</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-slate-500">
                        Email must include a full domain after @ (e.g. gmail.com), or use a 10–15 digit phone
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="maktab-program" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Preferred program
                  </label>
                  <select
                    id="maktab-program"
                    value={form.program}
                    onChange={(e) => updateField('program', e.target.value)}
                    className={`${fieldClass('program')} bg-white`}
                  >
                    {PROGRAMS.map((p) => (
                      <option key={p.id} value={p.title}>
                        {p.title}
                      </option>
                    ))}
                    <option value="General Maktab support">General Maktab support</option>
                  </select>
                </div>

                <div>
                  <p className="block text-sm font-semibold text-slate-800 mb-2">Suggested amount (INR, optional)</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {AMOUNT_SUGGESTIONS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          updateField('amount', String(amt));
                          setTouched((prev) => ({ ...prev, amount: true }));
                        }}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          form.amount === String(amt)
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 hover:bg-white'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                    <input
                      type="number"
                      min={1}
                      value={form.amount}
                      onChange={(e) => updateField('amount', e.target.value)}
                      onBlur={() => markTouched('amount')}
                      className={`${fieldClass('amount')} pl-8`}
                      placeholder="Or enter another amount"
                      aria-invalid={Boolean(errors.amount)}
                    />
                  </div>
                  {errors.amount && <p className="mt-1.5 text-xs text-red-600">{errors.amount}</p>}
                </div>

                <div>
                  <label htmlFor="maktab-message" className="block text-sm font-semibold text-slate-800 mb-1.5">
                    Message <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="maktab-message"
                    rows={3}
                    value={form.message}
                    onChange={(e) => updateField('message', e.target.value)}
                    className={`${fieldClass('message')} resize-y`}
                    placeholder="Frequency, dedication, or any questions…"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm text-slate-600">
                  Your <strong className="text-slate-800">name</strong> and contact details are included in our
                  sponsorship email so we can reply to you personally.
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold shadow-md shadow-indigo-900/15 transition-colors maktab-cta-pulse"
                  >
                    {submitting ? 'Sending…' : 'Send sponsorship enquiry'}
                  </button>
                  <Link
                    to="/contact"
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Contact instead
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* Trust */}
        <section
          data-maktab-reveal="trust"
          className={`py-16 px-4 sm:px-6 lg:px-8 bg-white ${revealClass('trust')}`}
        >
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheckIcon className="w-7 h-7" />
            </div>
            <div>
              <h2
                className="text-xl text-slate-900 mb-2"
                style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 600 }}
              >
                Tracked with care
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Maktab funds are managed inside HikmahSphere’s fund tools — the same platform used for transparent
                Zakat and Sadaqah records — so contributions can be followed with accountability as the program grows.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          data-maktab-reveal="final"
          className={`py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-emerald-800 via-teal-800 to-indigo-900 text-white ${revealClass('final')}`}
        >
          <div className="max-w-3xl mx-auto text-center">
            <AcademicCapIcon className="w-10 h-10 mx-auto mb-4 text-emerald-200" />
            <h2
              className="text-3xl sm:text-4xl mb-4"
              style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 700 }}
            >
              Give a child a place to learn
            </h2>
            <p className="text-emerald-50/90 mb-8 text-lg">
              Your sponsorship keeps Islamic education free for families who need it most.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => scrollToSponsor()}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-white text-indigo-900 font-semibold hover:bg-emerald-50 transition-colors"
              >
                Donate / Sponsor
              </button>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-white/40 hover:bg-white/10 font-semibold transition-colors"
              >
                Contact
              </Link>
            </div>
            <p className="mt-10 text-sm text-emerald-100/70 inline-flex items-center gap-2 justify-center">
              <BookOpenIcon className="w-4 h-4" />
              HikmahSphere Maktab — placeholder copy & imagery, ready to replace with your final content.
            </p>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes maktab-cta-soft {
          0%, 100% { box-shadow: 0 4px 14px rgba(79, 70, 229, 0.25); }
          50% { box-shadow: 0 6px 22px rgba(79, 70, 229, 0.45); }
        }
        @keyframes maktabHeroOrb {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
          50% { transform: translate(10px, -14px) scale(1.08); opacity: 0.85; }
        }
        @keyframes maktabKenBurns {
          0% { transform: scale(1.05); }
          100% { transform: scale(1.12); }
        }
        .maktab-cta-pulse {
          animation: maktab-cta-soft 2.4s ease-in-out infinite;
        }
        .maktab-hero-orb {
          animation: maktabHeroOrb 9s ease-in-out infinite;
        }
        .maktab-hero-orb-delay {
          animation-delay: 1.2s;
        }
        .maktab-hero-kenburns {
          animation: maktabKenBurns 18s ease-out forwards;
        }
        .maktab-hero-pending .maktab-hero-stage {
          opacity: 0;
          transform: translateY(18px);
        }
        .maktab-hero-ready .maktab-hero-stage {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        .maktab-hero-ready .maktab-hero-stage-1 { transition-delay: 0.05s; }
        .maktab-hero-ready .maktab-hero-stage-2 { transition-delay: 0.18s; }
        .maktab-hero-ready .maktab-hero-stage-3 { transition-delay: 0.32s; }
        .maktab-hero-ready .maktab-hero-stage-4 { transition-delay: 0.46s; }
        @media (prefers-reduced-motion: reduce) {
          .maktab-cta-pulse,
          .maktab-hero-orb,
          .maktab-hero-kenburns { animation: none; }
          .maktab-hero-pending .maktab-hero-stage,
          .maktab-hero-ready .maktab-hero-stage {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Maktab;
