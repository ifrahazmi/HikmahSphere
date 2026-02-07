import React, { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  MapPinIcon,
  SunIcon,
  MoonIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  CloudIcon,
  BoltIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import IslamicCalendar from '../components/IslamicCalendar';
import { API_URL } from '../config';

const PrayerTimes: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  
  // Calculation method settings
  const [selectedMadhab, setSelectedMadhab] = useState<string>(user?.madhab || 'shafi');
  const method = 3; // Muslim World League
  
  // Data states
  const [prayerData, setPrayerData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null); 

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
      fetchData(location.lat, location.lon);
    }
  }, [location, selectedMadhab]); // Re-fetch when location or madhab changes

  const fetchData = async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    
    // Convert madhab to school parameter (Aladhan API: 0=Shafi, 1=Hanafi)
    const school = selectedMadhab === 'hanafi' ? 1 : 0;
    
    try {
      // Fetch Prayer Times
      const prayerRes = await fetch(`${API_URL}/prayers/times?latitude=${lat}&longitude=${lon}&method=${method}&school=${school}`);
      const prayerJson = await prayerRes.json();
      
      if (prayerJson.status === 'success') {
        setPrayerData(prayerJson.data);
      } else {
        console.warn("Prayer API Error:", prayerJson);
        setError('Unable to fetch prayer times.');
      }

      // Fetch Fasting Times
      const fastingRes = await fetch(`${API_URL}/prayers/fasting?latitude=${lat}&longitude=${lon}&method=${method}`);
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
  };

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
      const [hours, minutes] = timeStr.split(':').map(Number);
      
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Prayer Times</h1>
          
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
            
            {/* Madhab Selector */}
            <div className="mt-3 flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Calculation Method:</label>
              <select 
                value={selectedMadhab}
                onChange={(e) => setSelectedMadhab(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="shafi">Shafi'i / Maliki / Hanbali (Standard)</option>
                <option value="hanafi">Hanafi (Later Asr)</option>
              </select>
            </div>
            
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

        {/* Main Content Grid: Prayer Cards + Calendar */}
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

        {/* Qibla & Info Section */}
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
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

            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Reminder</h2>
                <div className="text-center py-4">
                    <p className="text-lg font-arabic text-gray-700 mb-2">
                    "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا"
                    </p>
                    <p className="text-sm text-gray-500 italic">
                    "Indeed, prayer has been decreed upon the believers a decree of specified times."
                    </p>
                    <p className="text-xs text-gray-400 mt-2">- Quran 4:103</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PrayerTimes;
