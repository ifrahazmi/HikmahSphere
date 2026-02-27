import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import redisClient from '../config/redis';

const router = express.Router();

// Configuration - Using Aladhan API (free, no Cloudflare protection)
const API_BASE_URL = 'https://api.aladhan.com/v1/timings';
const TIMINGS_BY_CITY_URL = 'https://api.aladhan.com/v1/timingsByCity';
const CALENDAR_API_URL = 'https://api.aladhan.com/v1/calendar';

// Cache TTL configuration (in seconds)
const CACHE_TTL = {
  PRAYER_TIMES: parseInt(process.env.PRAYER_TIMES_CACHE_TTL || '15') * 60,
  FASTING_TIMES: parseInt(process.env.FASTING_TIMES_CACHE_TTL || '15') * 60,
  RAMADAN_TIMES: parseInt(process.env.RAMADAN_TIMES_CACHE_TTL || '60') * 60,
  WEATHER: parseInt(process.env.WEATHER_CACHE_TTL || '30') * 60,
};

// Mecca/Kaaba coordinates
const MECCA_LAT = 21.4225;
const MECCA_LON = 39.8262;

// Helper function to get compass direction
function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index] || 'N';
}

// Helper function to calculate distance to Mecca using Haversine formula
function calculateDistanceToMecca(lat: number, lon: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (MECCA_LAT - lat) * Math.PI / 180;
  const dLon = (MECCA_LON - lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(MECCA_LAT * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Helper function to calculate Qibla direction (bearing to Mecca)
function calculateQiblaDirection(lat: number, lon: number): number {
  const lat1 = lat * Math.PI / 180;
  const lat2 = MECCA_LAT * Math.PI / 180;
  const dLon = (MECCA_LON - lon) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  return (bearing + 360) % 360;
}

/**
 * @route   GET /api/prayers/times
 * @desc    Get prayer times using external Islamic API
 * @access  Public
 */
router.get('/times', [
  query('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude required (-90 to 90)'),
  query('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude required (-180 to 180)'),
  query('method')
    .optional()
    .isInt()
    .withMessage('Method must be an integer'),
  query('school')
    .optional()
    .isInt()
    .withMessage('School must be an integer (1=Shafi, 2=Hanafi)'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      latitude,
      longitude,
      method = '3', // Default: Muslim World League
      school = '1'  // Default: Shafi
    } = req.query as {
      latitude: string;
      longitude: string;
      method?: string;
      school?: string;
    };

    // Generate cache key based on parameters
    const cacheKey = `prayer_times:${latitude}:${longitude}:${method}:${school}`;

    try {
      // Try to get from cache first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for prayer times (${latitude}, ${longitude})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
      // Continue to fetch from API if cache fails
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${school === '2' ? '1' : '0'}`;

    // 🕌 Aladhan API Call Debug Logging
    console.log('🕌 ========== ALADHAN API CALL ==========');
    console.log(`📍 Location: ${latitude}, ${longitude}`);
    console.log(`⚙️  Settings: method=${method}, school=${school === '2' ? '1' : '0'} (${school === '2' ? 'Hanafi' : 'Shafi'})`);
    console.log(`🔗 API URL: ${apiUrl}`);
    console.log('⏳ Fetching from Aladhan API...');

    const apiResponse = await fetch(apiUrl);

    console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`📦 Response OK: ${apiResponse.ok}`);

    if (!apiResponse.ok) {
        throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData: any = await apiResponse.json();

    console.log('✅ Prayer API Response received successfully');
    console.log(`📊 Response Code: ${apiData.code}`);
    console.log(`📊 Response Status: ${apiData.status}`);
    if (apiData.data) {
        console.log(`📅 Date: ${apiData.data.date?.readable}`);
        console.log(`🕐 Fajr: ${apiData.data.timings?.Fajr}`);
        console.log(`🌅 Sunrise: ${apiData.data.timings?.Sunrise}`);
        console.log(`☀️  Dhuhr: ${apiData.data.timings?.Dhuhr}`);
        console.log(`🌤️  Asr: ${apiData.data.timings?.Asr}`);
        console.log(`🌇 Maghrib: ${apiData.data.timings?.Maghrib}`);
        console.log(`🌙 Isha: ${apiData.data.timings?.Isha}`);
        console.log(`🕋 Qibla Direction: ${calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude)).toFixed(2)}°`);
        console.log(`📏 Distance to Mecca: ${calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude)).toFixed(2)} km`);
    }
    console.log('🕌 ======================================');

    if (apiData.code === 200 && apiData.data) {
        const data = apiData.data;
        const qiblaDegrees = calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude));
        const distanceToMecca = calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude));

        const responseData = {
            status: 'success',
            data: {
                times: {
                    Fajr: data.timings.Fajr,
                    Sunrise: data.timings.Sunrise,
                    Dhuhr: data.timings.Dhuhr,
                    Asr: data.timings.Asr,
                    Maghrib: data.timings.Maghrib,
                    Isha: data.timings.Isha,
                    Midnight: data.timings.Midnight,
                    Imsak: data.timings.Imsak
                },
                date: {
                    readable: data.date.readable,
                    timestamp: data.date.timestamp,
                    gregorian: data.date.gregorian,
                    hijri: data.date.hijri
                },
                qibla: {
                    direction: {
                        degrees: qiblaDegrees
                    },
                    distance: {
                        value: distanceToMecca
                    }
                },
                meta: data.meta,
                location: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                },
                settings: { method, school }
            }
        };

        // Store in cache
        try {
          await redisClient.setEx(cacheKey, CACHE_TTL.PRAYER_TIMES, JSON.stringify(responseData));
          console.log(`💾 Cached prayer times for ${CACHE_TTL.PRAYER_TIMES / 60} minutes`);
        } catch (cacheError) {
          console.warn('⚠️ Redis cache write error:', cacheError);
        }

        return res.json(responseData);
    } else {
        throw new Error('Invalid response from Aladhan API');
    }

  } catch (error: any) {
    console.error('Prayer times API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prayer times',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/prayers/timesByCity
 * @desc    Get prayer times by city name using Aladhan API
 * @access  Public
 */
router.get('/timesByCity', [
  query('city')
    .notEmpty()
    .withMessage('City name is required'),
  query('country')
    .notEmpty()
    .withMessage('Country name is required'),
  query('method')
    .optional()
    .isInt()
    .withMessage('Method must be an integer'),
  query('school')
    .optional()
    .isInt()
    .withMessage('School must be an integer'),
], optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      city,
      country,
      method = '3', // Default: Muslim World League
      school = '1', // Default: Shafi
      latitudeAdjustmentMethod = '3' // Default: Angle Based
    } = req.query as {
      city: string;
      country: string;
      method?: string;
      school?: string;
      latitudeAdjustmentMethod?: string;
    };

    // Generate cache key
    const cacheKey = `prayer_times_city:${city}:${country}:${method}:${school}`;

    try {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`✅ Cache hit for city prayer times (${city}, ${country})`);
        return res.json(JSON.parse(cachedData));
      }
    } catch (cacheError) {
      console.warn('⚠️ Redis cache read error:', cacheError);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const dateStr = `${new Date().getDate()}-${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
    const apiUrl = `${TIMINGS_BY_CITY_URL}/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=${method}&school=${school === '2' ? '1' : '0'}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`;

    // 🕌 Aladhan API Call Debug Logging
    console.log('🕌 ========== ALADHAN CITY API CALL ==========');
    console.log(`🏙️  City: ${city}, ${country}`);
    console.log(`⚙️  Settings: method=${method}, school=${school === '2' ? '1' : '0'} (${school === '2' ? 'Hanafi' : 'Shafi'})`);
    console.log(`🔗 API URL: ${apiUrl}`);
    console.log('⏳ Fetching from Aladhan API...');

    const apiResponse = await fetch(apiUrl);

    console.log(`📥 API Response Status: ${apiResponse.status} ${apiResponse.statusText}`);
    console.log(`📦 Response OK: ${apiResponse.ok}`);

    if (!apiResponse.ok) {
      throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData: any = await apiResponse.json();

    console.log('✅ City Prayer API Response received successfully');
    console.log(`📊 Response Code: ${apiData.code}`);
    console.log(`📊 Response Status: ${apiData.status}`);
    if (apiData.data) {
      console.log(`📅 Date: ${apiData.data.date?.readable}`);
      console.log(`🕐 Fajr: ${apiData.data.timings?.Fajr}`);
      console.log(`🌅 Sunrise: ${apiData.data.timings?.Sunrise}`);
      console.log(`☀️  Dhuhr: ${apiData.data.timings?.Dhuhr}`);
      console.log(`🌤️  Asr: ${apiData.data.timings?.Asr}`);
      console.log(`🌇 Maghrib: ${apiData.data.timings?.Maghrib}`);
      console.log(`🌙 Isha: ${apiData.data.timings?.Isha}`);
    }
    console.log('🕌 ======================================');

    if (apiData.code === 200 && apiData.data) {
      const data = apiData.data;
      const responseData = {
        status: 'success',
        data: {
          times: {
            Fajr: data.timings.Fajr,
            Sunrise: data.timings.Sunrise,
            Dhuhr: data.timings.Dhuhr,
            Asr: data.timings.Asr,
            Maghrib: data.timings.Maghrib,
            Isha: data.timings.Isha,
            Midnight: data.timings.Midnight,
            Imsak: data.timings.Imsak || data.timings.Fajr
          },
          date: data.date,
          meta: data.meta
        }
      };

      // Store in cache
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL.PRAYER_TIMES, JSON.stringify(responseData));
        console.log(`💾 Cached city prayer times for ${CACHE_TTL.PRAYER_TIMES / 60} minutes`);
      } catch (cacheError) {
        console.warn('⚠️ Redis cache write error:', cacheError);
      }

      return res.json(responseData);
    } else {
      throw new Error('Invalid response from Aladhan API');
    }

  } catch (error: any) {
    console.error('City prayer times API error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prayer times by city',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/prayers/fasting
 * @desc    Get fasting times (Sahur/Iftar) from Islamic API
 * @access  Public
 */
router.get('/fasting', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('method').optional().isInt(),
], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { latitude, longitude, method = '3' } = req.query as any;
        let islamicApiKey = process.env.ISLAMIC_API_KEY;

        // Ensure API Key is trimmed and clean
        if (islamicApiKey) {
            islamicApiKey = islamicApiKey.trim();
        }

        // Debug API Key
        if (!islamicApiKey) {
            console.error('❌ ISLAMIC_API_KEY is not defined in environment variables!');
        } else {
            console.log(`🔑 ISLAMIC_API_KEY loaded: ${islamicApiKey.substring(0, 5)}... (Length: ${islamicApiKey.length})`);
        }

        // Generate cache key
        const cacheKey = `fasting_times:${latitude}:${longitude}:${method}`;

        // Try to get from cache first
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            console.log(`✅ Cache hit for fasting times (${latitude}, ${longitude})`);
            return res.json(JSON.parse(cachedData));
          }
        } catch (cacheError) {
          console.warn('⚠️ Redis cache read error:', cacheError);
        }

        console.log('Fetching fasting times from Islamic API');

        // Use Islamic API for fasting times
        const apiUrl = `https://islamicapi.com/api/v1/fasting/?lat=${latitude}&lon=${longitude}&method=${method}&api_key=${islamicApiKey}`;

        // Add headers to mimic a browser/curl request to avoid 403 blocks
        const headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; HikmahSphere/1.0; +https://hikmahsphere.site)',
            'Accept': 'application/json'
        };

        const response = await fetch(apiUrl, { headers });
        
        // Handle 403 and other API errors gracefully
        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ Islamic API returned ${response.status}: ${errorText}`);
            console.warn('Using fallback calculation...');
            
            // Determine reason for failure
            let failureReason = `Islamic API error: ${response.status}`;
            if (!islamicApiKey) failureReason = 'API Key missing';
            else if (response.status === 403) failureReason = 'API Key invalid/expired';

            // Fallback: Calculate fasting times from prayer times
            const prayerTimesUrl = `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=${method}`;
            console.log(`Fetching fallback fasting from: ${prayerTimesUrl}`);
            const prayerResponse = await fetch(prayerTimesUrl);
            
            if (!prayerResponse.ok) {
                console.error(`Fallback Prayer API failed: ${prayerResponse.status}`);
                throw new Error('Both Islamic API and Aladhan API failed');
            }
            
            const prayerData: any = await prayerResponse.json();
            
            if (prayerData.code === 200 && prayerData.data?.timings) {
                const { Fajr, Maghrib } = prayerData.data.timings;

                // Calculate Sahur time (before Fajr)
                const fajrTime = Fajr;
                const sahurHour = parseInt(Fajr.split(':')[0]) - 1;
                const sahurMinute = parseInt(Fajr.split(':')[1]);
                const sahurTime = `${sahurHour.toString().padStart(2, '0')}:${sahurMinute.toString().padStart(2, '0')}`;

                // Iftar is at Maghrib
                const iftarTime = Maghrib;
                
                // Calculate duration between Fajr and Maghrib
                const fajrParts = Fajr.split(':').map(Number);
                const maghribParts = Maghrib.split(':').map(Number);
                const fajrMinutes = fajrParts[0] * 60 + fajrParts[1];
                const maghribMinutes = maghribParts[0] * 60 + maghribParts[1];
                const durationMinutes = maghribMinutes - fajrMinutes;
                const durationHours = Math.floor(durationMinutes / 60);
                const durationMins = durationMinutes % 60;
                const duration = `${durationHours}h ${durationMins}m`;

                const responseData = {
                    status: 'success',
                    data: {
                        fasting: [{
                            time: {
                                sahur: sahurTime,
                                iftar: iftarTime,
                                duration: duration
                            },
                            fajr: fajrTime,
                            maghrib: iftarTime
                        }],
                        white_days: [],
                        note: `Calculated from prayer times (${failureReason})`
                    }
                };

                return res.json(responseData);
            }
            
            throw new Error(`Islamic API error: ${response.status}`);
        }

        const apiData: any = await response.json();

        console.log('Islamic Fasting API Response received successfully:', apiData);

        if (apiData.status === 'success' && apiData.data?.fasting?.length > 0) {
            const responseData = {
                status: 'success',
                data: {
                    fasting: apiData.data.fasting,
                    white_days: apiData.data.white_days
                }
            };

            // Store in cache
            try {
              await redisClient.setEx(cacheKey, CACHE_TTL.FASTING_TIMES, JSON.stringify(responseData));
              console.log(`💾 Cached fasting times for ${CACHE_TTL.FASTING_TIMES / 60} minutes`);
            } catch (cacheError) {
              console.warn('⚠️ Redis cache write error:', cacheError);
            }

            return res.json(responseData);
        } else {
            throw new Error('Invalid response from Islamic API');
        }
    } catch (error: any) {
        console.error('Fasting API error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch fasting times',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/prayers/ramadan
 * @desc    Get complete Ramadan fasting times (30 days)
 * @access  Public
 */
router.get('/ramadan', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
  query('method').optional().isInt(),
], async (req: Request, res: Response) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { latitude, longitude, method = '3' } = req.query as any;
        let islamicApiKey = process.env.ISLAMIC_API_KEY;

        // Ensure API Key is trimmed
        if (islamicApiKey) {
            islamicApiKey = islamicApiKey.trim();
        }

        // Debug API Key
        if (!islamicApiKey) {
            console.error('❌ ISLAMIC_API_KEY is not defined in environment variables!');
        } else {
            console.log(`🔑 ISLAMIC_API_KEY loaded: ${islamicApiKey.substring(0, 5)}... (Length: ${islamicApiKey.length})`);
        }

        // Generate cache key
        const cacheKey = `ramadan_times:${latitude}:${longitude}:${method}`;

        // Try to get from cache first
        try {
          const cachedData = await redisClient.get(cacheKey);
          if (cachedData) {
            console.log(`✅ Cache hit for Ramadan times (${latitude}, ${longitude})`);
            return res.json(JSON.parse(cachedData));
          }
        } catch (cacheError) {
          console.warn('⚠️ Redis cache read error:', cacheError);
        }

        console.log('Fetching Ramadan times from Islamic API');

        // Use Islamic API for Ramadan times
        const apiUrl = `https://islamicapi.com/api/v1/ramadan/?lat=${latitude}&lon=${longitude}&method=${method}&api_key=${islamicApiKey}`;

        // Add headers to mimic a browser/curl request
        const headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; HikmahSphere/1.0; +https://hikmahsphere.site)',
            'Accept': 'application/json'
        };

        const response = await fetch(apiUrl, { headers });
        
        // Handle 403 and other API errors gracefully
        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`⚠️ Islamic API returned ${response.status}: ${errorText}`);
            console.warn('Using fallback calculation...');

            // Determine reason for failure
            let failureReason = `Islamic API error: ${response.status}`;
            if (!islamicApiKey) failureReason = 'API Key missing';
            else if (response.status === 403) failureReason = 'API Key invalid/expired';

            // Fallback: Calculate Ramadan fasting times from prayer times calendar
            // Use Hijri Calendar API to get Ramadan (Month 9)
            const currentYear = new Date().getFullYear();
            
            // Assume 2026 Ramadan is in 1447, 2025 is 1446
            // We'll try to guess based on year.
            let hijriYear = 1447; // Default target
            if (currentYear === 2025) hijriYear = 1446;
            if (currentYear === 2024) hijriYear = 1445;
            
            // For robustness, try current year first, if it fails, try next.
            // Aladhan API: /v1/hijriCalendar/:month/:year
            const calendarUrl = `https://api.aladhan.com/v1/hijriCalendar/9/${hijriYear}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
            console.log(`Fetching fallback Ramadan calendar from: ${calendarUrl}`);
            
            const calendarResponse = await fetch(calendarUrl);

            if (!calendarResponse.ok) {
                console.error(`Fallback Aladhan API failed: ${calendarResponse.status}`);
                throw new Error('Both Islamic API and Aladhan API failed');
            }

            const calendarData: any = await calendarResponse.json();

            if (calendarData.code === 200 && Array.isArray(calendarData.data) && calendarData.data.length > 0) {
                const fastingTimes = calendarData.data.map((day: any) => {
                    const fajrTime = day.timings.Fajr;
                    const maghribTime = day.timings.Maghrib;

                    // Calculate Sahur time (1 hour before Fajr)
                    const sahurHour = parseInt(fajrTime.split(':')[0]) - 1;
                    const sahurMinute = parseInt(fajrTime.split(':')[1]);
                    const sahurTime = `${sahurHour.toString().padStart(2, '0')}:${sahurMinute.toString().padStart(2, '0')}`;

                    // Calculate duration
                    const fajrParts = fajrTime.split(':').map(Number);
                    const maghribParts = maghribTime.split(':').map(Number);
                    const fajrMinutes = fajrParts[0] * 60 + fajrParts[1];
                    const maghribMinutes = maghribParts[0] * 60 + maghribParts[1];
                    const durationMinutes = maghribMinutes - fajrMinutes;
                    const durationHours = Math.floor(durationMinutes / 60);
                    const durationMins = durationMinutes % 60;
                    const duration = `${durationHours}h ${durationMins}m`;

                    return {
                        time: {
                            sahur: sahurTime,
                            iftar: maghribTime,
                            duration: duration
                        },
                        fajr: fajrTime,
                        maghrib: maghribTime,
                        date: day.date.readable,
                        day: day.date.gregorian.weekday.en,
                        hijri_readable: `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`
                    };
                });

                const responseData = {
                    status: 'success',
                    data: {
                        ramadan_year: hijriYear,
                        fasting: fastingTimes,
                        white_days: [],
                        resource: 'Aladhan Calendar API (Fallback)',
                        note: `Calculated from prayer times (${failureReason})`
                    }
                };

                return res.json(responseData);
            }

            throw new Error(`Islamic API error: ${response.status}`);
        }

        const apiData: any = await response.json();

        console.log('Islamic Ramadan API Response received successfully:', apiData);

        if (apiData.status === 'success' && apiData.data?.fasting?.length > 0) {
            const responseData = {
                status: 'success',
                data: {
                    ramadan_year: apiData.ramadan_year,
                    fasting: apiData.data.fasting,
                    white_days: apiData.data.white_days,
                    resource: apiData.resource
                }
            };

            // Store in cache
            try {
              await redisClient.setEx(cacheKey, CACHE_TTL.RAMADAN_TIMES, JSON.stringify(responseData));
              console.log(`💾 Cached Ramadan times for ${CACHE_TTL.RAMADAN_TIMES / 60} minutes`);
            } catch (cacheError) {
              console.warn('⚠️ Redis cache write error:', cacheError);
            }

            return res.json(responseData);
        } else {
            throw new Error('Invalid response from Islamic API');
        }
    } catch (error: any) {
        console.error('Ramadan API error:', error.message);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Ramadan times',
            details: error.message
        });
    }
});

/**
 * @route   GET /api/prayers/weather
 * @desc    Get weather information
 * @access  Public
 */
router.get('/weather', [
    query('latitude').isFloat({ min: -90, max: 90 }),
    query('longitude').isFloat({ min: -180, max: 180 }),
  ], async (req: Request, res: Response) => {
      try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
              return res.status(400).json({ status: 'error', errors: errors.array() });
          }

          const { latitude, longitude } = req.query as any;

          // Generate cache key
          const cacheKey = `weather:${latitude}:${longitude}`;

          // Try to get from cache first
          try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
              console.log(`✅ Cache hit for weather (${latitude}, ${longitude})`);
              return res.json(JSON.parse(cachedData));
            }
          } catch (cacheError) {
            console.warn('⚠️ Redis cache read error:', cacheError);
          }

          // Open-Meteo URL with comprehensive weather data
          const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;

          console.log(`Fetching weather from: ${apiUrl}`);

          const response = await fetch(apiUrl);
          if (!response.ok) {
              throw new Error(`Weather API error: ${response.status}`);
          }

          const data = await response.json();

          const responseData = {
               status: 'success',
               data: data
          };

          // Store in cache
          try {
            await redisClient.setEx(cacheKey, CACHE_TTL.WEATHER, JSON.stringify(responseData));
            console.log(`💾 Cached weather for ${CACHE_TTL.WEATHER / 60} minutes`);
          } catch (cacheError) {
            console.warn('⚠️ Redis cache write error:', cacheError);
          }

          return res.json(responseData);
      } catch (error: any) {
          console.error('Weather API error:', error.message);
          return res.status(500).json({ status: 'error', message: 'Failed to fetch weather info' });
      }
  });

/**
 * @route   GET /api/prayers/qibla
 * @desc    Get Qibla direction
 * @access  Public
 */
router.get('/qibla', [
  query('latitude').isFloat(),
  query('longitude').isFloat(),
], async (req: Request, res: Response) => {
    try {
        const { latitude, longitude } = req.query as { latitude: string, longitude: string };
        
        const qiblaDegrees = calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude));
        const distanceToMecca = calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude));
        
        res.json({
            status: 'success',
            data: {
                location: { latitude, longitude },
                qibla: {
                    direction: {
                        degrees: qiblaDegrees
                    },
                    distance: {
                        value: distanceToMecca
                    }
                },
                compass: getCompassDirection(qiblaDegrees)
            }
        });

    } catch (error: any) {
        console.error('Qibla API error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch Qibla', details: error.message });
    }
});

export default router;
