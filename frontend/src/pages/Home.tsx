import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartIcon,
  CheckCircleIcon,
  SparklesIcon,
  GlobeAltIcon,
  ClockIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';

const Home: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  
  // Check for admin OR manager role
  const isAdmin = user && (user.role === 'superadmin' || user.isAdmin);
  const isManager = user && user.role === 'manager';
  const hasManagementAccess = isAdmin || isManager;

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleStartJourney = (e: React.MouseEvent) => {
    e.preventDefault();
    if (user) {
        navigate('/profile');
    } else {
        navigate('/auth');
    }
  };

  const handleManagementAction = (e: React.MouseEvent) => {
      e.preventDefault();
      if (hasManagementAccess) {
          navigate('/zakat');
      } else {
          if (user) {
             navigate('/zakat');
          } else {
             navigate('/auth');
          }
      }
  }

  const scrollToFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('features-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    {
      icon: '/Smart-Prayer-Times.png',
      title: 'Smart Prayer Times',
      description: 'Ultra-precise prayer times with real-time geolocation, multiple calculation methods (MWL, ISNA, Umm al-Qura), astronomical corrections for high latitudes, and beautiful shareable prayer cards',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: '/Quran-Reader.png',
      title: 'Quran Reader',
      description: 'Complete 114 Surahs with 10+ translations, semantic AI search, audio recitations, bookmarks, Indopak script, customizable fonts, and seamless navigation between ayahs',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: '/Zakat.png',
      title: hasManagementAccess ? 'Zakat Management' : 'Zakat Calculator',
      description: hasManagementAccess
        ? 'Complete Zakat dashboard with donor tracking, collection/spending records, real-time balance, donor leaderboards, and export capabilities for transparent fund management'
        : 'Intelligent Zakat calculator with live nisab rates, support for gold/silver/assets/crypto, 2.5% calculation, and multiple scholarly methodologies',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      gradient: 'from-yellow-500 to-amber-500',
    },
    {
      icon: '/Global-Community.png',
      title: 'Global Community',
      description: 'Connect with Muslims worldwide through community forums, local event discovery, group discussions, and reputation systems fostering meaningful Islamic brotherhood',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: '/Qibla-Finder-AR.png',
      title: 'Qibla Finder AR',
      description: 'Augmented reality Qibla direction with 3D compass, precise geolocation calculations, visual overlay guidance, and accurate Kaaba direction for any location worldwide',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      gradient: 'from-teal-500 to-emerald-500',
    },
    {
      icon: '/AI-Scholar-Assistant.png',
      title: 'AI Assistant',
      description: 'Islamic AI assistant for religious questions and guidance',
      color: 'text-gray-400',
      bgColor: 'bg-gray-100',
      disabled: true,
      gradient: 'from-gray-400 to-gray-500',
    },
  ];

  const stats = [
    {
      label: 'Accurate Prayer Times',
      description: 'Real-time geolocation & multiple calculation methods',
      icon: ClockIcon,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      label: 'Complete Quran',
      description: '114 Surahs with 10+ translations & audio',
      icon: BookOpenIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Smart Zakat',
      description: 'Live nisab rates & all asset types supported',
      icon: SparklesIcon,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
    {
      label: 'Global Qibla',
      description: 'AR-powered precise direction worldwide',
      icon: GlobeAltIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  const testimonials = [
    {
      name: 'Ahmad Hassan',
      location: 'Bangalore, India',
      text: 'The prayer times feature has transformed my daily Salah routine. The accurate geolocation-based calculations and beautiful prayer cards I can share with family make staying connected to my faith effortless. The notifications are perfectly timed!',
      rating: 5,
      avatar: '🧔🏽',
      feature: 'Prayer Times',
    },
    {
      name: 'Fatima Zahra',
      location: 'Bangalore, India',
      text: 'The Zakat calculator is incredibly comprehensive. It calculated my Zakat considering gold, silver, savings, and even my investments. The live nisab rates gave me confidence that my calculation was accurate. Made my annual Zakat so much easier!',
      rating: 5,
      avatar: '🧕🏼',
      feature: 'Quran Reader',
    },
    {
      name: 'Zafia Chowdhury',
      location: 'Bangalore, India',
      text: 'As someone who reads Quran daily, the multi-translation reader with Indopak script is a blessing. I can compare translations, bookmark my favorite ayahs, and the audio recitations help me improve my Tajweed. The semantic search finds exactly what I need!',
      rating: 5,
      avatar: '🧕🏽',
      feature: 'Community',
    },
    {
      name: 'Zeenaat Chowdhury',
      location: 'Kolkata, India',
      text: 'As a mother, my heart fills with pride seeing my son create something so beneficial for the Ummah. This platform beautifully combines technology with Islamic values. May Allah accept this sincere effort, bless you abundantly, and grant you the ability to continue serving the Deen. Aameen.',
      rating: 5,
      avatar: '🧕🏾',
      feature: 'Mother\'s Message',
      special: true,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 text-white overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-32">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Logo with Glow Effect */}
            <div className="flex justify-center mb-10">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-2xl animate-pulse"></div>
                <div className="relative p-5 bg-white rounded-full border-4 border-white/30 shadow-2xl">
                  <img src="/logo.png" alt="HikmahSphere Logo" className="w-40 h-40 sm:w-48 sm:h-48 object-contain" />
                </div>
              </div>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-8">
              <SparklesIcon className="w-4 h-4 text-emerald-300" />
              <span className="text-sm font-medium text-emerald-100">Your Complete Islamic Digital Companion</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight">
              <span className="block text-white">Welcome to</span>
              <span className="block bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                HikmahSphere
              </span>
            </h1>

            <p className="text-xl sm:text-2xl mb-10 text-emerald-100 max-w-3xl mx-auto leading-relaxed">
              Where Islamic knowledge, technology, and spiritual guidance unite in one beautiful digital experience
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={handleStartJourney}
                className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl cursor-pointer flex items-center gap-2"
              >
                Start Your Journey
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <button
                onClick={scrollToFeatures}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/20 transform hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                Explore Features
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-6 text-emerald-200/80 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <span>Free Forever</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <span>No Ads</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <span>Privacy First</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                <span>Trusted Globally</span>
              </div>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 0L60 10C120 20 240 40 360 53.3C480 67 600 73 720 73.3C840 73 960 67 1080 53.3C1200 40 1320 20 1380 10L1440 0V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0V0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Choose HikmahSphere?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Built with love for the global Muslim community
            </p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className={`text-center p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className={`w-14 h-14 ${stat.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <stat.icon className={`w-7 h-7 ${stat.color}`} />
                </div>
                <div className="text-base font-bold text-gray-900 mb-2">
                  {stat.label}
                </div>
                <div className="text-sm text-gray-500">
                  {stat.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features-section" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full mb-6">
              <SparklesIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Powerful Features</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Everything You Need in One Place
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Experience Islam in the digital age with cutting-edge technology designed for the modern Muslim
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-gray-100 overflow-hidden ${feature.disabled ? 'opacity-60' : ''}`}
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                <div className="relative">
                  {/* Icon with Animation */}
                  <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 overflow-hidden group-hover:scale-110 transition-transform duration-300`}>
                    {typeof feature.icon === 'string' && (feature.icon.includes('.png') || feature.icon.includes('.jpg') || feature.icon.includes('.svg')) ? (
                      <img src={feature.icon} alt={feature.title} className="w-14 h-14 object-contain" />
                    ) : typeof feature.icon === 'string' ? (
                      <span className="text-3xl">{feature.icon}</span>
                    ) : (
                      React.createElement(feature.icon as any, { className: `w-8 h-8 ${feature.color}` })
                    )}
                  </div>
                  
                  {/* Coming Soon Badge */}
                  {feature.disabled && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-gray-500 to-gray-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
                      Coming Soon
                    </div>
                  )}
                  
                  {/* Feature Card Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-emerald-600 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className={`leading-relaxed ${feature.disabled ? 'text-gray-500' : 'text-gray-600'}`}>
                    {feature.description}
                  </p>
                  
                  {/* Learn More Link */}
                  {!feature.disabled && (
                    <div className="mt-6 flex items-center gap-2 text-emerald-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                      <span>Learn more</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full mb-6 shadow-md">
              <HeartIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Community Love</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Loved by Muslims Worldwide
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Join millions who have transformed their spiritual journey with HikmahSphere
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`group rounded-2xl p-8 transition-all duration-300 transform hover:-translate-y-2 ${
                  testimonial.special
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 shadow-xl col-span-full max-w-3xl mx-auto'
                    : 'bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl border border-emerald-100'
                }`}
              >
                {/* Special Badge for Founder's Message */}
                {testimonial.special && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-full mb-4">
                    <HeartIcon className="w-3 h-3" />
                    Mother's Message
                  </div>
                )}

                {/* Rating Stars */}
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Feature Tag */}
                {!testimonial.special && (
                  <div className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full mb-4">
                    {testimonial.feature}
                  </div>
                )}

                {/* Testimonial Text */}
                <p className={`mb-6 leading-relaxed ${
                  testimonial.special 
                    ? 'text-gray-800 text-lg italic font-medium' 
                    : 'text-gray-700 italic'
                }`}>
                  {testimonial.special ? (
                    <>
                      <span className="text-3xl text-emerald-600 mr-2">"</span>
                      {testimonial.text}
                      <span className="text-3xl text-emerald-600 ml-2">"</span>
                    </>
                  ) : (
                    `"${testimonial.text}"`
                  )}
                </p>

                {/* User Info */}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl ${
                    testimonial.special
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-400'
                  }`}>
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg">
                      {testimonial.name}
                    </div>
                    <div className="text-sm text-gray-500 flex items-center gap-1">
                      <GlobeAltIcon className="w-3 h-3" />
                      {testimonial.location}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}></div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl"></div>
        
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-8">
            <SparklesIcon className="w-4 h-4 text-emerald-300" />
            <span className="text-sm font-medium">Get Started Today</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            {hasManagementAccess
              ? 'Start Managing Zakat Funds'
              : 'Ready to Transform Your Islamic Journey?'
            }
          </h2>
          <p className="text-xl mb-10 text-emerald-100 max-w-2xl mx-auto">
            {hasManagementAccess
              ? 'Efficiently track, allocate, and distribute Zakat to those in need with HikmahSphere Management.'
              : 'Join the global Muslim community and experience the future of Islamic technology'
            }
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
            {hasManagementAccess ? (
                <button
                  onClick={handleManagementAction}
                  className="group px-8 py-4 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transform hover:scale-105 transition-all duration-300 shadow-2xl cursor-pointer flex items-center gap-2"
                >
                  Start Managing Zakat
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
            ) : (
                <button
                  onClick={handleStartJourney}
                  className="group px-8 py-4 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transform hover:scale-105 transition-all duration-300 shadow-2xl cursor-pointer flex items-center gap-2"
                >
                  Get Started Free
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
            )}

            <Link
              to="/community"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-bold rounded-xl hover:bg-white/20 transform hover:scale-105 transition-all duration-300"
            >
              Join Community
            </Link>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
              <span className="font-medium">Free Forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
              <span className="font-medium">No Ads</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-300" />
              <span className="font-medium">Privacy Focused</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quran Verse Section */}
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
            "وَاعْتَصِمُوا بِحَبْلِ اللَّهِ جَمِيعًا وَلَا تَفَرَّقُوا"
          </blockquote>
          <p className="text-xl text-gray-300 mb-6 max-w-2xl mx-auto leading-relaxed">
            "And hold firmly to the rope of Allah all together and do not become divided"
          </p>
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-emerald-500"></div>
            <cite className="text-lg font-semibold text-emerald-400">Quran 3:103</cite>
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-emerald-500"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
