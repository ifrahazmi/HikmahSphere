import express from 'express';
import User from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// Get User Profile & Preferences
router.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findById(req.params.id, '-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Get User Notification Preferences
router.get('/:id/notification-prefs', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    return res.json({ notificationPreferences: user.preferences?.notifications?.prayerAlerts || null });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Update User Notification Preferences
router.put('/:id/notification-prefs', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { notificationPreferences } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (!user.preferences) user.preferences = {} as any;
    if (!user.preferences.notifications) user.preferences.notifications = {} as any;
    
    user.preferences.notifications.prayerAlerts = notificationPreferences;
    
    user.markModified('preferences');
    await user.save();
    
    return res.json({ message: 'Updated', notificationPreferences: user.preferences.notifications.prayerAlerts });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Save the location + calculation settings the server needs to push prayer
// (Adhan) notifications even while the app is closed. Called by the Prayer
// Times page whenever a logged-in user's location/settings are resolved.
router.put('/:id/prayer-push', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { latitude, longitude, method, school, city, country, enabled, timezone, times, timesDate } = req.body || {};

    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const normalizedSchool = Number(school) === 2 ? 2 : 1;
    const normalizedMethod = Number.isFinite(Number(method)) ? Number(method) : 1;

    // Keep only the five obligatory prayers as "HH:MM" so the scheduler can
    // match the exact times the page displayed for this local day.
    const normalizeHHMM = (value: unknown): string | undefined => {
      const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
      if (!match) return undefined;
      return `${String(parseInt(match[1] as string, 10)).padStart(2, '0')}:${match[2]}`;
    };
    const savedTimes = times && typeof times === 'object'
      ? {
          ...(normalizeHHMM(times.Fajr) ? { Fajr: normalizeHHMM(times.Fajr) } : {}),
          ...(normalizeHHMM(times.Dhuhr) ? { Dhuhr: normalizeHHMM(times.Dhuhr) } : {}),
          ...(normalizeHHMM(times.Asr) ? { Asr: normalizeHHMM(times.Asr) } : {}),
          ...(normalizeHHMM(times.Maghrib) ? { Maghrib: normalizeHHMM(times.Maghrib) } : {}),
          ...(normalizeHHMM(times.Isha) ? { Isha: normalizeHHMM(times.Isha) } : {}),
        }
      : undefined;

    user.prayerPush = {
      enabled: enabled === false ? false : true,
      latitude: lat,
      longitude: lon,
      method: normalizedMethod,
      school: normalizedSchool,
      ...(typeof timezone === 'string' && timezone.trim() ? { timezone: timezone.trim() } : {}),
      ...(savedTimes && Object.keys(savedTimes).length > 0 ? { times: savedTimes } : {}),
      ...(typeof timesDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timesDate) ? { timesDate } : {}),
      ...(typeof city === 'string' && city.trim() ? { city: city.trim() } : {}),
      ...(typeof country === 'string' && country.trim() ? { country: country.trim() } : {}),
      updatedAt: new Date(),
    } as any;

    // Keep user.location in sync so the Prayer Times page can bootstrap without GPS.
    user.location = {
      ...(typeof city === 'string' && city.trim() ? { city: city.trim() } : user.location?.city ? { city: user.location.city } : {}),
      ...(typeof country === 'string' && country.trim() ? { country: country.trim() } : user.location?.country ? { country: user.location.country } : {}),
      coordinates: { latitude: lat, longitude: lon },
    } as any;

    user.markModified('prayerPush');
    user.markModified('location');
    await user.save();

    return res.json({ message: 'Prayer push settings saved', prayerPush: user.prayerPush, location: user.location });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Get saved prayer/geo location for a logged-in user (null when never granted).
router.get('/:id/location', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const user = await User.findById(req.params.id).select('location prayerPush');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const loc = user.location;
    const push = user.prayerPush as any;
    const lat = loc?.coordinates?.latitude ?? push?.latitude;
    const lon = loc?.coordinates?.longitude ?? push?.longitude;

    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      return res.json({ location: null });
    }

    return res.json({
      location: {
        latitude: Number(lat),
        longitude: Number(lon),
        city: loc?.city || push?.city || undefined,
        country: loc?.country || push?.country || undefined,
        method: push?.method,
        school: push?.school,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Persist browser-granted location for prayer times (and sync prayerPush coords).
router.put('/:id/location', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { latitude, longitude, city, country, method, school } = req.body || {};
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const cityTrim = typeof city === 'string' && city.trim() ? city.trim() : undefined;
    const countryTrim = typeof country === 'string' && country.trim() ? country.trim() : undefined;
    const normalizedSchool = Number(school) === 2 ? 2 : (user.prayerPush?.school === 2 ? 2 : 1);
    const normalizedMethod = Number.isFinite(Number(method))
      ? Number(method)
      : (Number.isFinite(Number(user.prayerPush?.method)) ? Number(user.prayerPush?.method) : 1);

    user.location = {
      ...(cityTrim ? { city: cityTrim } : {}),
      ...(countryTrim ? { country: countryTrim } : {}),
      coordinates: { latitude: lat, longitude: lon },
    } as any;

    user.prayerPush = {
      ...(user.prayerPush || {}),
      enabled: user.prayerPush?.enabled !== false,
      latitude: lat,
      longitude: lon,
      method: normalizedMethod,
      school: normalizedSchool,
      ...(cityTrim ? { city: cityTrim } : {}),
      ...(countryTrim ? { country: countryTrim } : {}),
      updatedAt: new Date(),
    } as any;

    user.markModified('location');
    user.markModified('prayerPush');
    await user.save();

    return res.json({
      message: 'Location saved',
      location: {
        latitude: lat,
        longitude: lon,
        city: cityTrim,
        country: countryTrim,
        method: normalizedMethod,
        school: normalizedSchool,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

// Update User Generic Preferences
router.put('/:id/preferences', authMiddleware, async (req: any, res) => {
  try {
    if (req.user.userId !== req.params.id && !req.user.role?.includes('admin')) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const { preferences } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.preferences = { ...user.preferences, ...preferences };
    user.markModified('preferences');
    await user.save();
    
    return res.json({ message: 'Updated', preferences: user.preferences });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

export default router;
