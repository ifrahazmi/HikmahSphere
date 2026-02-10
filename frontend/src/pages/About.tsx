import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

import HeroSphere from '../components/HeroSphere';
import LiveStatistics from '../components/LiveStatistics';
import MissionPillars from '../components/MissionPillars';
import Timeline from '../components/Timeline';
import FeatureShowcase from '../components/FeatureShowcase';
import {
  heroContent,
  missionStatement,
  pillars,
  timeline,
  approachPillars,
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

  // Check if user is admin or manager
  const isAdmin = user && (user.role === 'superadmin' || user.isAdmin);
  const isManager = user && user.role === 'manager';
  const hasManagementAccess = isAdmin || isManager;

  // Create features list with conditional Zakat description
  const featuresWithConditionalZakat: SpiritualFeature[] = spiritualFeatures.map((feature) => {
    if (feature.id === 'zakat') {
      return {
        ...feature,
        name: hasManagementAccess ? 'Zakat Management' : 'Zakat Calculator',
        spiritualPurpose: hasManagementAccess
          ? 'Purify your wealth, fulfill your obligation, track the impact of your charity.'
          : 'Intelligent Zakat calculation supporting all methodologies and cryptocurrencies'
      };
    }
    return feature;
  });

  useEffect(() => {
    setDailyVerse(getRandomVerse());
  }, []);

  const handleNavigate = (path: string) => {
    if (path.startsWith('http')) {
      window.open(path, '_blank');
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen pt-16">
      {/* Hero Section with 3D Rotating Background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden -mt-16">
        {/* 3D Rotating Background Sphere */}
        <div className="absolute inset-0 top-0">
          <HeroSphere />
        </div>

        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 via-emerald-800/80 to-teal-900/90"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 to-teal-600/30"></div>

        {/* Floating 3D Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full rotate-3d-slow"></div>
        <div className="absolute bottom-20 right-10 w-16 h-16 bg-emerald-300/20 rounded-full rotate-3d-medium"></div>
        <div className="absolute top-1/3 right-16 w-24 h-24 bg-teal-400/10 rounded-full rotate-3d-slow" style={{ animationDelay: '2s' }}></div>

        {/* Content Overlaid on 3D Background */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Daily Wisdom */}
          {dailyVerse && (
            <div className="mb-12 lg:mb-16 animate-fadeInUp">
              <span className="text-3xl lg:text-4xl mb-6 block">📖</span>
              <p className="text-xl lg:text-2xl text-emerald-100 font-scheherazade mb-3 leading-relaxed">
                "{dailyVerse.verse}"
              </p>
              <p className="text-lg text-white italic mb-2 font-light">
                {dailyVerse.translation}
              </p>
              <p className="text-xs lg:text-sm text-emerald-200">
                {dailyVerse.chapter} • {dailyVerse.reference}
              </p>
            </div>
          )}

          {/* Main Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white drop-shadow-lg">
            {heroContent.headline}
          </h1>

          {/* Subheadline */}
          <p className="text-xl sm:text-2xl lg:text-3xl text-emerald-50 max-w-3xl mx-auto leading-relaxed mb-10 font-light drop-shadow">
            {heroContent.subheadline}
          </p>

          {/* CTA Button */}
          <button
            onClick={() => document.getElementById('mission-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-8 py-4 bg-white text-emerald-900 font-semibold rounded-lg hover:bg-emerald-50 transform hover:scale-110 transition-all duration-200 shadow-2xl cursor-pointer text-lg"
          >
            {heroContent.cta}
          </button>

          {/* Scroll Indicator */}
          <div className="mt-20 flex justify-center">
            <div className="animate-bounce">
              <svg className="w-6 h-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Live Statistics Section */}
      <LiveStatistics />

      {/* Our Story Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {storyContent.headline}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            <div className="space-y-6">
              <p className="text-lg text-gray-700 leading-relaxed italic font-semibold">
                {storyContent.problemStatement}
              </p>

              {storyContent.originStory.map((paragraph, index) => (
                <p key={index} className="text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="space-y-8">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-8 border border-emerald-100">
                <h3 className="text-2xl font-bold text-emerald-900 mb-4">
                  {storyContent.nameExplanation.hikma.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {storyContent.nameExplanation.hikma.meaning}
                </p>
              </div>

              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-8 border border-teal-100">
                <h3 className="text-2xl font-bold text-teal-900 mb-4">
                  {storyContent.nameExplanation.sphere.title}
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {storyContent.nameExplanation.sphere.meaning}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section id="mission-section" className="py-20 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Our Mission: The Guiding Light
            </h2>
            <p className="text-xl text-emerald-700 max-w-3xl mx-auto font-semibold italic">
              {missionStatement}
            </p>
          </div>

          <MissionPillars pillars={pillars} title="" description="" />
        </div>
      </section>

      {/* Vision Timeline Section */}
      <Timeline phases={timeline} />

      {/* Approach to Guidance Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Approach to Guidance
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              In an age of confusion, we turn to the sources that have guided the Ummah for 1400 years
            </p>
          </div>

          <MissionPillars pillars={approachPillars} title="" description="" />

          <div className="mt-16 bg-emerald-900 text-white rounded-xl p-8 lg:p-12">
            <h3 className="text-2xl font-bold mb-6">Our Scholarly Foundations</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-2 text-emerald-300">Sources</h4>
                <p className="text-emerald-100">
                  Every guidance is traced through Quran, Authentic Sunnah, and the methodology of the Righteous Predecessors (Salaf)
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2 text-emerald-300">Scholarship</h4>
                <p className="text-emerald-100">
                  Partnered with recognized Islamic institutions and qualified Ulama for verification and oversight
                </p>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2 text-emerald-300">Respect</h4>
                <p className="text-emerald-100">
                  We acknowledge valid scholarly differences (ikhtilaf) while maintaining Ahl al-Sunnah wal-Jama'ah principles
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <FeatureShowcase features={featuresWithConditionalZakat} />

      {/* Trust & Safety Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Our Promise: Trust & Safety
            </h2>
            <p className="text-xl text-gray-600">
              Your trust is sacred to us. Here's what we're committed to.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {promises.map((promise) => {
              const Icon = promise.icon;
              const bgClass = promise.color.replace('text-', 'bg-') + '-50';

              return (
                <div
                  key={promise.id}
                  className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className={`w-16 h-16 ${bgClass} rounded-lg flex items-center justify-center mb-6`}>
                    <Icon className={`w-8 h-8 ${promise.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    {promise.title}
                  </h3>
                  <p className="text-gray-600">
                    {promise.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-700 italic">
              These commitments form the ethical foundation of HikmahSphere. We believe technology should serve humanity with integrity.
            </p>
          </div>
        </div>
      </section>

      {/* Developer Team Section */}
      <section className="py-20 bg-gradient-to-br from-white via-emerald-50 to-teal-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Meet the Team Behind HikmahSphere
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Dedicated professionals united by the mission to bring authentic Islamic knowledge to the digital world
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 lg:max-w-3xl mx-auto">
            {developers.map((dev) => (
              <div
                key={dev.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-1 w-full"
              >
                {/* Developer Image */}
                <div className="relative h-96 overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500">
                  <img
                    src={dev.image}
                    alt={dev.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                </div>

                {/* Developer Info */}
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {dev.name}
                  </h3>
                  <p className="text-emerald-600 font-semibold mb-4">
                    {dev.role}
                  </p>

                  <p className="text-gray-700 leading-relaxed mb-6">
                    {dev.bio}
                  </p>

                  {/* Expertise */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      Expertise
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {dev.expertise.map((skill, index) => (
                        <span
                          key={index}
                          className="inline-block bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Social Links */}
                  {dev.social && (
                    <div className="flex gap-4 pt-4 border-t border-gray-200">
                      {dev.social.github && (
                        <a
                          href={dev.social.github}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-emerald-600 transition-colors"
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
                          className="text-gray-600 hover:text-emerald-600 transition-colors"
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
                          className="text-gray-600 hover:text-emerald-600 transition-colors"
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

          {/* Team Message */}
          <div className="mt-16 text-center p-8 bg-emerald-900 text-white rounded-xl">
            <p className="text-lg leading-relaxed">
              Our team is driven by one shared conviction: that technology must serve humanity with integrity, and that authentic Islamic knowledge deserves a digital home built with care, expertise, and deep respect.
            </p>
          </div>
        </div>
      </section>


      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Join the Journey
            </h2>
            <p className="text-xl text-emerald-100 max-w-3xl mx-auto">
              Whether you're a user seeking knowledge, a scholar contributing guidance, or a developer building the future—there's a place for you in HikmahSphere
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {journeyOptions.map((option, index) => {
              const Icon = option.icon;

              return (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 hover:border-white/40 hover:bg-white/15 transition-all duration-300"
                >
                  <Icon className="w-12 h-12 text-white mb-4" />
                  <h3 className="text-2xl font-bold mb-3">
                    {option.title}
                  </h3>
                  <p className="text-emerald-100 mb-6 leading-relaxed">
                    {option.description}
                  </p>
                  <button
                    onClick={() => handleNavigate(option.buttonAction)}
                    className="w-full px-6 py-3 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transform hover:scale-105 transition-all duration-200 cursor-pointer"
                  >
                    {option.buttonText}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer Quote Section */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <span className="text-6xl">📖</span>
          </div>
          <blockquote className="text-2xl sm:text-3xl font-light mb-6 leading-relaxed font-scheherazade">
            "{footerQuote.arabic}"
          </blockquote>
          <p className="text-lg text-gray-300 mb-4">
            "{footerQuote.translation}"
          </p>
          <cite className="text-emerald-400 block">
            — {footerQuote.reference}
          </cite>
          <p className="text-sm text-gray-500 mt-4">
            {footerQuote.hadith}
          </p>
        </div>
      </section>
    </div>
  );
};

export default About;
