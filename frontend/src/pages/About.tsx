// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  ArrowDownIcon,
  SparklesIcon,
  BookOpenIcon,
  HeartIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import {
  missionStatement,
  pillars,
  spiritualFeatures,
  promises,
  journeyOptions,
  storyContent,
  footerQuote,
  developers,
} from '../data/aboutContent';
import { getRandomVerse } from '../data/quranVerses';
import type { QuranVerse } from '../data/quranVerses';
import type { SpiritualFeature } from '../data/aboutContent';

const About: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dailyVerse, setDailyVerse] = useState<QuranVerse | null>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  // Check if user is admin or manager
  const isAdmin = user && (user.role === 'superadmin' || user.isAdmin);
  const isManager = user && user.role === 'manager';
  const hasManagementAccess = isAdmin || isManager;

  const safeSpiritualFeatures = Array.isArray(spiritualFeatures) ? spiritualFeatures : [];
  const storyParagraphs = Array.isArray(storyContent?.originStory) ? storyContent.originStory : [];
  const safePromises = Array.isArray(promises) ? promises : [];
  const safeDevelopers = Array.isArray(developers) ? developers : [];
  const safeJourneyOptions = Array.isArray(journeyOptions) ? journeyOptions : [];

  // Refs for sections
  const heroRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const promisesRef = useRef<HTMLDivElement>(null);
  const developersRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLDivElement>(null);

  const isComponentIcon = (icon: unknown): icon is React.ElementType =>
    typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon);

  // Create features list with conditional Zakat description based on user role
  const featuresWithConditionalZakat: SpiritualFeature[] = safeSpiritualFeatures.map((feature) => {
    if (feature.id === 'zakat' || feature.title.includes('Zakat')) {
      return {
        ...feature,
        title: hasManagementAccess ? 'Zakat Management' : 'Zakat Calculator',
        description: hasManagementAccess
          ? 'Comprehensive dashboard to manage Zakat collection, distribution, and donor history.'
          : 'Intelligent Zakat calculation supporting all methodologies and cryptocurrencies'
      };
    }
    return feature;
  });

  useEffect(() => {
    setDailyVerse(getRandomVerse());
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-100px',
      threshold: 0.1,
    };

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section');
          if (sectionId) {
            setVisibleSections((prev) => new Set(prev).add(sectionId));
          }
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    const sections = [
      heroRef.current,
      storyRef.current,
      missionRef.current,
      timelineRef.current,
      featuresRef.current,
      promisesRef.current,
      developersRef.current,
      journeyRef.current,
    ];

    sections.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  const handleNavigate = (path: string) => {
    if (!path) return;
    if (path.startsWith('http')) {
      window.open(path, '_blank');
    } else {
      navigate(path);
    }
  };

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section 
        ref={heroRef}
        data-section="hero"
        className="relative min-h-screen flex items-center justify-center overflow-hidden -mt-16 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950"
      >
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px'
          }}></div>
        </div>
        
        {/* Floating Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

        {/* Content */}
        <div className={`relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-1000 ${visibleSections.has('hero') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Daily Wisdom - Quran Verse */}
          {dailyVerse && (
            <div className="mb-10 inline-block">
              <div className="px-6 py-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-xl">
                {/* Arabic Verse */}
                <p className="text-2xl sm:text-3xl text-white font-scheherazade leading-loose mb-3" dir="rtl">
                  {dailyVerse.verse}
                </p>
                
                {/* Translation */}
                <p className="text-sm sm:text-base text-emerald-100 italic mb-2">
                  {dailyVerse.translation}
                </p>
                
                {/* Reference */}
                <p className="text-xs text-emerald-200 font-medium">
                  {dailyVerse.chapter} • {dailyVerse.reference}
                </p>
              </div>
            </div>
          )}

          {/* Main Title */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            <span className="block text-white">Guiding the</span>
            <span className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
              Ummah Digitally
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-emerald-100 max-w-3xl mx-auto leading-relaxed mt-8 font-light">
            Where timeless Islamic wisdom meets intelligent technology
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
            <button
              onClick={() => scrollToSection('story-section')}
              className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-300 shadow-2xl cursor-pointer flex items-center gap-2"
            >
              Discover Our Story
              <ArrowDownIcon className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
            </button>
            <button
              onClick={scrollToFeatures}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transform hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              Explore Features
            </button>
          </div>

          {/* Scroll Indicator */}
          <div className="mt-20 animate-bounce">
            <ArrowDownIcon className="w-6 h-6 text-emerald-300 mx-auto" />
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section 
        ref={storyRef}
        data-section="story"
        id="story-section"
        className="py-24 bg-white relative overflow-hidden"
      >
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-100 rounded-full blur-3xl opacity-50"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-16 transition-all duration-1000 delay-300 ${visibleSections.has('story') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full mb-6">
              <SparklesIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Our Journey</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              {storyContent.headline}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className={`space-y-8 transition-all duration-1000 delay-500 ${visibleSections.has('story') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border-l-4 border-emerald-500 shadow-lg">
                <p className="text-xl text-gray-800 leading-relaxed italic font-medium">
                  {storyContent.problemStatement}
                </p>
              </div>

              {storyParagraphs.map((paragraph, index) => (
                <p key={index} className="text-lg text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Right Content - Name Explanation Cards */}
            <div className={`space-y-6 transition-all duration-1000 delay-700 ${visibleSections.has('story') ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <div className="group relative bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <h3 className="text-3xl font-bold text-white mb-4 font-scheherazade">
                    {storyContent.nameExplanation.hikma.title}
                  </h3>
                  <p className="text-emerald-50 leading-relaxed text-lg">
                    {storyContent.nameExplanation.hikma.meaning}
                  </p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-teal-500 to-emerald-500 rounded-2xl p-8 shadow-xl hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                <div className="relative">
                  <h3 className="text-3xl font-bold text-white mb-4">
                    {storyContent.nameExplanation.sphere.title}
                  </h3>
                  <p className="text-teal-50 leading-relaxed text-lg">
                    {storyContent.nameExplanation.sphere.meaning}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section 
        ref={missionRef}
        data-section="mission"
        className="py-24 bg-gradient-to-br from-emerald-50 via-white to-teal-50 relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-1000 ${visibleSections.has('mission') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md mb-6">
              <HeartIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Our Mission</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              The Guiding Light
            </h2>
            <p className="text-2xl text-emerald-700 max-w-4xl mx-auto font-medium italic leading-relaxed">
              {missionStatement.text}
            </p>
          </div>

          {/* Mission Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map((pillar, index) => (
              <div
                key={index}
                className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden ${visibleSections.has('mission') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    {pillar.icon.includes('/') ? (
                      <img src={pillar.icon} alt={pillar.title} className="w-14 h-14 object-contain" />
                    ) : (
                      <span className="text-4xl">{pillar.icon}</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-emerald-600 transition-colors duration-300">
                    {pillar.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section
        id="features-section"
        ref={featuresRef}
        data-section="features"
        className="py-24 bg-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-1000 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full mb-6">
              <BookOpenIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Spiritual Tools</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Features for Your Journey
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive tools designed to enhance your daily Islamic practice
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuresWithConditionalZakat.map((feature, index) => (
              <div
                key={index}
                className={`group relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 overflow-hidden ${
                  feature.disabled ? 'opacity-50 grayscale' : ''
                } ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-teal-500/0 group-hover:from-emerald-500/5 group-hover:to-teal-500/5 transition-all duration-500"></div>
                <div className="relative">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 ${
                    feature.bgColor || 'bg-gradient-to-br from-emerald-100 to-teal-100'
                  }`}>
                    {feature.icon.includes('/') ? (
                      <img src={feature.icon} alt={feature.title} className="w-12 h-12 object-contain" />
                    ) : (
                      <span className="text-3xl">{feature.icon}</span>
                    )}
                  </div>
                  <h3 className={`text-xl font-bold mb-3 transition-colors duration-300 ${
                    feature.disabled ? 'text-gray-500' : 'text-gray-900 group-hover:text-emerald-600'
                  }`}>
                    {feature.title}
                  </h3>
                  <p className={`leading-relaxed ${feature.disabled ? 'text-gray-500' : 'text-gray-600'}`}>
                    {feature.description}
                  </p>
                  {feature.disabled && (
                    <div className="mt-4 inline-block px-3 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                      Coming Soon
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety Section */}
      <section 
        ref={promisesRef}
        data-section="promises"
        className="py-24 bg-gradient-to-br from-gray-50 to-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-1000 ${visibleSections.has('promises') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md mb-6">
              <ShieldCheckIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Our Commitment</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Trust & Safety
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Your trust is sacred. Here's what we promise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {safePromises.map((promise, index) => {
              const colorClass = promise.color || 'text-emerald-600';
              const bgClass = colorClass.replace('text-', 'bg-') + '-50';
              const icon = promise.icon;

              return (
                <div
                  key={index}
                  className={`group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${visibleSections.has('promises') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className={`w-16 h-16 ${bgClass} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    {isComponentIcon(icon) ? (
                      React.createElement(icon, { className: `w-8 h-8 ${colorClass}` })
                    ) : (
                      <span className="text-3xl">{icon || '✅'}</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    {promise.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {promise.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Developer Team Section */}
      <section 
        ref={developersRef}
        data-section="developers"
        className="py-24 bg-gradient-to-br from-white via-emerald-50 to-teal-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`text-center mb-16 transition-all duration-1000 ${visibleSections.has('developers') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md mb-6">
              <HeartIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Our Team</span>
            </div>
            <h2 className="text-5xl font-bold text-gray-900 mb-6">
              Meet the Team
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Dedicated professionals united by the mission to bring authentic Islamic knowledge to the digital world
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:max-w-4xl mx-auto">
            {safeDevelopers.map((dev, index) => (
              <div
                key={index}
                className={`group bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden transform hover:-translate-y-2 ${visibleSections.has('developers') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${index * 200}ms` }}
              >
                {/* Image Section */}
                <div className="relative h-[450px] overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500">
                  {dev.image ? (
                    <img
                      src={dev.image}
                      alt={dev.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                      {(dev.name || 'HS').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                  {dev.id === 'hiring' && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-pulse">
                      We're Hiring
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {dev.name}
                  </h3>
                  <p className="text-emerald-600 font-semibold mb-4 text-sm">
                    {dev.role}
                  </p>

                  <p className="text-gray-700 leading-relaxed mb-6">
                    {dev.bio}
                  </p>

                  {/* Expertise Tags */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Expertise
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(Array.isArray(dev.expertise) ? dev.expertise : []).map((skill, skillIndex) => (
                        <span
                          key={skillIndex}
                          className="inline-block bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold hover:scale-105 transition-transform duration-200 cursor-default"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Social Links */}
                  {dev.social && (
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                      {dev.social.github && (
                        <a
                          href={dev.social.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-emerald-500 hover:text-white transition-all duration-300"
                          title="GitHub"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.6.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                          </svg>
                        </a>
                      )}
                      {dev.social.linkedin && (
                        <a
                          href={dev.social.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-emerald-500 hover:text-white transition-all duration-300"
                          title="LinkedIn"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.475-2.236-1.986-2.236-1.081 0-1.722.722-2.006 1.419-.103.249-.129.597-.129.946v5.44h-3.554s.05-8.836 0-9.753h3.554v1.381c.43-.664 1.202-1.609 2.923-1.609 2.136 0 3.74 1.393 3.74 4.385v5.596zM5.337 8.855c-1.144 0-1.915-.762-1.915-1.715 0-.955.77-1.715 1.959-1.715 1.188 0 1.915.76 1.932 1.715 0 .953-.744 1.715-1.976 1.715zm1.946 11.597H3.392V9.142h3.891v11.31zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
                          </svg>
                        </a>
                      )}
                      {dev.social.twitter && (
                        <a
                          href={dev.social.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 hover:bg-emerald-500 hover:text-white transition-all duration-300"
                          title="Twitter"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Journey Section */}
      <section 
        ref={journeyRef}
        data-section="journey"
        className="py-24 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white relative overflow-hidden"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className={`text-center mb-16 transition-all duration-1000 ${visibleSections.has('journey') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6">
              <SparklesIcon className="w-4 h-4 text-emerald-300" />
              <span className="text-sm font-medium">Get Involved</span>
            </div>
            <h2 className="text-5xl font-bold mb-6">
              Join the Journey
            </h2>
            <p className="text-xl text-emerald-100 max-w-3xl mx-auto">
              Whether you're a user, scholar, or developer—there's a place for you in HikmahSphere
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {safeJourneyOptions.map((option, index) => {
              const icon = option.icon;
              const actionPath = option.buttonAction || option.path || '/';
              const title = option.title || 'Journey Option';
              const description = option.description || '';
              const buttonLabel = option.buttonText || 'Get Started';

              return (
                <div
                  key={index}
                  className={`group bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:border-white/40 hover:bg-white/15 transition-all duration-500 transform hover:-translate-y-2 ${visibleSections.has('journey') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    {isComponentIcon(icon) ? (
                      React.createElement(icon, { className: 'w-8 h-8 text-white' })
                    ) : typeof icon === 'string' && (icon.includes('.png') || icon.includes('.jpg') || icon.includes('.svg')) ? (
                      <img src={icon} alt={title} className="w-12 h-12 object-contain filter brightness-0 invert" />
                    ) : typeof icon === 'string' ? (
                      <span className="text-4xl leading-none">{icon}</span>
                    ) : (
                      <span className="text-4xl leading-none">🌟</span>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">
                    {title}
                  </h3>
                  <p className="text-emerald-100 mb-6 leading-relaxed">
                    {description}
                  </p>
                  <button
                    onClick={() => handleNavigate(actionPath)}
                    className="w-full px-6 py-4 bg-white text-emerald-600 font-semibold rounded-xl hover:bg-emerald-50 transform hover:scale-105 transition-all duration-300 cursor-pointer"
                  >
                    {buttonLabel}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer Quote */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        {/* Islamic Pattern Overlay */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 11px)`,
          }}></div>
        </div>

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl shadow-lg">
              <BookOpenIcon className="w-8 h-8 text-white" />
            </div>
          </div>
          <blockquote className="text-3xl sm:text-4xl font-light mb-8 leading-relaxed font-scheherazade text-emerald-100">
            "{footerQuote.arabic}"
          </blockquote>
          <p className="text-xl text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
            "{footerQuote.translation}"
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="w-16 h-px bg-gradient-to-r from-transparent to-emerald-500"></div>
            <cite className="text-lg font-semibold text-emerald-400">
              — {footerQuote.reference}
            </cite>
            <div className="w-16 h-px bg-gradient-to-l from-transparent to-emerald-500"></div>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            {footerQuote.hadith}
          </p>
        </div>
      </section>
    </div>
  );
};

export default About;
