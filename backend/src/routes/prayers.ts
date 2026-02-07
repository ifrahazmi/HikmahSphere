import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = express.Router();

// Configuration - Using Aladhan API (free, no Cloudflare protection)
const API_BASE_URL = 'https://api.aladhan.com/v1/timings';
const CALENDAR_API_URL = 'https://api.aladhan.com/v1/calendar'; 

// Helper function to get compass direction
function getCompassDirection(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return directions[index];
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
], optionalAuthMiddleware, async (req, res) => {
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

    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${school === '2' ? '1' : '0'}`;
    
    console.log(`Fetching prayer times from Aladhan: ${apiUrl}`);

    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
        throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData = await apiResponse.json();
    
    console.log('Prayer API Response received successfully');

    if (apiData.code === 200 && apiData.data) {
        const data = apiData.data;
        res.json({
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
                        degrees: parseFloat(data.meta.qibla || '0')
                    }
                },
                meta: data.meta,
                location: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                },
                settings: { method, school }
            }
        });
    } else {
        throw new Error('Invalid response from Aladhan API');
    }

  } catch (error: any) {
    console.error('Prayer times API error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch prayer times',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/prayers/fasting
 * @desc    Get fasting times (Sahur/Iftar)
 * @access  Public
 */
router.get('/fasting', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { latitude, longitude, method = '3' } = req.query as any;
        
        const timestamp = Math.floor(Date.now() / 1000);
        const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}`;
        
        console.log(`Fetching fasting times from Aladhan: ${apiUrl}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Aladhan API error: ${response.status}`);
        }
        
        const apiData = await response.json();
        
        console.log('Fasting API Response received successfully');
        
        if (apiData.code === 200 && apiData.data) {
            const data = apiData.data;
            res.json({
                status: 'success',
                data: {
                    sahur: data.timings.Imsak,
                    imsak: data.timings.Imsak,
                    fajr: data.timings.Fajr,
                    iftar: data.timings.Maghrib,
                    date: data.date
                }
            });
        } else {
            throw new Error('Invalid response from Aladhan API');
        }
    } catch (error: any) {
        console.error('Fasting API error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch fasting times', details: error.message });
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
  ], async (req, res) => {
      try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
              return res.status(400).json({ status: 'error', errors: errors.array() });
          }
  
          const { latitude, longitude } = req.query as any;
          
          // Open-Meteo URL with comprehensive weather data
          const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
          
          console.log(`Fetching weather from: ${apiUrl}`);
  
          const response = await fetch(apiUrl);
          if (!response.ok) {
              throw new Error(`Weather API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          res.json({
               status: 'success',
               data: data
          });
      } catch (error: any) {
          console.error('Weather API error:', error.message);
          res.status(500).json({ status: 'error', message: 'Failed to fetch weather info' });
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
], async (req, res) => {
    try {
        const { latitude, longitude } = req.query as { latitude: string, longitude: string };
        const timestamp = Math.floor(Date.now() / 1000);
        const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=3`;
        
        console.log(`Fetching Qibla direction from Aladhan: ${apiUrl}`);
        
        const apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
            throw new Error(`Aladhan API error: ${apiResponse.status}`);
        }
        
        const apiData = await apiResponse.json();
        
        if (apiData.code === 200 && apiData.data && apiData.data.meta) {
            const qiblaDegrees = parseFloat(apiData.data.meta.qibla || '0');
             res.json({
                status: 'success',
                data: {
                    location: { latitude, longitude },
                    qibla: {
                        direction: {
                            degrees: qiblaDegrees
                        }
                    },
                    compass: getCompassDirection(qiblaDegrees)
                }
            });
        } else {
            throw new Error("Qibla data missing from API response");
        }

    } catch (error: any) {
        console.error('Qibla API error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch Qibla', details: error.message });
    }
});

export default router;
