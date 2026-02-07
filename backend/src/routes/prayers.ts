import express, { Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = express.Router();

// Configuration - Using Aladhan API (free, no Cloudflare protection)
const API_BASE_URL = 'https://api.aladhan.com/v1/timings';
const CALENDAR_API_URL = 'https://api.aladhan.com/v1/calendar'; 

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

    const timestamp = Math.floor(Date.now() / 1000);
    const apiUrl = `${API_BASE_URL}/${timestamp}?latitude=${latitude}&longitude=${longitude}&method=${method}&school=${school === '2' ? '1' : '0'}`;
    
    console.log(`Fetching prayer times from Aladhan: ${apiUrl}`);

    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
        throw new Error(`Aladhan API responded with ${apiResponse.status}`);
    }

    const apiData: any = await apiResponse.json();
    
    console.log('Prayer API Response received successfully');

    if (apiData.code === 200 && apiData.data) {
        const data = apiData.data;
        const qiblaDegrees = calculateQiblaDirection(parseFloat(latitude), parseFloat(longitude));
        const distanceToMecca = calculateDistanceToMecca(parseFloat(latitude), parseFloat(longitude));
        
        return res.json({
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
        });
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
 * @route   GET /api/prayers/fasting
 * @desc    Get fasting times (Sahur/Iftar)
 * @access  Public
 */
router.get('/fasting', [
  query('latitude').isFloat({ min: -90, max: 90 }),
  query('longitude').isFloat({ min: -180, max: 180 }),
], async (req: Request, res: Response) => {
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
        
        const apiData: any = await response.json();
        
        console.log('Fasting API Response received successfully');
        
        if (apiData.code === 200 && apiData.data) {
            const data = apiData.data;
            return res.json({
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
        return res.status(500).json({ status: 'error', message: 'Failed to fetch fasting times', details: error.message });
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
          
          // Open-Meteo URL with comprehensive weather data
          const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
          
          console.log(`Fetching weather from: ${apiUrl}`);
  
          const response = await fetch(apiUrl);
          if (!response.ok) {
              throw new Error(`Weather API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          return res.json({
               status: 'success',
               data: data
          });
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
