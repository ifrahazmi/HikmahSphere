import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = express.Router();

// Configuration
const API_BASE_URL = 'https://islamicapi.com/api/v1/prayer-time';
const FASTING_API_URL = 'https://islamicapi.com/api/v1/fasting';
// Using the provided API Key directly to ensure it works
const API_KEY = process.env.PRAYER_TIMES_API_KEY || 'icgUaIHMO8GWEVLh7XhFcFoTHjQlsfhSBpJtYfrtTUJXY1eI'; 

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

    const apiUrl = `${API_BASE_URL}/?lat=${latitude}&lon=${longitude}&method=${method}&school=${school}&api_key=${API_KEY}`;
    
    // Log URL with masked key for debugging
    console.log(`Fetching prayer times from: ${apiUrl.replace(API_KEY, 'API_KEY_HIDDEN')}`);

    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
        throw new Error(`External API responded with ${apiResponse.status}: ${apiResponse.statusText}`);
    }

    const apiData = await apiResponse.json();

    // The external API returns data in apiData.data
    // We pass it through directly but wrap in our success format
    if (apiData.data) {
        res.json({
            status: 'success',
            data: {
                // Map fields to match what frontend likely expects or just pass full object
                // Frontend expects: date.readable, times.Fajr, qibla.direction.degrees
                times: apiData.data.times,
                date: apiData.data.date,
                qibla: apiData.data.qibla,
                timezone: apiData.data.timezone,
                prohibited_times: apiData.data.prohibited_times,
                
                // Metadata
                location: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                },
                settings: { method, school }
            }
        });
    } else {
        throw new Error('Invalid response structure from external API');
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
  query('method').optional().isInt()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ status: 'error', errors: errors.array() });
        }

        const { latitude, longitude, method = '3' } = req.query as any;
        
        const apiUrl = `${FASTING_API_URL}/?lat=${latitude}&lon=${longitude}&method=${method}&api_key=${API_KEY}`;
        
        console.log(`Fetching fasting times from: ${apiUrl.replace(API_KEY, 'API_KEY_HIDDEN')}`);

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`External API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
             res.json({
                 status: 'success',
                 data: data.data
             });
        } else {
            throw new Error('Invalid response from fasting API');
        }
    } catch (error: any) {
        console.error('Fasting API error:', error.message);
        res.status(500).json({ status: 'error', message: 'Failed to fetch fasting times' });
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
          
          // Open-Meteo URL - requesting hourly temperature to map to prayer times
          // Added daily=temperature_2m_max,temperature_2m_min for max/min values
          const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
          
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
        const apiUrl = `${API_BASE_URL}/?lat=${latitude}&lon=${longitude}&method=1&school=1&api_key=${API_KEY}`;
        
        const apiResponse = await fetch(apiUrl);
        const apiData = await apiResponse.json();
        
        if (apiData.data && apiData.data.qibla) {
             res.json({
                status: 'success',
                data: {
                    location: { latitude, longitude },
                    qibla: apiData.data.qibla,
                    compass: getCompassDirection(apiData.data.qibla.direction.degrees)
                }
            });
        } else {
            throw new Error("Qibla data missing from API response");
        }

    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to fetch Qibla' });
    }
});

export default router;
