import React, { useState, useEffect, useCallback, useRef } from 'react';
import html2canvas from 'html2canvas';
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
  CalendarDaysIcon,
  SparklesIcon,
  BookOpenIcon,
  ShareIcon,
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
  const [location, setLocation] = useState<{lat: number, lon: number, city?: string, country?: string} | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  // View mode and settings
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'ramadan'>('daily');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [ramadanData, setRamadanData] = useState<any>(null);
  const [isRamadanMonth, setIsRamadanMonth] = useState(false);

  // Calculation method settings
  const [selectedMadhab, setSelectedMadhab] = useState<string>(user?.madhab || 'shafi');
  const [calculationMethod, setCalculationMethod] = useState(1); // Default: University of Islamic Sciences, Karachi
  const [highLatitudeRule, setHighLatitudeRule] = useState(1); // Default: Middle of Night

  // Data states
  const [prayerData, setPrayerData] = useState<any>(null);
  const [fastingData, setFastingData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [islamicEvents, setIslamicEvents] = useState<any[]>([]);
  const [currentReminder, setCurrentReminder] = useState<IslamicReminder | null>(null);

  // Share image generation states
  const [showRatioModal, setShowRatioModal] = useState(false);
  const [shareType, setShareType] = useState<'dua' | 'hadith'>('dua');
  const [selectedRatio, setSelectedRatio] = useState<'story' | 'post'>('story');
  const duaImageRef = useRef<HTMLDivElement>(null);
  const hadithImageRef = useRef<HTMLDivElement>(null);

  // Countdown timer states
  const [currentPrayerIndex, setCurrentPrayerIndex] = useState(-1);
  const [nextPrayerIndex, setNextPrayerIndex] = useState(-1);
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isNextDay, setIsNextDay] = useState(false);

  // Refs for prayer cards to enable auto-scroll
  const prayerCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasScrolledRef = useRef(false);
  const prayersContainerRef = useRef<HTMLDivElement>(null);

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
        fetchData(location.lat, location.lon, location.city, location.country);
      } else if (viewMode === 'monthly') {
        fetchMonthlyData(location.lat, location.lon, selectedMonth, selectedYear);
      } else if (viewMode === 'ramadan') {
        fetchRamadanData(location.lat, location.lon);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, selectedMadhab, calculationMethod, highLatitudeRule, viewMode, selectedMonth, selectedYear]);

  const fetchData = useCallback(async (lat: number, lon: number, city?: string, country?: string) => {
    setLoading(true);
    setError(null);

    // Convert madhab to school parameter (Backend API: 1=Shafi/Maliki/Hanbali, 2=Hanafi)
    const school = selectedMadhab === 'hanafi' ? 2 : 1;

    try {
      // Fetch Prayer Times from Backend API
      let prayerUrl = '';

      // Use city-based API if city and country are available
      if (city && country) {
        prayerUrl = `${API_URL}/prayers/timesByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${calculationMethod}&school=${school}`;
      } else {
        // Fallback to coordinates-based API
        prayerUrl = `${API_URL}/prayers/times?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}`;
      }

      console.log('Fetching prayer times from backend:', prayerUrl);
      const prayerRes = await fetch(prayerUrl);
      const prayerJson = await prayerRes.json();

      if (prayerJson.status === 'success') {
        setPrayerData(prayerJson.data);

        // Extract Islamic events from the response
        const events = [];
        const hijriMonth = prayerJson.data?.date?.hijri?.month?.en;
        const hijriDay = prayerJson.data?.date?.hijri?.day;

        // Check if current month is Ramadan
        if (hijriMonth === 'Ramaḍān') {
          setIsRamadanMonth(true);
          events.push({ name: 'Ramadan', type: 'month', icon: '🌙' });
          if (hijriDay === '27') events.push({ name: 'Laylat al-Qadr (Night of Power)', type: 'special', icon: '✨' });
        } else {
          setIsRamadanMonth(false);
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

      // Fetch Fasting Times from Backend API
      const fastingRes = await fetch(`${API_URL}/prayers/fasting?latitude=${lat}&longitude=${lon}&method=${calculationMethod}`);
      const fastingJson = await fastingRes.json();

      console.log("Fasting API Response:", fastingJson);

      if (fastingJson.status === 'success' && fastingJson.data?.fasting?.length > 0) {
          setFastingData(fastingJson.data);
          console.log("Fasting data set:", fastingJson.data);
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
  }, [selectedMadhab, calculationMethod]);

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

  const fetchRamadanData = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);

    const school = selectedMadhab === 'hanafi' ? 2 : 1;

    try {
      console.log('Fetching Ramadan data from backend...');
      const response = await fetch(
        `${API_URL}/prayers/ramadan?latitude=${lat}&longitude=${lon}&method=${calculationMethod}&school=${school}`
      );
      const data = await response.json();

      console.log('Ramadan API Response:', data);

      if (data.status === 'success' && data.data?.fasting?.length > 0) {
        setRamadanData(data.data);
        setIsRamadanMonth(true);
      } else {
        setError('Unable to fetch Ramadan data.');
        setIsRamadanMonth(false);
      }
    } catch (err) {
      setError('Network error fetching Ramadan data.');
      console.error(err);
      setIsRamadanMonth(false);
    } finally {
      setLoading(false);
    }
  }, [selectedMadhab, calculationMethod]);

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

  // Generate and share Dua image
  const generateAndShareDuaImage = async (ratio: 'story' | 'post', platform: string) => {
    const duaText = ramadanData?.resource?.dua;
    if (!duaText) {
      console.error('❌ No Dua data available');
      return;
    }
    if (!duaImageRef.current) {
      console.error('❌ Dua image ref not available');
      return;
    }

    console.log('🎨 Generating Dua image...', ratio, platform);

    try {
      // Generate image from hidden template
      const canvas = await html2canvas(duaImageRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);

      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('❌ Failed to create blob');
          return;
        }

        console.log('✅ Blob created:', blob.size, 'bytes');

        const file = new File([blob], `hikmahsphere-dua-${Date.now()}.png`, { type: 'image/png' });

        // For WhatsApp - try to share directly using Web Share API
        if (platform === 'whatsapp') {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
            try {
              await (navigator as any).share({
                files: [file],
                title: duaText.title,
                text: `${duaText.title}\n\n${duaText.translation}\n\n🌐 hikmahsphere.site`,
              });
              console.log('✅ Shared via Web Share API');
              return;
            } catch (err) {
              console.log('⚠️ Web Share failed:', err);
            }
          }
          // Fallback: download and open WhatsApp
          console.log('⬇️ Downloading for WhatsApp...');
          downloadImage(canvas, 'hikmahsphere-dua-whatsapp.png');
          setTimeout(() => {
            window.open('https://wa.me/', '_blank');
          }, 1000);
        } else {
          // For Instagram, Facebook, Twitter, or download - just download image
          console.log(`⬇️ Downloading ${ratio} format...`);
          downloadImage(canvas, `hikmahsphere-dua-${ratio}.png`);
        }
      }, 'image/png');
    } catch (error) {
      console.error('❌ Error generating image:', error);
    }
  };

  // Generate and share Hadith image
  const generateAndShareHadithImage = async (ratio: 'story' | 'post', platform: string) => {
    const hadithText = ramadanData?.resource?.hadith;
    if (!hadithText) {
      console.error('❌ No Hadith data available');
      return;
    }
    if (!hadithImageRef.current) {
      console.error('❌ Hadith image ref not available');
      return;
    }

    console.log('🎨 Generating Hadith image...', ratio, platform);

    try {
      const canvas = await html2canvas(hadithImageRef.current, {
        scale: 2,
        backgroundColor: null,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          console.error('❌ Failed to create blob');
          return;
        }

        console.log('✅ Blob created:', blob.size, 'bytes');

        const file = new File([blob], `hikmahsphere-hadith-${Date.now()}.png`, { type: 'image/png' });

        if (platform === 'whatsapp') {
          if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
            try {
              await (navigator as any).share({
                files: [file],
                title: 'Hadith of Ramadan',
                text: `Hadith of Ramadan\n\n${hadithText.english}\n\n📚 ${hadithText.source}\n\n🌐 hikmahsphere.site`,
              });
              console.log('✅ Shared via Web Share API');
              return;
            } catch (err) {
              console.log('⚠️ Web Share failed:', err);
            }
          }
          // Fallback: download and open WhatsApp
          console.log('⬇️ Downloading for WhatsApp...');
          downloadImage(canvas, 'hikmahsphere-hadith-whatsapp.png');
          setTimeout(() => {
            window.open('https://wa.me/', '_blank');
          }, 1000);
        } else {
          // For download or other platforms
          console.log(`⬇️ Downloading ${ratio} format...`);
          downloadImage(canvas, `hikmahsphere-hadith-${ratio}.png`);
        }
      }, 'image/png');
    } catch (error) {
      console.error('❌ Error generating image:', error);
    }
  };

  // Download image helper
  const downloadImage = (canvas: HTMLCanvasElement, filename: string) => {
    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('✅ Image downloaded:', filename);
    } catch (error) {
      console.error('❌ Download failed:', error);
    }
  };

  // Open ratio selection modal
  const openRatioModal = (type: 'dua' | 'hadith', platform: string) => {
    setShareType(type);
    
    // Close the share modal first
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
      shareModal.classList.add('hidden');
    }
    
    // WhatsApp only supports story (9:16) - direct share
    if (platform === 'whatsapp') {
      setSelectedRatio('story');
      setTimeout(() => {
        if (type === 'dua') {
          generateAndShareDuaImage('story', platform);
        } else {
          generateAndShareHadithImage('story', platform);
        }
      }, 300);
    } else {
      // For Instagram, Facebook, Twitter - show ratio selection
      setShowRatioModal(true);
    }
  };

  // Share Dua to social media (updated to show ratio modal)
  const shareDua = (platform: string) => {
    openRatioModal('dua', platform);
  };

  // Share Hadith to social media (updated to show ratio modal)
  const shareHadith = (platform: string) => {
    openRatioModal('hadith', platform);
  };

  // Confirm ratio selection and generate image
  const confirmRatioSelection = () => {
    setShowRatioModal(false);
    setTimeout(() => {
      if (shareType === 'dua') {
        generateAndShareDuaImage(selectedRatio, 'download');
      } else {
        generateAndShareHadithImage(selectedRatio, 'download');
      }
    }, 300);
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
    // Extract city and country from result
    const displayNameParts = result.display_name.split(',').map((s: string) => s.trim());
    const city = displayNameParts[0];
    const country = displayNameParts[displayNameParts.length - 1];
    
    setLocation({
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      city: city,
      country: country
    });
    setCityQuery(city);
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

  // Helper: Parse time string (HH:mm) to Date object for today
  const parsePrayerTime = (timeStr: string, baseDate: Date = new Date()): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const prayerTime = new Date(baseDate);
    prayerTime.setHours(hours, minutes, 0, 0);
    return prayerTime;
  };

  // Helper: Format countdown time
  const formatCountdown = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return 'Now';
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Helper: Calculate current prayer and countdown to next prayer
  const updatePrayerTimes = useCallback(() => {
    if (!prayerData?.times) return;

    const now = new Date();

    const prayerNames = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const prayerTimes = prayerNames.map(name => parsePrayerTime(prayerData.times[name] || '00:00', now));
    
    // Find current and next prayer
    let currentIdx = -1;
    let nextIdx = 0;
    let isNext = false;

    for (let i = 0; i < prayerTimes.length; i++) {
      if (now >= prayerTimes[i]) {
        currentIdx = i;
        nextIdx = (i + 1) % prayerTimes.length;
        isNext = nextIdx === 0; // Next day's Fajr
      }
    }

    // If after Isha, next prayer is Fajr (next day)
    if (currentIdx === prayerTimes.length - 1 || currentIdx === -1) {
      nextIdx = 0;
      isNext = true;
    }

    setCurrentPrayerIndex(currentIdx);
    setNextPrayerIndex(nextIdx);
    setIsNextDay(isNext);

    // Calculate countdown
    let targetTime = isNext 
      ? parsePrayerTime(prayerData.times[prayerNames[0]], new Date(now.getTime() + 86400000)) // Tomorrow
      : parsePrayerTime(prayerData.times[prayerNames[nextIdx]], now);
    
    let diffMs = targetTime.getTime() - now.getTime();
    if (diffMs < 0) diffMs = 0;
    
    const totalSeconds = Math.floor(diffMs / 1000);
    setCountdown({
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    });
  }, [prayerData]);

  // Update timer every second
  useEffect(() => {
    if (!prayerData?.times) return;

    // Initial update
    updatePrayerTimes();

    // Update every second
    const interval = setInterval(updatePrayerTimes, 1000);

    return () => clearInterval(interval);
  }, [prayerData, updatePrayerTimes]);

  // Auto-scroll to current prayer on mobile after data loads
  useEffect(() => {
    // Wait for prayer data and current prayer to be determined
    if (!prayerData?.times || currentPrayerIndex === -1) {
      console.log('Auto-scroll: Waiting for data - prayerData:', !!prayerData?.times, 'currentPrayerIndex:', currentPrayerIndex);
      return;
    }
    
    // Only scroll in daily view
    if (viewMode !== 'daily') {
      console.log('Auto-scroll: Not in daily view - viewMode:', viewMode);
      return;
    }
    
    // Only scroll on mobile devices (screen width < 1024px)
    if (window.innerWidth >= 1024) {
      console.log('Auto-scroll: Desktop detected - width:', window.innerWidth);
      return;
    }
    
    // Prevent multiple scrolls
    if (hasScrolledRef.current) {
      console.log('Auto-scroll: Already scrolled');
      return;
    }

    console.log('Auto-scroll: Scheduling scroll for prayer index:', currentPrayerIndex);

    // Wait for refs to be populated and DOM to render (including images and fonts)
    const scrollTimeout = setTimeout(() => {
      const currentCard = prayerCardRefs.current[currentPrayerIndex];
      
      console.log('Auto-scroll attempt:', {
        currentPrayerIndex,
        hasCard: !!currentCard,
        refsCount: prayerCardRefs.current.filter(Boolean).length,
        allRefs: prayerCardRefs.current.map((ref, i) => ref ? `Card ${i}: OK` : `Card ${i}: null`)
      });

      if (currentCard) {
        // Ensure element is in DOM and visible
        if (!document.contains(currentCard)) {
          console.warn('Card not in DOM');
          return;
        }

        const viewportHeight = window.innerHeight;
        
        // Get the card's position relative to document
        const rect = currentCard.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        
        // Scroll to position current card at about 15% from top of viewport
        // This ensures both current and next prayer cards are visible
        const scrollTop = Math.max(0, absoluteTop - (viewportHeight * 0.15));
        
        console.log('Scrolling to:', scrollTop, 'absoluteTop:', absoluteTop, 'viewport:', viewportHeight, 'rect.top:', rect.top);

        window.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
        
        // Verify scroll happened
        setTimeout(() => {
          console.log('Scroll completed - window.scrollY:', window.scrollY);
        }, 1000);
        
        hasScrolledRef.current = true;
      } else {
        console.warn('Current prayer card ref not found at index:', currentPrayerIndex, 'refs:', prayerCardRefs.current);
      }
    }, 2000);

    return () => clearTimeout(scrollTimeout);
  }, [prayerData, currentPrayerIndex, viewMode]);

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header Section */}
        <div className="max-w-4xl mx-auto text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Prayer Times</h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 sm:p-2.5 rounded-xl hover:bg-gray-100 transition-colors shadow-md"
              title="Settings"
              aria-label="Toggle settings"
            >
              <Cog6ToothIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
            </button>
            {/* Test scroll button - only visible on mobile in development mode */}
            {process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => {
                  hasScrolledRef.current = false;
                  const currentCard = prayerCardRefs.current[currentPrayerIndex];
                  if (currentCard) {
                    const rect = currentCard.getBoundingClientRect();
                    const absoluteTop = window.scrollY + rect.top;
                    const viewportHeight = window.innerHeight;
                    const scrollTop = Math.max(0, absoluteTop - (viewportHeight * 0.15));
                    console.log('Manual scroll to:', scrollTop);
                    window.scrollTo({ top: scrollTop, behavior: 'smooth' });
                  } else {
                    console.log('No card found at index:', currentPrayerIndex);
                  }
                }}
                className="p-2 sm:p-2.5 rounded-xl bg-amber-500 text-white shadow-md block sm:hidden"
                title="Test Scroll"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
            )}
          </div>

          {/* View Mode Toggle - Mobile Optimized */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                viewMode === 'daily'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Daily</span>
              <span className="xs:hidden">Day</span>
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                viewMode === 'monthly'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <CalendarDaysIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
              <span className="hidden xs:inline">Monthly</span>
              <span className="xs:hidden">Month</span>
            </button>
            {isRamadanMonth && (
              <button
                onClick={() => setViewMode('ramadan')}
                className={`flex-1 min-w-[80px] sm:min-w-[100px] px-2 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-xl font-semibold text-xs sm:text-sm md:text-base transition-all duration-300 flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 whitespace-nowrap shadow-md ${
                  viewMode === 'ramadan'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <MoonIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                <span className="hidden xs:inline">Ramadan</span>
                <span className="xs:hidden">Ramadan</span>
              </button>
            )}
          </div>
          
          {/* Settings Panel - Mobile Optimized */}
          {showSettings && (
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 text-left animate-fade-in-down">
              <h3 className="font-semibold text-base sm:text-lg mb-4 flex items-center">
                <Cog6ToothIcon className="h-5 w-5 mr-2" />
                Prayer Calculation Settings
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {/* Calculation Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calculation Method
                  </label>
                  <select
                    value={calculationMethod}
                    onChange={(e) => setCalculationMethod(parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
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

          {/* Islamic Events Display - Mobile Optimized */}
          {islamicEvents.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {islamicEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${
                      event.type === 'holiday'
                        ? 'bg-emerald-600 text-white'
                        : event.type === 'special'
                        ? 'bg-teal-600 text-white'
                        : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {event.icon} <span className="hidden xs:inline">{event.name}</span><span className="xs:hidden">{event.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location and Date Display - Mobile Optimized */}
          <div className="flex flex-col items-center justify-center text-gray-600 mb-3 sm:mb-4">
            <button
                onClick={() => setShowSearch(!showSearch)}
                className="flex items-center hover:text-emerald-600 transition-colors text-sm sm:text-base"
            >
                <MapPinIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2" />
                <span className="truncate max-w-[280px] sm:max-w-full">
                    {location ? `${cityQuery || 'Current Location'}` : 'Select Location'}
                </span>
            </button>

            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-1.5 text-xs sm:text-sm">
                <p className="text-emerald-600 font-medium">
                    {prayerData?.date?.readable}
                </p>
                <span className="text-gray-400">•</span>
                <p className="font-arabic text-gray-700">
                    {fastingData?.fasting?.[0]?.hijri_readable || `${prayerData?.date?.hijri?.day} ${prayerData?.date?.hijri?.month?.en} ${prayerData?.date?.hijri?.year}`}
                </p>

                {/* Current Weather Display next to date */}
                {weatherData && (
                    <span className="text-gray-500 flex items-center">
                         <span className="mx-1.5 hidden sm:inline">|</span>
                         {weatherData.current.temperature_2m}°C
                         <span className="ml-1 hidden sm:inline">({getWeatherStyling(weatherData.current.weather_code, 'Dhuhr').label})</span>
                    </span>
                )}
            </div>
          </div>

          {/* Search Bar - Mobile Optimized */}
          {showSearch && (
            <div className="max-w-md mx-auto mt-4 relative animate-fade-in-down">
                <form onSubmit={handleCitySearch} className="relative">
                <input
                    type="text"
                    placeholder="Enter city name..."
                    className="w-full px-4 py-2.5 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-sm text-sm"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                />
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                <button
                    type="submit"
                    className="absolute right-1 top-1 bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-700 text-sm font-medium"
                >
                    Search
                </button>
                </form>

                {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result: any, idx) => (
                    <button
                        key={idx}
                        onClick={() => selectLocation(result)}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm text-gray-700"
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

        {/* Monthly Calendar View - Mobile Optimized */}
        {viewMode === 'monthly' && monthlyData && (
          <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-emerald-600 text-white px-4 sm:px-6 py-3 sm:py-4">
                <h2 className="text-lg sm:text-2xl font-bold">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Fajr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Sunrise</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Dhuhr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Asr</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Maghrib</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Isha</th>
                      <th className="px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Hijri</th>
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
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {day.date.gregorian.day}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-500">
                            {day.date.gregorian.weekday.en}
                          </td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Fajr}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-500">{day.timings.Sunrise}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Dhuhr}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Asr}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Maghrib}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-900">{day.timings.Isha}</td>
                          <td className="px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap text-sm text-gray-500">
                            {day.date.hijri.day} {day.date.hijri.month.en}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Color Legend - Mobile Optimized */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2.5">Color Legend</p>
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2 sm:gap-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-emerald-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Today</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-indigo-50 mr-2"></div>
                    <span className="text-xs text-gray-600">Ramadan</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-green-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Fitr</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-red-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Eid al-Adha</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-purple-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Arafah</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-blue-100 mr-2"></div>
                    <span className="text-xs text-gray-600">Ashura</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid: Prayer Cards + Calendar */}
        {viewMode === 'daily' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8 max-w-6xl mx-auto">
          {/* Prayer Cards Column */}
          <div className="xl:col-span-3" ref={prayersContainerRef}>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 h-full">
              {prayers.map((prayer, index) => {
                // Get weather for this prayer time
                const weather = getWeatherForTime(prayer.time);
                const weatherStyle = weather ? getWeatherStyling(weather.code, prayer.name) : null;
                const WeatherIcon = weatherStyle?.icon || SunIcon;

                // Determine prayer state
                const isCurrentPrayer = index === currentPrayerIndex;
                const isNextPrayer = index === nextPrayerIndex;
                const isPastPrayer = index < currentPrayerIndex;

                // Calculate total seconds for countdown display
                const totalSeconds = countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
                const countdownDisplay = formatCountdown(totalSeconds);

                return (
                    <div 
                      ref={(el) => { prayerCardRefs.current[index] = el; }}
                      key={prayer.name} 
                      className={`relative rounded-xl shadow-md p-4 sm:p-6 transition-all duration-300 flex flex-col justify-between
                        ${isCurrentPrayer 
                          ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500 shadow-lg scale-[1.02]' 
                          : isPastPrayer
                            ? 'bg-gray-50 border-l-4 border-gray-300 opacity-75'
                            : 'bg-white border-l-4 shadow-md'
                        }
                        ${!isCurrentPrayer && !prayer.isSecondary ? 'border-emerald-500 hover:shadow-lg' : ''}
                        ${!isCurrentPrayer && prayer.isSecondary ? 'border-orange-200' : ''}
                        ${isNextPrayer && !isNextDay ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}
                      `}
                    >
                    {/* Current Prayer Badge */}
                    {isCurrentPrayer && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                          Current Prayer
                        </span>
                      </div>
                    )}

                    {/* Next Prayer Badge with Countdown */}
                    {isNextPrayer && !isCurrentPrayer && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          Next
                        </span>
                      </div>
                    )}

                    <div className={isCurrentPrayer ? 'mt-2' : ''}>
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center flex-1 min-w-0">
                            <prayer.icon className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0 
                              ${isCurrentPrayer 
                                ? 'text-emerald-600 animate-pulse' 
                                : prayer.isSecondary 
                                  ? 'text-orange-400' 
                                  : 'text-emerald-600'
                              }`} 
                            />
                            <div className="min-w-0 flex-1">
                                <h3 className={`text-base sm:text-lg font-semibold truncate
                                  ${isCurrentPrayer ? 'text-emerald-700' : 'text-gray-900'}
                                `}>
                                  {prayer.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-gray-500 truncate">{prayer.description}</p>
                            </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                            <p className={`text-xl sm:text-2xl font-bold 
                              ${isCurrentPrayer 
                                ? 'text-emerald-600' 
                                : prayer.isSecondary 
                                  ? 'text-gray-700' 
                                  : 'text-emerald-600'
                              }`}
                            >
                              {prayer.time}
                            </p>
                            <p className="text-xs sm:text-sm font-arabic text-gray-600">{prayer.arabic}</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Section: Fasting Info & Weather */}
                    <div className="mt-4 flex items-end justify-between border-t border-gray-50 pt-3 min-h-[auto] sm:min-h-[auto]">
                        {/* Left Side: Fasting Info or Countdown */}
                        <div className="flex-1 min-w-0">
                            {isNextPrayer && !isCurrentPrayer ? (
                              // Show countdown for next prayer
                              <div className="flex flex-col gap-1">
                                <div>
                                  <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide">Starts in</span>
                                  <p className="text-sm sm:text-base font-bold text-amber-600 font-mono">
                                    {countdownDisplay}
                                  </p>
                                </div>
                                {/* Also show fasting time for Fajr and Maghrib */}
                                {prayer.name === 'Fajr' && fastingData?.fasting?.[0] && (
                                  <div className="mt-1 pt-1 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-500">Sehri Ends</span>
                                    <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.sahur}</p>
                                  </div>
                                )}
                                {prayer.name === 'Maghrib' && fastingData?.fasting?.[0] && (
                                  <div className="mt-1 pt-1 border-t border-gray-100">
                                    <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                    <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.iftar}</p>
                                  </div>
                                )}
                              </div>
                            ) : prayer.name === 'Fajr' && fastingData?.fasting?.[0] ? (
                                <div className="flex flex-col gap-1">
                                    {isCurrentPrayer ? (
                                      // When Fajr is current, show "Now" above Sehri time
                                      <>
                                        <div>
                                          <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-gray-100">
                                          <span className="text-xs font-medium text-gray-500">Sehri Ends</span>
                                          <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.sahur}</p>
                                        </div>
                                      </>
                                    ) : (
                                      <div>
                                          <span className="text-xs font-medium text-gray-500">Sehri Ends</span>
                                          <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.sahur}</p>
                                      </div>
                                    )}
                                </div>
                            ) : prayer.name === 'Maghrib' && fastingData?.fasting?.[0] ? (
                                <div className="flex flex-col gap-1">
                                    {isCurrentPrayer ? (
                                      // When Maghrib is current, show "Now" above Iftar time
                                      <>
                                        <div>
                                          <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                        </div>
                                        <div className="mt-1 pt-1 border-t border-gray-100">
                                          <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                          <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.iftar}</p>
                                          <span className="text-xs font-medium text-gray-500">Duration</span>
                                          <p className="text-xs font-semibold text-gray-600">{fastingData.fasting[0].time.duration}</p>
                                        </div>
                                      </>
                                    ) : (
                                      <div>
                                          <span className="text-xs font-medium text-gray-500">Iftar Time</span>
                                          <p className="text-sm font-bold text-emerald-600">{fastingData.fasting[0].time.iftar}</p>
                                          <span className="text-xs font-medium text-gray-500">Duration</span>
                                          <p className="text-xs font-semibold text-gray-600">{fastingData.fasting[0].time.duration}</p>
                                      </div>
                                    )}
                                </div>
                            ) : isCurrentPrayer ? (
                              // Show "Prayer Time Now" for other current prayers (Dhuhr, Asr, Isha)
                              <div className="flex flex-col gap-1">
                                <div>
                                  <span className="text-[10px] sm:text-xs font-medium text-emerald-600 uppercase tracking-wide font-bold">● Now</span>
                                  <p className="text-sm font-bold text-emerald-700">Prayer Time</p>
                                </div>
                              </div>
                            ) : null}
                        </div>

                        {/* Right Side: Enhanced Weather Info with Max/Min */}
                        {weather && weatherStyle && (
                            <div className="flex items-center justify-end text-right flex-shrink-0 ml-2">
                                <div className="mr-2 flex flex-col items-end">
                                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{weatherStyle.label}</span>
                                    <div className="flex items-baseline">
                                         <span className="text-lg sm:text-xl font-bold text-gray-700 leading-none mr-1.5 sm:mr-2">{Math.round(weather.temp)}°</span>
                                         <div className="flex flex-col text-[9px] sm:text-[10px] text-gray-400 leading-tight">
                                            {weather.max && <span>H: {Math.round(weather.max)}°</span>}
                                            {weather.min && <span>L: {Math.round(weather.min)}°</span>}
                                         </div>
                                    </div>
                                </div>
                                <div className={`p-1.5 sm:p-2 rounded-full bg-gray-50 ${weatherStyle.color.replace('text-', 'bg-').replace('600', '100').replace('500', '100').replace('400', '100').replace('300', '50')}`}>
                                     <WeatherIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${weatherStyle.color}`} />
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

        {/* Ramadan View - Mobile Optimized */}
        {viewMode === 'ramadan' && ramadanData && (
          <div className="max-w-6xl mx-auto mb-6 sm:mb-8">
            {/* Dua Card - Mobile Optimized */}
            {ramadanData.resource?.dua && (
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl sm:rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-white/10 rounded-full blur-2xl sm:blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-32 sm:w-48 h-32 sm:h-48 bg-white/10 rounded-full blur-2xl sm:blur-3xl"></div>

                <div className="relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        <SparklesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold">{ramadanData?.resource?.dua?.title || 'Daily Dua'}</h3>
                    </div>

                    {/* Share Button */}
                    <button
                      onClick={() => {
                        const shareModal = document.getElementById('share-modal');
                        if (shareModal) {
                            const modalTitle = document.getElementById('share-modal-title');
                            if (modalTitle) modalTitle.textContent = 'Share this Dua';
                            setShareType('dua');
                            shareModal.classList.remove('hidden');
                        }
                      }}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                      title="Share this Dua"
                    >
                      <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      <span className="font-semibold">Share</span>
                    </button>
                  </div>

                  <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4">
                    <p className="text-lg sm:text-2xl font-arabic text-right leading-loose mb-3 sm:mb-4" dir="rtl">
                      {ramadanData.resource.dua.arabic}
                    </p>
                    <p className="text-xs sm:text-sm text-emerald-100 italic mb-2">
                      {ramadanData.resource.dua.transliteration}
                    </p>
                    <p className="text-sm sm:text-base text-white">
                      {ramadanData.resource.dua.translation}
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm text-emerald-200 font-semibold">
                    — {ramadanData.resource.dua.reference}
                  </p>
                </div>
              </div>
            )}

            {/* Ratio Selection Modal - Mobile Optimized */}
            {showRatioModal && (
              <div className="fixed inset-0 z-50 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen px-3 sm:px-4">
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
                    onClick={() => setShowRatioModal(false)}
                  ></div>

                  {/* Modal Content */}
                  <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-md w-full p-4 sm:p-6 md:p-8 z-10 mx-2 sm:mx-0">
                    <button
                      onClick={() => setShowRatioModal(false)}
                      className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Close modal"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
                      Choose Format
                    </h3>

                    <div className="space-y-3 sm:space-y-4">
                      {/* Story Option (9:16) */}
                      <button
                        onClick={() => {
                          setSelectedRatio('story');
                          confirmRatioSelection();
                        }}
                        className={`w-full p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all ${
                          selectedRatio === 'story'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-12 h-20 sm:w-16 sm:h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-xs font-bold">9:16</span>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg font-bold text-gray-900">Story</h4>
                            <p className="text-xs sm:text-sm text-gray-600 hidden xs:block">Perfect for Instagram Stories, Facebook Stories</p>
                            <p className="text-xs sm:text-sm text-gray-600 xs:hidden">For Stories</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">1080 × 1920 px</p>
                          </div>
                        </div>
                      </button>

                      {/* Post Option (4:5) */}
                      <button
                        onClick={() => {
                          setSelectedRatio('post');
                          confirmRatioSelection();
                        }}
                        className={`w-full p-3 sm:p-4 md:p-6 rounded-xl sm:rounded-2xl border-2 transition-all ${
                          selectedRatio === 'post'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-14 h-16 sm:w-20 sm:h-25 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                            <span className="text-white text-xs font-bold">4:5</span>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <h4 className="text-base sm:text-lg font-bold text-gray-900">Feed Post</h4>
                            <p className="text-xs sm:text-sm text-gray-600 hidden xs:block">Ideal for Instagram & Facebook Feed</p>
                            <p className="text-xs sm:text-sm text-gray-600 xs:hidden">For Feed Posts</p>
                            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">1080 × 1350 px</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
                      The image will be downloaded to your device
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Hidden Dua Image Template for Generation */}
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={duaImageRef}
                className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500"
                style={{ width: '1080px', height: selectedRatio === 'story' ? '1920px' : '1350px' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '48px 48px'
                  }}></div>
                </div>
                
                {/* Decorative Orbs */}
                <div className="absolute top-20 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>

                <div className="relative h-full flex flex-col items-center justify-center p-16 text-white">
                  {/* Header - Top Left Logo & Top Right Email */}
                  <div className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-3 shadow-2xl">
                        <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="text-4xl font-bold">HikmahSphere</h2>
                        <p className="text-xl text-emerald-100">Islamic Digital Companion</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">info@hikmahsphere.site</p>
                    </div>
                  </div>

                  {/* Dua Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-12">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>

                    <h1 className="text-5xl font-bold mb-8 max-w-5xl">
                      {ramadanData?.resource?.dua?.title || 'Daily Dua'}
                    </h1>

                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-12 mb-8 max-w-5xl">
                      <p className="text-6xl font-arabic text-right leading-loose mb-8" dir="rtl">
                        {ramadanData?.resource?.dua?.arabic || ''}
                      </p>
                      <p className="text-3xl text-emerald-100 italic mb-6">
                        {ramadanData?.resource?.dua?.transliteration || ''}
                      </p>
                      <p className="text-3xl">
                        {ramadanData?.resource?.dua?.translation || ''}
                      </p>
                    </div>

                    <p className="text-2xl text-emerald-200 font-semibold">
                      — {ramadanData?.resource?.dua?.reference || ''}
                    </p>
                  </div>

                  {/* Footer - Minimal with Centered URL */}
                  <div className="absolute bottom-0 left-0 right-0 p-12 text-center">
                    <p className="text-4xl font-bold">hikmahsphere.site</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Hidden Hadith Image Template for Generation */}
            <div className="fixed -left-[9999px] top-0">
              <div
                ref={hadithImageRef}
                className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-red-500"
                style={{ width: '1080px', height: selectedRatio === 'story' ? '1920px' : '1350px' }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                    backgroundSize: '48px 48px'
                  }}></div>
                </div>
                
                {/* Decorative Orbs */}
                <div className="absolute top-20 right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>

                <div className="relative h-full flex flex-col items-center justify-center p-16 text-white">
                  {/* Header - Top Left Logo & Top Right Email */}
                  <div className="absolute top-0 left-0 right-0 p-12 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center p-3 shadow-2xl">
                        <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h2 className="text-4xl font-bold">HikmahSphere</h2>
                        <p className="text-xl text-amber-100">Islamic Digital Companion</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">info@hikmahsphere.site</p>
                    </div>
                  </div>

                  {/* Hadith Content */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <div className="w-32 h-32 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-12">
                      <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.076 0-2.104.222-3.043.621.99.17 1.94.454 2.847.844zm10.703-3.317C13.767.602 11.94 0 10 0c-1.94 0-3.767.602-5.203 1.487L5.5 4.804c.908-.39 1.857-.674 2.847-.843A7.968 7.968 0 0110 4c1.076 0 2.104.222 3.043.621zM10 6a3 3 0 100 6 3 3 0 000-6zm-5 3a5 5 0 1110 0 5 5 0 01-10 0zm-3.5 0a8.5 8.5 0 1117 0 8.5 8.5 0 01-17 0z" />
                      </svg>
                    </div>

                    <h1 className="text-5xl font-bold mb-8">Hadith of Ramadan</h1>

                    <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-12 mb-8 max-w-5xl">
                      <p className="text-6xl font-arabic text-right leading-loose mb-8 text-right" dir="rtl">
                        {ramadanData?.resource?.hadith?.arabic || ''}
                      </p>
                      <p className="text-3xl mb-8">
                        {ramadanData?.resource?.hadith?.english || ''}
                      </p>
                    </div>

                    <div className="flex gap-8 text-2xl">
                      <p className="text-amber-100">
                        📚 {ramadanData?.resource?.hadith?.source || ''}
                      </p>
                      <p className="text-amber-100">
                        🏷️ {ramadanData?.resource?.hadith?.grade || ''}
                      </p>
                    </div>
                  </div>

                  {/* Footer - Minimal with Centered URL */}
                  <div className="absolute bottom-0 left-0 right-0 p-12 text-center">
                    <p className="text-4xl font-bold">hikmahsphere.site</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Share Modal */}
            <div id="share-modal" className="hidden fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
                  onClick={() => {
                    const modal = document.getElementById('share-modal');
                    if (modal) modal.classList.add('hidden');
                  }}
                ></div>

                {/* Modal Content - Mobile Optimized */}
                <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full p-4 sm:p-6 md:p-8 transform transition-all mx-2 sm:mx-0">
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      const modal = document.getElementById('share-modal');
                      if (modal) modal.classList.add('hidden');
                    }}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 p-1"
                    aria-label="Close modal"
                  >
                    <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Share Template Card */}
                  <div className={`bg-gradient-to-br rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white mb-4 sm:mb-6 relative overflow-hidden ${
                    shareType === 'hadith'
                      ? 'from-amber-500 via-orange-500 to-red-500'
                      : 'from-emerald-500 via-teal-500 to-cyan-500'
                  }`}>
                    {/* Background Decoration */}
                    <div className="absolute top-0 right-0 w-32 sm:w-48 h-32 sm:h-48 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 sm:w-32 h-24 sm:h-32 bg-white/10 rounded-full blur-2xl"></div>

                    <div className="relative">
                      {/* Header with Logo */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2 shadow-lg flex-shrink-0">
                            <img src="/logo.png" alt="HikmahSphere" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <h3 className="text-lg sm:text-2xl font-bold">HikmahSphere</h3>
                            <p className={`${shareType === 'hadith' ? 'text-amber-100' : 'text-emerald-100'} text-xs sm:text-sm`}>
                              Your Islamic Digital Companion
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className={`text-xs sm:text-sm ${shareType === 'hadith' ? 'text-amber-100' : 'text-emerald-100'}`}>Contact</p>
                          <p className="text-sm sm:text-lg font-semibold">info@hikmahsphere.site</p>
                        </div>
                      </div>

                      {/* Content Section (Dua or Hadith) */}
                      {shareType === 'hadith' ? (
                        // Hadith Layout
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                            <BookOpenIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                            <h4 className="text-sm sm:text-lg font-bold">Hadith of Ramadan</h4>
                          </div>
                          <p className="text-lg sm:text-3xl font-arabic text-right leading-loose mb-2 sm:mb-4" dir="rtl">
                            {ramadanData?.resource?.hadith?.arabic || ''}
                          </p>
                          <p className="text-xs sm:text-base">
                            {ramadanData?.resource?.hadith?.english || ''}
                          </p>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mt-3 sm:mt-4">
                            <p className="text-xs sm:text-sm text-amber-200 font-semibold">
                              — {ramadanData?.resource?.hadith?.source || ''}
                            </p>
                            <span className="text-[10px] sm:text-xs bg-white/20 px-2 py-0.5 sm:py-1 rounded-full">
                              {ramadanData?.resource?.hadith?.grade || ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        // Dua Layout
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                            <SparklesIcon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                            <h4 className="text-sm sm:text-lg font-bold">{ramadanData?.resource?.dua?.title || 'Daily Dua'}</h4>
                          </div>
                          <p className="text-lg sm:text-3xl font-arabic text-right leading-loose mb-2 sm:mb-4" dir="rtl">
                            {ramadanData?.resource?.dua?.arabic || ''}
                          </p>
                          <p className="text-xs sm:text-sm text-emerald-100 italic mb-1.5 sm:mb-2">
                            {ramadanData?.resource?.dua?.transliteration || ''}
                          </p>
                          <p className="text-xs sm:text-base">
                            {ramadanData?.resource?.dua?.translation || ''}
                          </p>
                          <p className="text-xs sm:text-sm text-emerald-200 font-semibold mt-2 sm:mt-4">
                            — {ramadanData?.resource?.dua?.reference || ''}
                          </p>
                        </div>
                      )}

                      {/* Invitation */}
                      {/* <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-4">
                        <div className="flex flex-wrap gap-3 text-sm">
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">🕌</span> Prayer Times
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">📖</span> Quran Reader
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">💰</span> Zakat Calculator
                          </span>
                          <span className="flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full">
                            <span className="text-lg">🌍</span> Global Community
                          </span>
                        </div>
                      </div> */}

                      {/* Website & Contact */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                        <a 
                          href="https://hikmahsphere.site" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
                        >
                          <GlobeAltIcon className="w-5 h-5" />
                          <span className="font-semibold">hikmahsphere.site</span>
                        </a>
                        <a 
                          href="mailto:info@hikmahsphere.site" 
                          className="flex items-center gap-2 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="font-semibold">info@hikmahsphere.site</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Social Share Buttons - Mobile Optimized */}
                  <div className="text-center mb-4">
                    <h4 id="share-modal-title" className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">
                      Share this {shareType === 'hadith' ? 'Hadith' : 'Dua'}
                    </h4>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('whatsapp');
                          } else {
                            shareDua('whatsapp');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                        <span className="hidden xs:inline">WhatsApp</span><span className="xs:hidden">Share</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('twitter');
                          } else {
                            shareDua('twitter');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span className="hidden xs:inline">Twitter</span><span className="xs:hidden">Tweet</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('facebook');
                          } else {
                            shareDua('facebook');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        <span className="hidden xs:inline">Facebook</span><span className="xs:hidden">Share</span>
                      </button>
                      <button
                        onClick={() => {
                          if (shareType === 'hadith') {
                            shareHadith('instagram');
                          } else {
                            shareDua('instagram');
                          }
                        }}
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 transition-all transform hover:scale-105 shadow-lg text-xs sm:text-sm"
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        <span className="hidden xs:inline">Instagram</span><span className="xs:hidden">Share</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-center text-xs sm:text-sm text-gray-500">
                    Click on a platform to share this beautiful {shareType === 'hadith' ? 'Hadith' : 'Dua'} with your friends and family
                  </p>
                </div>
              </div>
            </div>

            {/* Ramadan Timetable - Card Grid - Mobile Optimized */}
            <div className="mb-6">
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl sm:rounded-3xl shadow-xl px-4 sm:px-6 md:px-8 py-4 sm:py-6 mb-4 sm:mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <MoonIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-3xl font-bold text-white">Ramadan {ramadanData.ramadan_year}</h2>
                      <p className="text-xs sm:text-sm text-emerald-100">Complete 30-Day Fasting Schedule</p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right text-white">
                    <p className="text-xs sm:text-sm text-emerald-100">White Days</p>
                    <p className="text-sm sm:text-lg font-semibold">
                      {ramadanData.white_days?.days?.['13th'] ? new Date(ramadanData.white_days.days['13th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '13th'} •
                      {ramadanData.white_days?.days?.['14th'] ? new Date(ramadanData.white_days.days['14th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '14th'} •
                      {ramadanData.white_days?.days?.['15th'] ? new Date(ramadanData.white_days.days['15th']).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '15th'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {ramadanData.fasting.map((day: any, idx: number) => {
                  const isToday = new Date(day.date).toDateString() === new Date().toDateString();
                  const dayNumber = parseInt(day.hijri.split('-')[2]);
                  const dateObj = new Date(day.date);

                  return (
                    <div
                      key={idx}
                      className={`bg-white rounded-xl sm:rounded-2xl shadow-md sm:shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border-2 ${
                        isToday
                          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50'
                          : 'border-gray-100'
                      }`}
                    >
                      {/* Day Number Badge */}
                      <div className={`px-3 sm:px-4 py-2.5 sm:py-3 ${
                        isToday
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                          : dayNumber <= 10
                            ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                            : dayNumber <= 20
                              ? 'bg-gradient-to-r from-teal-400 to-teal-500'
                              : 'bg-gradient-to-r from-cyan-400 to-cyan-500'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl sm:text-3xl font-bold text-white">Day {dayNumber}</span>
                          {isToday && (
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/20 backdrop-blur-sm rounded-md sm:rounded-lg text-xs font-semibold text-white">
                              Today
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-3 sm:p-4">
                        {/* Day Name */}
                        <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">{day.day}</p>

                        {/* Gregorian Date */}
                        <p className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                          {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>

                        {/* Hijri Date */}
                        <p className="text-xs sm:text-sm font-arabic text-emerald-600 mb-3 sm:mb-4" dir="rtl">
                          {day.hijri_readable}
                        </p>

                        {/* Times Grid */}
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-2.5 sm:mb-3">
                          <div className="bg-orange-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                            <p className="text-[10px] sm:text-xs text-orange-600 font-medium mb-0.5 sm:mb-1">Sehri Ends</p>
                            <p className="text-base sm:text-lg font-bold text-orange-700">{day.time.sahur}</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                            <p className="text-[10px] sm:text-xs text-emerald-600 font-medium mb-0.5 sm:mb-1">Iftar</p>
                            <p className="text-base sm:text-lg font-bold text-emerald-700">{day.time.iftar}</p>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="bg-gray-50 rounded-lg sm:rounded-xl p-1.5 sm:p-2 text-center">
                          <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Duration</p>
                          <p className="text-xs sm:text-sm font-bold text-gray-700">{day.time.duration}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hadith Card - Mobile Optimized */}
            {ramadanData.resource?.hadith && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 md:p-8 border-l-4 border-amber-500">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Hadith of Ramadan</h3>
                  </div>

                  {/* Share Button */}
                  <button
                    onClick={() => {
                      const shareModal = document.getElementById('share-modal');
                      if (shareModal) {
                        const modalTitle = document.getElementById('share-modal-title');
                        if (modalTitle) modalTitle.textContent = 'Share this Hadith';
                        setShareType('hadith');
                        shareModal.classList.remove('hidden');
                      }
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                    title="Share this Hadith"
                  >
                    <ShareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="font-semibold">Share</span>
                  </button>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4">
                  <p className="text-base sm:text-xl font-arabic text-right leading-loose mb-3 sm:mb-4 text-gray-800" dir="rtl">
                    {ramadanData.resource.hadith.arabic}
                  </p>
                  <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                    {ramadanData.resource.hadith.english}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <p className="text-sm font-semibold text-amber-700">
                    — {ramadanData.resource.hadith.source}
                  </p>
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 px-3 py-1 rounded-full">
                    {ramadanData.resource.hadith.grade}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Qibla & Info Section - Mobile Optimized */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 md:col-span-1">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <GlobeAltIcon className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600 mr-2" />
                    Qibla Direction
                </h2>
                <div className="flex flex-col items-center justify-center py-3 sm:py-4">
                    <div className="text-3xl sm:text-4xl font-bold text-teal-600 mb-1">
                        {Math.round(prayerData?.qibla?.direction?.degrees || 0)}°
                    </div>
                    <p className="text-gray-500 text-xs sm:text-sm">From North</p>
                    <p className="text-gray-600 mt-2 font-medium text-xs sm:text-sm">
                        Distance: {Math.round(prayerData?.qibla?.distance?.value || 0).toLocaleString()} km
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 md:col-span-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <MoonIcon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 mr-2" />
                  {currentReminder?.title || 'Daily Reminder'}
                </h2>
                {currentReminder ? (
                  <div className="space-y-2.5 sm:space-y-3">
                    {/* Arabic Text */}
                    <div className="text-center py-2 sm:py-2.5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg">
                      <p className="text-lg sm:text-xl md:text-2xl font-arabic leading-relaxed text-gray-800 px-2 sm:px-4" dir="rtl">
                        {currentReminder.arabic}
                      </p>
                    </div>

                    {/* Transliteration & Translation in two columns on larger screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="text-center lg:text-left lg:border-r lg:border-gray-100 lg:pr-3">
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-1">Transliteration</p>
                        <p className="text-xs sm:text-sm italic text-gray-600 leading-relaxed">
                          "{currentReminder.transliteration}"
                        </p>
                      </div>

                      <div className="text-center lg:text-left">
                        <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide mb-1">Translation</p>
                        <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
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
                    <p className="text-base sm:text-lg font-arabic text-gray-700 mb-2 px-2" dir="rtl">
                      "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا"
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 italic px-2">
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
