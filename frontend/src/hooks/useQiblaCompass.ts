import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyLowPassAngle,
  calculateDistanceKm,
  calculateQiblaBearing,
  correctedHeadingFromEuler,
  normalizeAngle,
  smallestAngleDiff,
} from '../utils/qiblaMath';

interface GeolocationErrorLike {
  code?: number;
  message?: string;
}

type CompassPermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

const LOW_ACCURACY_THRESHOLD_METERS = 35;
const JITTER_THRESHOLD_DEG = 20;
const STABILITY_THRESHOLD_DEG = 14;
const HEADING_LOCK_THRESHOLD_DEG = 2;
const SMOOTHING_FACTOR = 0.1;
const CALIBRATION_SETTLE_MS = 2500;
const CALIBRATION_LIVE_WINDOW_MS = 15000;
const COMPASS_PERMISSION_GUIDANCE = 'Compass permission is blocked. Open browser/site settings, allow Motion Sensors and Location, then return and tap Calibrate.';
const FIGURE_8_GUIDANCE = 'Move your phone in a figure-8 motion to calibrate compass';
const INTERFERENCE_WARNING = 'Keep away from metal objects and use outdoors for best accuracy.';
const COMPASS_WEAK_MESSAGE = 'Compass signal is weak. Hold phone level and calibrate for better accuracy.';
const COMPASS_ACTIVE_LOW_ACCURACY = 'Compass active (accuracy low)';

const isSecureOrLocalhost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  return window.isSecureContext || isLocal;
};

const getScreenOrientationAngle = (): number => {
  const orientation = (window.screen as Screen & { orientation?: { angle?: number } }).orientation;
  if (orientation && typeof orientation.angle === 'number') {
    return orientation.angle;
  }

  const legacyOrientation = (window as Window & { orientation?: number }).orientation;
  return typeof legacyOrientation === 'number' ? legacyOrientation : 0;
};

const getCurrentPositionAsync = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  });

const fetchDeclination = async (lat: number, lng: number): Promise<number | null> => {
  try {
    const response = await fetch(
      `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=${lat}&lon1=${lng}&resultFormat=json`
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { result?: Array<{ declination?: number }> };
    const value = data?.result?.[0]?.declination;
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return value;
  } catch {
    return null;
  }
};

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
  const [isSupported, setIsSupported] = useState(true);
  const [direction, setDirection] = useState<number | null>(null);

  const headingBufferRef = useRef<number[]>([]);
  const compassSupportedRef = useRef(false);
  const noCompassAvailableRef = useRef(false);
  const compassPermissionRef = useRef<CompassPermissionState>('unknown');
  const locationAccuracyRef = useRef<number | null>(null);
  const qiblaBearingRef = useRef<number | null>(null);
  const declinationRef = useRef<number>(Number(process.env.REACT_APP_MAG_DECLINATION || 0));
  const declinationFetchedRef = useRef(false);
  const lastRawHeadingRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const stableHeadingRef = useRef<number | null>(null);
  const lastUnstableHeadingRef = useRef<number | null>(null);
  const unstableCountRef = useRef(0);
  const compassEventSeenRef = useRef(false);
  const reliabilityRef = useRef({ total: 0, relativeCount: 0, jitterCount: 0, unstableCount: 0 });
  const userLatRef = useRef<number | null>(null);
  const userLngRef = useRef<number | null>(null);

  const compassTimeoutRef = useRef<number | null>(null);
  const calibrationTimerRef = useRef<number | null>(null);
  const calibrationLiveUntilRef = useRef(0);
  const orientationHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const alignmentDiff = useMemo(() => {
    if (qiblaBearing === null) return null;
    let diff = ((qiblaBearing - currentHeading) % 360 + 360) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
  }, [qiblaBearing, currentHeading]);

  const isAligned = alignmentDiff !== null && alignmentDiff < 5;

  const isUnstableHeading = useCallback((newHeading: number): boolean => {
    if (lastUnstableHeadingRef.current === null) {
      lastUnstableHeadingRef.current = newHeading;
      unstableCountRef.current = 0;
      return false;
    }

    const diff = smallestAngleDiff(newHeading, lastUnstableHeadingRef.current);
    lastUnstableHeadingRef.current = newHeading;

    if (diff > JITTER_THRESHOLD_DEG) {
      unstableCountRef.current += 1;
    } else {
      unstableCountRef.current = 0;
    }

    return unstableCountRef.current > 3;
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
    const bearing = calculateQiblaBearing(lat, lng);

    userLatRef.current = lat;
    userLngRef.current = lng;
    locationAccuracyRef.current = accuracy;
    qiblaBearingRef.current = bearing;

    if (!declinationFetchedRef.current) {
      declinationFetchedRef.current = true;
      void fetchDeclination(lat, lng).then((value) => {
        if (typeof value === 'number') {
          declinationRef.current = value;
        }
      });
    }

    setGpsError(null);
    setUserLat(lat);
    setUserLng(lng);
    setQiblaBearing(bearing);
    setDistanceKm(calculateDistanceKm(lat, lng));
    setLocationAccuracyMeters(accuracy);

    if (noCompassAvailableRef.current) {
      const heading = stableHeadingRef.current ?? smoothedHeadingRef.current ?? currentHeading;
      setDirection(normalizeAngle(bearing - heading));
      setStatusText(COMPASS_WEAK_MESSAGE);
    } else if (smoothedHeadingRef.current !== null) {
      setDirection(normalizeAngle(bearing - smoothedHeadingRef.current));
    } else {
      setDirection(bearing);
      setStatusText('Detecting compass...');
    }
  }, [currentHeading]);

  const cleanupSensors = useCallback(() => {
    if (orientationHandlerRef.current) {
      window.removeEventListener('deviceorientation', orientationHandlerRef.current, true);
      window.removeEventListener('deviceorientationabsolute', orientationHandlerRef.current, true);
      orientationHandlerRef.current = null;
    }

    if (compassTimeoutRef.current) {
      window.clearTimeout(compassTimeoutRef.current);
      compassTimeoutRef.current = null;
    }

    if (calibrationTimerRef.current) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }

    headingBufferRef.current = [];
    lastRawHeadingRef.current = null;
    smoothedHeadingRef.current = null;
    stableHeadingRef.current = null;
    lastUnstableHeadingRef.current = null;
    unstableCountRef.current = 0;
    compassEventSeenRef.current = false;
    reliabilityRef.current = { total: 0, relativeCount: 0, jitterCount: 0, unstableCount: 0 };
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
          return true;
        }

        compassPermissionRef.current = isRetry ? 'blocked' : 'denied';
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
        setGpsError('Compass permission denied. You can use map mode, or enable permission in settings and calibrate again.');
        setStatusText(COMPASS_WEAK_MESSAGE);
        return false;
      } catch {
        compassPermissionRef.current = 'blocked';
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
        setStatusText(COMPASS_WEAK_MESSAGE);
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

    compassSupportedRef.current = false;
    noCompassAvailableRef.current = false;
    compassPermissionRef.current = 'unknown';
    locationAccuracyRef.current = null;
    qiblaBearingRef.current = null;
    declinationFetchedRef.current = false;
    userLatRef.current = null;
    userLngRef.current = null;

    setCompassSupported(false);
    setNoCompassAvailable(false);
    setCurrentHeading(0);
    setLocationAccuracyMeters(null);
    setIsLowAccuracy(true);
    setIsSupported(true);
    setDirection(null);

    if (!isSecureOrLocalhost()) {
      setIsSupported(false);
      setStatusText('Compass requires HTTPS.');
      setPermissionHelpMessage('Open this page on HTTPS to use live compass sensors.');
    }

    if (!('geolocation' in navigator)) {
      onLocationError({ code: 2, message: 'Geolocation unsupported' });
      return;
    }

    try {
      const position = await getCurrentPositionAsync();
      onLocationSuccess(position);
    } catch (error) {
      onLocationError(error as GeolocationErrorLike);
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      compassEventSeenRef.current = true;
      const iosEvent = event as DeviceOrientationEvent & { webkitCompassHeading?: number };
      let heading: number | null = null;
      let usesRelativeSensor = false;

      if (iosEvent.webkitCompassHeading !== undefined) {
        heading = normalizeAngle(iosEvent.webkitCompassHeading);
      } else if (event.absolute === true && event.alpha !== null) {
        heading = normalizeAngle(360 - event.alpha + getScreenOrientationAngle());
      } else if (event.alpha !== null) {
        usesRelativeSensor = true;
        heading = correctedHeadingFromEuler(event.alpha, event.beta ?? 0, event.gamma ?? 0, getScreenOrientationAngle());
      }

      if (heading === null) {
        setIsLowAccuracy(true);
        setPermissionHelpMessage(`${FIGURE_8_GUIDANCE}. ${INTERFERENCE_WARNING}`);
        return;
      }

      // Convert magnetic heading to true-north heading using declination correction.
      heading = normalizeAngle(heading + declinationRef.current);

      const reliability = reliabilityRef.current;
      reliability.total += 1;

      if (usesRelativeSensor || event.absolute === false) {
        reliability.relativeCount += 1;
      }

      if (lastRawHeadingRef.current !== null) {
        const jump = smallestAngleDiff(heading, lastRawHeadingRef.current);
        if (jump > JITTER_THRESHOLD_DEG) {
          reliability.jitterCount += 1;
        }
      }
      lastRawHeadingRef.current = heading;

      const unstableByJump = isUnstableHeading(heading);
      if (unstableByJump) {
        setIsLowAccuracy(true);
        setPermissionHelpMessage(`${FIGURE_8_GUIDANCE}. ${INTERFERENCE_WARNING}`);
      }

      headingBufferRef.current.push(heading);
      if (headingBufferRef.current.length > 12) {
        headingBufferRef.current.shift();
      }

      if (headingBufferRef.current.length >= 6) {
        let movement = 0;
        for (let i = 1; i < headingBufferRef.current.length; i += 1) {
          movement += smallestAngleDiff(headingBufferRef.current[i], headingBufferRef.current[i - 1]);
        }
        const avgMovement = movement / (headingBufferRef.current.length - 1);
        if (avgMovement > STABILITY_THRESHOLD_DEG) {
          reliability.unstableCount += 1;
        }
      }

      const unstable = reliability.jitterCount >= 4 || reliability.unstableCount >= 3;
      const severeUnstable = unstableCountRef.current > 10 || (reliability.jitterCount > 12 && reliability.total > 20);
      if (severeUnstable) {
        setIsLowAccuracy(true);
        setStatusText(COMPASS_WEAK_MESSAGE);
        setPermissionHelpMessage(`${FIGURE_8_GUIDANCE}. ${INTERFERENCE_WARNING}`);
        return;
      }

      if (!compassSupportedRef.current) {
        compassSupportedRef.current = true;
        noCompassAvailableRef.current = false;
        compassPermissionRef.current = 'granted';

        setCompassSupported(true);
        setNoCompassAvailable(false);
        setPermissionHelpMessage(null);
      }

      const smoothed =
        smoothedHeadingRef.current === null
          ? heading
          : applyLowPassAngle(smoothedHeadingRef.current, heading, SMOOTHING_FACTOR);
      smoothedHeadingRef.current = smoothed;

      const inCalibrationLiveWindow = Date.now() < calibrationLiveUntilRef.current;

      const stableHeading = stableHeadingRef.current;
      const shouldUpdateStableHeading =
        inCalibrationLiveWindow || stableHeading === null || smallestAngleDiff(smoothed, stableHeading) > HEADING_LOCK_THRESHOLD_DEG;
      if (shouldUpdateStableHeading) {
        stableHeadingRef.current = smoothed;
        setCurrentHeading(smoothed);
      }

      const headingForDirection = stableHeadingRef.current ?? smoothed;

      const bearing = qiblaBearingRef.current;
      if (bearing !== null) {
        setDirection(normalizeAngle(bearing - headingForDirection));
      }

      const lowAccuracy =
        locationAccuracyRef.current === null ||
        locationAccuracyRef.current > LOW_ACCURACY_THRESHOLD_METERS ||
        reliability.jitterCount >= 2 ||
        unstableByJump ||
        unstable;

      if (inCalibrationLiveWindow) {
        setIsLowAccuracy(false);
        setStatusText('Compass active');
        setPermissionHelpMessage(null);
      } else {
        setIsLowAccuracy(lowAccuracy);
        setStatusText(lowAccuracy ? COMPASS_ACTIVE_LOW_ACCURACY : 'Compass active');
      }

      if (lowAccuracy && !inCalibrationLiveWindow) {
        setPermissionHelpMessage(`${FIGURE_8_GUIDANCE}. ${INTERFERENCE_WARNING}`);
      }
    };

    orientationHandlerRef.current = handleOrientation;

    const orientationSupported = 'DeviceOrientationEvent' in window;
    if (!orientationSupported || !isSecureOrLocalhost()) {
      setIsSupported(false);
      setIsLowAccuracy(true);
      setStatusText(COMPASS_WEAK_MESSAGE);
      setPermissionHelpMessage('Compass sensor support is limited on this browser/device.');
      return;
    }

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const granted = await requestCompassPermission(false);
      if (granted) {
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);
      } else {
        setIsLowAccuracy(true);
        setStatusText(COMPASS_WEAK_MESSAGE);
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
      }
    } else if ('DeviceOrientationEvent' in window) {
      const isAndroid = /android/i.test(window.navigator.userAgent || '');
      if (isAndroid) {
        setPermissionHelpMessage('Android may not show a motion popup. Compass will run using available sensor mode.');
      }

      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      compassTimeoutRef.current = window.setTimeout(() => {
        if (!compassEventSeenRef.current) {
          setIsLowAccuracy(true);
          setStatusText(COMPASS_WEAK_MESSAGE);
          setPermissionHelpMessage(`${FIGURE_8_GUIDANCE}. ${INTERFERENCE_WARNING}`);
        }
      }, 5000);
    } else {
      setIsLowAccuracy(true);
      setStatusText(COMPASS_WEAK_MESSAGE);
      setPermissionHelpMessage('Compass sensors are not available in this browser.');
    }
  }, [cleanupSensors, isUnstableHeading, onLocationError, onLocationSuccess, requestCompassPermission]);

  const calibrateCompass = useCallback(async () => {
    setIsCalibrating(true);
    setIsLowAccuracy(true);
    setStatusText('Calibrating compass...');
    setPermissionHelpMessage(null);

    if (calibrationTimerRef.current) {
      window.clearTimeout(calibrationTimerRef.current);
      calibrationTimerRef.current = null;
    }

    cleanupSensors();

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      const granted = await requestCompassPermission(true);
      if (!granted) {
        setIsLowAccuracy(true);
        setStatusText(COMPASS_WEAK_MESSAGE);
        setPermissionHelpMessage(COMPASS_PERMISSION_GUIDANCE);
        setIsCalibrating(false);
        return;
      }
    }

    await start();
    calibrationTimerRef.current = window.setTimeout(() => {
      setIsCalibrating(false);
      calibrationLiveUntilRef.current = Date.now() + CALIBRATION_LIVE_WINDOW_MS;
      setIsLowAccuracy(false);
      setStatusText('Compass active');
      setPermissionHelpMessage(null);
    }, CALIBRATION_SETTLE_MS);
  }, [cleanupSensors, requestCompassPermission, start]);

  useEffect(() => () => cleanupSensors(), [cleanupSensors]);

  const heading = currentHeading;
  const isCalibrated = !isLowAccuracy && !noCompassAvailable;

  return {
    isStarted,
    start,
    userLat,
    userLng,
    direction,
    heading,
    qiblaBearing,
    distanceKm,
    currentHeading,
    compassSupported,
    isSupported,
    noCompassAvailable,
    statusText,
    gpsError,
    locationAccuracyMeters,
    isLowAccuracy,
    isCalibrating,
    permissionHelpMessage,
    isCalibrated,
    isAligned,
    alignmentDiff,
    calibrateCompass,
  };
};
