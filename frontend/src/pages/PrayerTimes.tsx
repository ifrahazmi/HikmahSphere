import React, { useState, useEffect, useCallback } from 'react';
import { 
  ClockIcon, 
  MapPinIcon,
  SunIcon,
  MoonIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  CloudIcon,
  BoltIcon,
  Cog6ToothIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import IslamicCalendar from '../components/IslamicCalendar';
import { API_URL } from '../config';
import { IslamicReminder, getCurrentPrayerWindow, selectReminder } from '../data/islamicReminders';

const PrayerTimes: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  
  // View mode and settings
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Calculation method settings
  const [selectedMadhab, setSelectedMadhab] = useState<string>(user?.madhab || 'shafi');
  const [calculationMethod, setCalculationMethod] = useState(4); // Default: Umm al-Qura (Saudi Arabia
  const [highLatitudeRule, setHighLatitudeRule] = useState(1); // Default: Middle of Night
  
  // Data states
  const [prayerData, setPrayerData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [islamicEvents, setIslamicEvents] = useState<any[]>([]);
  const [currentReminder, setCurrentReminder] = useState<IslamicReminder | null>(null); 

  useEffect(() => {
    setLoading(true); // Ensure loading starts immediately on mount
    // Try getting current location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          // Note: We don't set loading false here, we wait for fetchPrayerTimes
        },
        (err) => {
          console.warn("Geolocation denied or failed:", err);
          setLocation({ lat: 12.96, lon: 77.57 }); // Default to Bangalore
        }
      );
    } else {
      setLocation({ lat: 12.96, lon: 77.57 });
    }
  }, []);

  useEffect(() => {
    if (location) {
      if (viewMode === 'daily') {
        fetchData(location.lat, location.lon);
      } else if (viewMode === 'monthly') {
        fetchMonthlyData(location.lat, location.lon, selectedMonth, selectedYear);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, selectedMadhab, calculationMethod, highLatitudeRule, viewMode, selectedMonth, selectedYear]);

  const fetchData = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    
    // Convert madhab to school parameter (Aladhan API: 0=Shafi, 1=Hanafi)
    const school = selectedMadhab === 'hanafi' ? 1 : 0;
    
    try {
      // Fetch Prayer Times with selected method and high latitude rule
      const prayerRes = await fetch(`${API_URL}/prayers/times?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&latitudeAdjustmentMethod=${highLatitudeRule}`);
      const prayerJson = await prayerRes.json();
      
      if (prayerJson.status === 'success') {
        setPrayerData(prayerJson.data);
        
        // Extract Islamic events from the response
        const events = [];
        const hijriMonth = prayerJson.data?.date?.hijri?.month?.en;
        const hijriDay = prayerJson.data?.date?.hijri?.day;
        
        // Check for special Islamic dates
        if (hijriMonth === 'Ramaḍān') {
          events.push({ name: 'Ramadan', type: 'month', icon: '🌙' });
          if (hijriDay === '27') events.push({ name: 'Laylat al-Qadr (Night of Power)', type: 'special', icon: '✨' });
        }
        if (hijriMonth === 'Dhū al-Ḥijjah' && hijriDay === '9') {
          events.push({ name: 'Day of Arafah', type: 'special', icon: '🕋' });
        }
        if (hijriMonth === 'Dhū al-Ḥijjah' && (hijriDay === '10' || hijriDay === '11' || hijriDay === '12' || hijriDay === '13')) {
          events.push({ name: 'Eid al-Adha', type: 'holiday', icon: '🎉' });
        }
        if (hijriMonth === 'Shawwāl' && hijriDay === '1') {
          events.push({ name: 'Eid al-Fitr', type: 'holiday', icon: '🎉' });
        }
        if (hijriMonth === 'Muḥarram' && hijriDay === '10') {
          events.push({ name: 'Day of Ashura', type: 'special', icon: '🕌' });
        }
        
        setIslamicEvents(events);
      } else {
        console.warn("Prayer API Error:", prayerJson);
        setError('Unable to fetch prayer times.');
      }

      // Fetch Fasting Times
      const fastingRes = await fetch(`${API_URL}/prayers/fasting?latitude=${lat}&longitude=${lon}&method=${calculationMethod}`);
      const fastingJson = await fastingRes.json();
      
      if (fastingJson.status === 'success') {
          setFastingData(fastingJson.data);
      } else {
          console.warn("Fasting API Error:", fastingJson);
      }
      
      // Fetch Weather
      const weatherRes = await fetch(`${API_URL}/prayers/weather?latitude=${lat}&longitude=${lon}`);
      const weatherJson = await weatherRes.json();
      
      if (weatherJson.status === 'success') {
          setWeatherData(weatherJson.data);
      }

    } catch (err) {
      setError('Network error. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod, highLatitudeRule]);

  const fetchMonthlyData = useCallback(async (lat: number, lon: number, month: number, year: number) => {
    setLoading(true);
    setError(null);
    
    const school = selectedMadhab === 'hanafi' ? 1 : 0;
    
    // Helper function to calculate Qibla direction (bearing to Mecca)
    const calculateQiblaDirection = (userLat: number, userLon: number): number => {
      const MECCA_LAT = 21.4225;
      const MECCA_LON = 39.8262;
      const lat1 = userLat * Math.PI / 180;
      const lat2 = MECCA_LAT * Math.PI / 180;
      const dLon = (MECCA_LON - userLon) * Math.PI / 180;
      
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const bearing = Math.atan2(y, x) * 180 / Math.PI;
      
      // Normalize to 0-360
      return (bearing + 360) % 360;
    };
    
    // Helper function to calculate distance to Mecca using Haversine formula
    const calculateDistanceToMecca = (userLat: number, userLon: number): number => {
      const MECCA_LAT = 21.4225;
      const MECCA_LON = 39.8262;
      const R = 6371; // Earth's radius in kilometers
      const dLat = (MECCA_LAT - userLat) * Math.PI / 180;
      const dLon = (MECCA_LON - userLon) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(userLat * Math.PI / 180) * Math.cos(MECCA_LAT * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in kilometers
    };
    
    try {
      // Fetch monthly calendar from Aladhan API
      const response = await fetch(
        `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}&latitudeAdjustmentMethod=${highLatitudeRule}`
      );
      const data = await response.json();
      
      if (data.code === 200 && data.data) {
        setMonthlyData(data.data);
        // Set first day as current prayer data for display
        if (data.data.length > 0) {
          const firstDay = data.data[0];
          const qiblaDegrees = calculateQiblaDirection(lat, lon);
          const distanceToMecca = calculateDistanceToMecca(lat, lon);
          
          setPrayerData({
            times: {
              Fajr: firstDay.timings.Fajr,
              Sunrise: firstDay.timings.Sunrise,
              Dhuhr: firstDay.timings.Dhuhr,
              Asr: firstDay.timings.Asr,
              Maghrib: firstDay.timings.Maghrib,
              Isha: firstDay.timings.Isha,
              Imsak: firstDay.timings.Imsak
            },
            date: firstDay.date,
            qibla: { 
              direction: { degrees: qiblaDegrees },
              distance: { value: distanceToMecca }
            },
            meta: firstDay.meta
          });
        }
      } else {
        setError('Unable to fetch monthly data.');
      }
    } catch (err) {
      setError('Network error fetching monthly data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod, highLatitudeRule]);

  // Update reminder based on prayer times, Islamic events, and current time
  useEffect(() => {
    const updateReminder = () => {
      if (!prayerData?.times) return;
      
      const now = new Date();
      const prayerWindow = getCurrentPrayerWindow(prayerData.times);
      const dayOfWeek = now.getDay();
      // Use hour as seed for consistent rotation within same hour
      const seed = now.getHours() + now.getDate();
      
      const reminder = selectReminder(prayerWindow, islamicEvents, dayOfWeek, seed);
      setCurrentReminder(reminder);
    };
    
    updateReminder();
    
    // Update every minute to catch prayer time transitions
    const interval = setInterval(updateReminder, 60000);
    
    return () => clearInterval(interval);
  }, [prayerData, islamicEvents]);

  const handleCitySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;

    try {
      // Use OpenStreetMap Nominatim for geocoding
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityQuery)}`);
      const data = await response.json();

      if (data && data.length > 0) {
        setSearchResults(data);
        setError(null);
      } else {
        setError('City not found. Please try another name.');
        setSearchResults([]);
      }
    } catch (err) {
      setError('Failed to search location.');
    }
  };

  const selectLocation = (result: any) => {
    setLocation({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon)
    });
    setCityQuery(result.display_name.split(',')[0]); 
    setSearchResults([]);
    setShowSearch(false);
  };
  
  // Helper: Find weather closest to a given time string (e.g., "05:30")
  const getWeatherForTime = (timeStr: string) => {
      if (!weatherData || !weatherData.hourly) return null;
      
      // Parse prayer time "HH:mm"
      const [hours] = timeStr.split(':').map(Number);
      
      const now = new Date();
      const currentHour = hours; // Approximation is fine
      
      const index = weatherData.hourly.time.findIndex((t: string) => {
          const d = new Date(t);
          return d.getDate() === now.getDate() && d.getHours() === currentHour;
      });
      
      // Get Min/Max for the current day (Index 0 is today)
      // daily.temperature_2m_max[0] and min[0]
      const dailyMax = weatherData.daily?.temperature_2m_max?.[0];
      const dailyMin = weatherData.daily?.temperature_2m_min?.[0];

      if (index !== -1) {
          return {
              temp: weatherData.hourly.temperature_2m[index],
              code: weatherData.hourly.weather_code[index],
              min: dailyMin,
              max: dailyMax
          };
      }
      
      return {
          temp: weatherData.current.temperature_2m,
          code: weatherData.current.weather_code,
          min: dailyMin,
          max: dailyMax
      };
  };

  // Helper: Get Icon and Style based on weather code and prayer time context
  const getWeatherStyling = (code: number, prayerName: string) => {
    // Determine if night based on prayer name
    const isNight = ['Fajr', 'Maghrib', 'Isha'].includes(prayerName);

    // Thunderstorm (95, 96, 99)
    if (code >= 95) return { icon: BoltIcon, color: 'text-yellow-600', label: 'Thunder' };
    
    // Rain / Drizzle / Showers (51-67, 80-82)
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        return { icon: CloudIcon, color: 'text-blue-500', label: 'Rainy' };
    }
    
    // Snow (71-77)
    if (code >= 71 && code <= 77) {
        return { icon: CloudIcon, color: 'text-sky-300', label: 'Snowy' };
    }
    
    // Fog (45, 48)
    if (code >= 45 && code <= 48) {
        return { icon: CloudIcon, color: 'text-gray-400', label: 'Foggy' };
    }
    
    // Cloudy (1, 2, 3)
    if (code >= 1 && code <= 3) {
        return { icon: CloudIcon, color: 'text-gray-500', label: 'Cloudy' };
    }
    
    // Clear (0)
    if (isNight) {
        return { icon: MoonIcon, color: 'text-indigo-400', label: 'Clear' };
    }
    return { icon: SunIcon, color: 'text-orange-400', label: 'Sunny' };
  };

  // Define prayers list based on loaded data or placeholders if still loading (though spinner will cover it)
  const prayers = prayerData ? [
    { name: 'Fajr', time: prayerData.times?.Fajr, arabic: 'الفجر', description: 'Dawn Prayer', icon: MoonIcon },
    { name: 'Sunrise', time: prayerData.times?.Sunrise, arabic: 'الشروق', description: 'Sunrise', icon: SunIcon, isSecondary: true },
    { name: 'Dhuhr', time: prayerData.times?.Dhuhr, arabic: 'الظهر', description: 'Noon Prayer', icon: SunIcon },
    { name: 'Asr', time: prayerData.times?.Asr, arabic: 'العصر', description: 'Afternoon Prayer', icon: SunIcon },
    { name: 'Maghrib', time: prayerData.times?.Maghrib, arabic: 'المغرب', description: 'Sunset Prayer', icon: SunIcon },
    { name: 'Isha', time: prayerData.times?.Isha, arabic: 'العشاء', description: 'Night Prayer', icon: MoonIcon },
  ] : [];

  // Show full screen spinner while loading initial data
  if (loading || !prayerData) {
    return <LoadingSpinner fullScreen text="Loading prayer times..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Prayer Times</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Settings"
            >
              <Cog6ToothIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'daily'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <ClockIcon className="h-4 w-4 inline mr-1" />
              Daily
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'monthly'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <CalendarDaysIcon className="h-4 w-4 inline mr-1" />
              Monthly
            </button>
          </div>
          
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-4 text-left animate-fade-in-down">
              <h3 className="font-semibold text-lg mb-4 flex items-center">
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Prayer Calculation Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Calculation Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Method
                  </label>
                  <select
                    value={calculationMethod}
                    onChange={(e) => setCalculationMethod(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="0">Shia Ithna-Ansari</option>
                    <option value="1">University of Islamic Sciences, Karachi</option>
                    <option value="2">Islamic Society of North America (ISNA)</option>
                    <option value="3">Muslim World League (MWL)</option>
                    <option value="4">Umm Al-Qura University, Makkah</option>
                    <option value="5">Egyptian General Authority of Survey</option>
                    <option value="7">Institute of Geophysics, Tehran</option>
                    <option value="8">Gulf Region</option>
                    <option value="9">Kuwait</option>
                    <option value="10">Qatar</option>
                    <option value="11">Majlis Ugama Islam Singapura</option>
                    <option value="12">Union Organization islamic de France</option>
                    <option value="13">Diyanet İşleri Başkanlığı, Turkey</option>
                    <option value="14">Spiritual Administration of Muslims of Russia</option>
                  </select>
                </div>
                
                {/* School of Jurisprudence */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    School of Jurisprudence (Madhab)
                  </label>
                  <select
                    value={selectedMadhab}
                    onChange={(e) => setSelectedMadhab(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="shafi">Shafi'i / Maliki / Hanbali</option>
                    <option value="hanafi">Hanafi</option>
                  </select>
                </div>
                
                {/* High Latitude Rule */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    High Latitude Adjustment
                  </label>
                  <select
                    value={highLatitudeRule}
                    onChange={(e) => setHighLatitudeRule(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1">Middle of Night</option>
                    <option value="2">One Seventh</option>
                    <option value="3">Angle Based</option>
                  </select>
                </div>
                
                {/* Month/Year Selection for Monthly View */}
                {viewMode === 'monthly' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Month
                      </label>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Year
                      </label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {Array.from({ length: 5 }, (_, i) => {
                          const year = new Date().getFullYear() + i;
                          return (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          
          {/* Islamic Events Display */}
          {islamicEvents.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-lg p-4 mb-4">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {islamicEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`px-4 py-2 rounded-full text-sm font-medium ${
                      event.type === 'holiday'
                        ? 'bg-emerald-600 text-white'
                        : event.type === 'special'
                        ? 'bg-teal-600 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {event.icon} {event.name}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex flex-col items-center justify-center text-gray-600 mb-2">
            <button 
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center hover:text-emerald-600 transition-colors"
            >
                <MapPinIcon className="h-5 w-5 mr-2" />
                <span>
                    {location ? `${cityQuery || 'Current Location'} (${location.lat.toFixed(2)}, ${location.lon.toFixed(2)})` : 'Select Location'}
                </span>
            </button>
            
            <div className="flex items-center space-x-2 mt-1">
                <p className="text-sm text-emerald-600 font-medium">
                    {prayerData?.date?.readable} • {prayerData?.date?.hijri?.day} {prayerData?.date?.hijri?.month?.en} {prayerData?.date?.hijri?.year}
                </p>
                
                {/* Current Weather Display next to date */}
                {weatherData && (
                    <span className="text-sm text-gray-400 flex items-center">
                         <span className="mx-2">|</span> 
                         {weatherData.current.temperature_2m}°C 
                         <span className="hidden sm:inline ml-1">({getWeatherStyling(weatherData.current.weather_code, 'Dhuhr').label})</span>
                    </span>
                )}
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="max-w-md mx-auto mt-4 relative animate-fade-in-down">
                <form onSubmit={handleCitySearch} className="relative">
                <input
                    type="text"
                    placeholder="Enter city name..."
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <button 
                    type="submit"
                    className="absolute right-1 top-1 bg-emerald-600 text-white px-3 py-1 rounded-md hover:bg-emerald-700 text-sm"
                >
                    Search
                </button>
                </form>

                {searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result: any, idx) => (
                    <button
                        key={idx}
                        onClick={() => selectLocation(result)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm text-gray-700"
                    >
                        {result.display_name}
                    </button>
                    ))}
                </div>
                )}
            </div>
          )}
          
          {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </div>

        {/* Monthly Calendar View */}
        {viewMode === 'monthly' && monthlyData && (
          <div className="max-w-6xl mx-auto mb-8">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-emerald-600 text-white px-6 py-4">
                <h2 className="text-2xl font-bold">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fajr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sunrise</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dhuhr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asr</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Maghrib</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Isha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hijri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {monthlyData.map((day: any, idx: number) => {
                      const isToday = new Date(day.date.gregorian.date).toDateString() === new Date().toDateString();
                      
                      // Detect Islamic months and special days
                      const hijriMonth = day.date.hijri.month.en;
                      const hijriDay = parseInt(day.date.hijri.day);
                      const isRamadan = hijriMonth.includes('Rama') || hijriMonth.includes('rama');
                      const isEidFitr = hijriMonth === 'Shawwāl' && hijriDay === 1;
                      const isEidAdha = hijriMonth === 'Dhū al-Ḥijjah' && hijriDay === 10;
                      const isArafah = hijriMonth === 'Dhū al-Ḥijjah' && hijriDay === 9;
                      const isAshura = hijriMonth === 'Muḥarram' && hijriDay === 10;
                      
                      // Determine row background color (priority order)
                      let rowBgClass = 'hover:bg-gray-50';
                      if (isToday) {
                        rowBgClass = 'bg-emerald-100 hover:bg-emerald-100';
                      } else if (isEidFitr) {
                        rowBgClass = 'bg-green-100 hover:bg-green-100';
                      } else if (isEidAdha) {
                        rowBgClass = 'bg-red-100 hover:bg-red-100';
                      } else if (isArafah) {
                        rowBgClass = 'bg-purple-100 hover:bg-purple-100';
                      } else if (isAshura) {
                        rowBgClass = 'bg-blue-100 hover:bg-blue-100';
                      } else if (isRamadan) {
                        rowBgClass = 'bg-indigo-50 hover:bg-indigo-50';
                      }
                      
                      return (
                        <tr key={idx} className={rowBgClass}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {day.date.gregorian.day}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {day.date.gregorian.weekday.en}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Fajr}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{day.timings.Sunrise}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Dhuhr}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Asr}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Maghrib}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Isha}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {day.date.hijri.day} {day.date.hijri.month.en}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Color Legend */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Color Legend</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-emerald-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Today</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-indigo-50 mr-2"></div>
                    <span className="text-xs text-gray-600">Ramadan</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-green-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Fitr</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-red-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Adha</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-purple-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Day of Arafah</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded bg-blue-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Ashura</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid: Prayer Cards + Calendar */}
        {viewMode === 'daily' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-8 max-w-6xl mx-auto">
          {/* Prayer Cards Column */}
          <div className="xl:col-span-3">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
              {prayers.map((prayer) => {
                // Get weather for this prayer time
                const weather = getWeatherForTime(prayer.time);
                const weatherStyle = weather ? getWeatherStyling(weather.code, prayer.name) : null;
                const WeatherIcon = weatherStyle?.icon || SunIcon;
                
                return (
                    <div key={prayer.name} className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 ${prayer.isSecondary ? 'border-orange-200' : 'border-emerald-500'} flex flex-col justify-between`}>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                            <prayer.icon className={`h-6 w-6 mr-2 ${prayer.isSecondary ? 'text-orange-400' : 'text-emerald-600'}`} />
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{prayer.name}</h3>
                                <p className="text-sm text-gray-500">{prayer.description}</p>
                            </div>
                            </div>
                            <div className="text-right">
                            <p className={`text-2xl font-bold ${prayer.isSecondary ? 'text-gray-700' : 'text-emerald-600'}`}>{prayer.time}</p>
                            <p className="text-sm font-arabic text-gray-600">{prayer.arabic}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Footer Section: Fasting Info & Weather */}
                    <div className="mt-4 flex items-end justify-between border-t border-gray-50 pt-3 min-h-[50px]">
                        {/* Left Side: Fasting Info */}
                        <div className="flex-1">
                            {prayer.name === 'Fajr' && fastingData && (
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Sehri Ends</span>
                                    <span className="text-sm font-bold text-emerald-600">{fastingData.sahur || fastingData.imsak}</span>
                                </div>
                            )}
                            {prayer.name === 'Maghrib' && fastingData && (
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                    <span className="text-sm font-bold text-emerald-600">{fastingData.iftar}</span>
                                </div>
                            )}
                        </div>

                        {/* Right Side: Enhanced Weather Info with Max/Min */}
                        {weather && weatherStyle && (
                            <div className="flex items-center justify-end text-right">
                                <div className="mr-2 flex flex-col items-end">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{weatherStyle.label}</span>
                                    <div className="flex items-baseline">
                                         <span className="text-xl font-bold text-gray-700 leading-none mr-2">{Math.round(weather.temp)}°</span>
                                         <div className="flex flex-col text-[10px] text-gray-400 leading-tight">
                                            {weather.max && <span>H: {Math.round(weather.max)}°</span>}
                                            {weather.min && <span>L: {Math.round(weather.min)}°</span>}
                                         </div>
                                    </div>
                                </div>
                                <div className={`p-1.5 rounded-full bg-gray-50 ${weatherStyle.color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100').replace('300', '50')}`}>
                                     <WeatherIcon className={`h-8 w-8 ${weatherStyle.color}`} />
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                );
              })}
            </div>
          </div>

          {/* Calendar Column */}
          <div className="xl:col-span-1">
            <IslamicCalendar />
          </div>
        </div>
        )}

        {/* Qibla & Info Section */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6 md:col-span-1">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <GlobeAltIcon className="h-6 w-6 text-teal-600 mr-2" />
                    Qibla Direction
                </h2>
                <div className="flex flex-col items-center justify-center py-4">
                    <div className="text-4xl font-bold text-teal-600 mb-1">
                        {Math.round(prayerData?.qibla?.direction?.degrees || 0)}°
                    </div>
                    <p className="text-gray-500 text-sm">From North</p>
                    <p className="text-gray-600 mt-2 font-medium">
                        Distance: {Math.round(prayerData?.qibla?.distance?.value || 0).toLocaleString()} km
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <MoonIcon className="h-6 w-6 text-emerald-600 mr-2" />
                  {currentReminder?.title || 'Daily Reminder'}
                </h2>
                {currentReminder ? (
                  <div className="space-y-3">
                    {/* Arabic Text */}
                    <div className="text-center py-2 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg">
                      <p className="text-xl md:text-2xl font-arabic leading-relaxed text-gray-800 px-4" dir="rtl">
                        {currentReminder.arabic}
                      </p>
                    </div>
                    
                    {/* Transliteration & Translation in two columns on larger screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="text-center lg:text-left lg:border-r lg:border-gray-100 lg:pr-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Transliteration</p>
                        <p className="text-sm italic text-gray-600 leading-relaxed">
                          "{currentReminder.transliteration}"
                        </p>
                      </div>
                      
                      <div className="text-center lg:text-left">
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Translation</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          "{currentReminder.translation}"
                        </p>
                      </div>
                    </div>
                    
                    {/* Source */}
                    <div className="text-center border-t border-gray-100 pt-2">
                      <p className="text-xs text-gray-500 font-medium">
                        — {currentReminder.source}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-lg font-arabic text-gray-700 mb-2" dir="rtl">
                      "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا"
                    </p>
                    <p className="text-sm text-gray-500 italic">
                      "Indeed, prayer has been decreed upon the believers a decree of specified times."
                    </p>
                    <p className="text-xs text-gray-400 mt-2">— Quran 4:103</p>
                  </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default PrayerTimes;
