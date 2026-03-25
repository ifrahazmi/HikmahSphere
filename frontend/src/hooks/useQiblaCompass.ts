import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateDistanceKm, calculateQiblaBearing } from '../utils/qiblaMath';

interface GeolocationErrorLike {
  code?: number;
  message?: string;
}

type CompassPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

const LOW_ACCURACY_THRESHOLD_METERS = 35;
const COMPASS_PERMISSION_GUIDANCE = 'Compass permission is blocked. Open browser/site settings, allow Motion Sensors and Location, then return and tap Calibrate.';

export const useQiblaCompass = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [compassSupported, setCompassSupported] = useState(false);
  const [noCompassAvailable, setNoCompassAvailable] = useState(false);
  const [statusText, setStatusText] = useState('Waiting for sensors...');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [isLowAccuracy, setIsLowAccuracy] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [permissionHelpMessage, setPermissionHelpMessage] = useState<string | null>(null);

  const headingBufferRef = useRef<number[]>([]);
  const gpsReceivedRef = useRef(false);
  const compassSupportedRef = useRef(false);
  const noCompassAvailableRef = useRef(false);
  const compassPermissionRef = useRef<CompassPermissionState>('unknown');
  const locationAccuracyRef = useRef<number | null>(null);
  const userLatRef = useRef<number | null>(null);
  const userLngRef = useRef<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const compassTimeoutRef = useRef<number | null>(null);
  const gpsTimeoutRef = useRef<number | null>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const orientationHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const smoothHeading = (raw: number): number => {
    headingBufferRef.current.push(raw);
    if (headingBufferRef.current.length > 5) {
      headingBufferRef.current.shift();
    }

    let sinSum = 0;
    let cosSum = 0;
    headingBufferRef.current.forEach((h) => {
      sinSum += Math.sin((h * Math.PI) / 180);
      cosSum += Math.cos((h * Math.PI) / 180);
    });

    return (((Math.atan2(sinSum, cosSum) * 180) / Math.PI) + 360) % 360;
  };

  const alignmentDiff = useMemo(() => {
    if (qiblaBearing === null) return null;
    let diff = ((qiblaBearing - currentHeading) % 360 + 360) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }, [qiblaBearing, currentHeading]);

  const isAligned = alignmentDiff !== null && alignmentDiff < 5;

  const refreshAccuracyState = useCallback((opts?: { forceLow?: boolean }) => {
    const headingSamples = headingBufferRef.current.length;
    const accuracy = locationAccuracyRef.current;
    const forceLow = opts?.forceLow === true;
    const low = forceLow || !compassSupportedRef.current || accuracy === null || accuracy > LOW_ACCURACY_THRESHOLD_METERS || headingSamples < 5;

    setIsLowAccuracy(low);
    if (compassSupportedRef.current) {
      setStatusText(low ? 'Low accuracy - calibrate compass' : 'Compass active');
    }
  }, []);

  const onLocationError = useCallback((error: GeolocationErrorLike) => {
    let message = 'Location unavailable';
    let help = '';

    switch (error?.code) {
      case 1:
        message = 'Location permission denied';
        help = 'Enable location permission in your browser settings and reload this page.';
        break;
      case 2:
        message = 'GPS signal not found';
        help = 'Try moving near a window or going outside. Indoor GPS can be unreliable.';
        break;
      case 3:
        message = 'GPS timed out';
        help = 'Your device took too long to get a fix. Try again in an open area.';
        break;
      default:
        break;
    }

    setGpsError(help ? `${message}. ${help}` : message);
    setStatusText(message);
    locationAccuracyRef.current = null;
    setLocationAccuracyMeters(null);
    setIsLowAccuracy(true);
  }, []);

  const onLocationSuccess = useCallback((position: GeolocationPosition) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null;

    gpsReceivedRef.current = true;
    userLatRef.current = lat;
    userLngRef.current = lng;
    locationAccuracyRef.current = accuracy;

    setGpsError(null);
    setPermissionHelpMessage(null);
    setUserLat(lat);
    setUserLng(lng);
    setQiblaBearing(calculateQiblaBearing(lat, lng));
    setDistanceKm(calculateDistanceKm(lat, lng));
    setLocationAccuracyMeters(accuracy);

    if (compassSupportedRef.current) {
      refreshAccuracyState();
    } else if (noCompassAvailableRef.current) {
      setStatusText('Map mode - no compass sensor');
    } else {
      setStatusText('Detecting compass...');
    }
  }, [refreshAccuracyState]);

  const cleanupSensors = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientation', orientationHandlerRef.current, true);
      orientationHandlerRef.current = null;
    }

    if (compassTimeoutRef.current) {
      window.clearTimeout(compassTimeoutRef.current);
      compassTimeoutRef.current = null;
    }

    if (gpsTimeoutRef.current) {
      window.clearTimeout(gpsTimeoutRef.current);
      gpsTimeoutRef.current = null;
    }

    if (calibrationTimerRef.current) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }

    headingBufferRef.current = [];
  }, []);

  const requestCompassPermission = useCallback(async (isRetry: boolean) => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();

        if (permission === 'granted') {
          compassPermissionRef.current = 'granted';
          setPermissionHelpMessage(null);
          return true;
        }

        compassPermissionRef.current = isRetry ? 'blocked' : 'denied';
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
        setGpsError('Compass permission denied. You can use map mode, or enable permission in settings and calibrate again.');
        setStatusText('Map mode - compass permission denied');
        return false;
      } catch {
        compassPermissionRef.current = 'blocked';
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
        setStatusText('Map mode - compass permission blocked');
        return false;
      }
    }

    return true;
  }, []);

  const start = useCallback(async () => {
    cleanupSensors();

    setIsStarted(true);
    setGpsError(null);
    setPermissionHelpMessage(null);
    setStatusText('Waiting for sensors...');
    setIsCalibrating(false);

    gpsReceivedRef.current = false;
    compassSupportedRef.current = false;
    noCompassAvailableRef.current = false;
    compassPermissionRef.current = 'unknown';
    locationAccuracyRef.current = null;
    userLatRef.current = null;
    userLngRef.current = null;

    setCompassSupported(false);
    setNoCompassAvailable(false);
    setCurrentHeading(0);
    setLocationAccuracyMeters(null);
    setIsLowAccuracy(true);

    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });

      gpsTimeoutRef.current = window.setTimeout(() => {
        if (!gpsReceivedRef.current) {
          setStatusText('GPS not responding');
          setGpsError('GPS not responding. Ensure Location Services are enabled and browser permission is granted, then reload.');
        }
      }, 20000);
    } else {
      onLocationError({ code: 2, message: 'Geolocation unsupported' });
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      const heading =
        iosEvent.webkitCompassHeading !== undefined
          ? iosEvent.webkitCompassHeading
          : event.alpha !== null
          ? (360 - event.alpha) % 360
          : null;

      if (heading === null) return;

      if (!compassSupportedRef.current) {
        compassSupportedRef.current = true;
        noCompassAvailableRef.current = false;
        compassPermissionRef.current = 'granted';

        setCompassSupported(true);
        setNoCompassAvailable(false);
        setStatusText(userLatRef.current !== null ? 'Low accuracy - calibrate compass' : 'Waiting for GPS...');
      }

      const smoothed = smoothHeading(heading);
      setCurrentHeading(smoothed);
      refreshAccuracyState();
    };

    orientationHandlerRef.current = handleOrientation;

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const granted = await requestCompassPermission(false);
      if (granted) {
        window.addEventListener('deviceorientation', handleOrientation, true);
      } else {
        noCompassAvailableRef.current = true;
        setNoCompassAvailable(true);
      }
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      compassTimeoutRef.current = window.setTimeout(() => {
        if (!compassSupportedRef.current) {
          noCompassAvailableRef.current = true;
          setNoCompassAvailable(true);
          compassPermissionRef.current = 'blocked';
          setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
          setStatusText(userLatRef.current !== null ? 'Map mode - use map to verify direction' : 'Waiting for location...');
        }
      }, 2500);
    } else {
      noCompassAvailableRef.current = true;
      setNoCompassAvailable(true);
      setStatusText(userLatRef.current !== null ? 'Map mode - use map to verify direction' : 'Waiting for location...');
    }
  }, [cleanupSensors, onLocationError, onLocationSuccess, refreshAccuracyState, requestCompassPermission]);

  const calibrateCompass = useCallback(async () => {
    setIsCalibrating(true);
    setPermissionHelpMessage(null);

    if (calibrationTimerRef.current) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }

    cleanupSensors();

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const granted = await requestCompassPermission(true);
      if (!granted) {
        noCompassAvailableRef.current = true;
        setNoCompassAvailable(true);
        setIsCalibrating(false);
        return;
      }
    }

    await start();
    calibrationTimerRef.current = window.setTimeout(() => {
      setIsCalibrating(false);
      refreshAccuracyState({ forceLow: false });
    }, 2200);
  }, [cleanupSensors, refreshAccuracyState, requestCompassPermission, start]);

  useEffect(() => () => cleanupSensors(), [cleanupSensors]);

  return {
    isStarted,
    start,
    userLat,
    userLng,
    qiblaBearing,
    distanceKm,
    currentHeading,
    compassSupported,
    noCompassAvailable,
    statusText,
    gpsError,
    locationAccuracyMeters,
    isLowAccuracy,
    isCalibrating,
    permissionHelpMessage,
    isAligned,
    alignmentDiff,
    calibrateCompass,
  };
};
