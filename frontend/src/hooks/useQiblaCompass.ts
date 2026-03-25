import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateDistanceKm, calculateQiblaBearing } from '../utils/qiblaMath';

interface GeolocationErrorLike {
  code?: number;
  message?: string;
}

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

  const headingBufferRef = useRef<number[]>([]);
  const gpsReceivedRef = useRef(false);
  const compassSupportedRef = useRef(false);
  const noCompassAvailableRef = useRef(false);
  const userLatRef = useRef<number | null>(null);
  const userLngRef = useRef<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const compassTimeoutRef = useRef<number | null>(null);
  const gpsTimeoutRef = useRef<number | null>(null);
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
  }, []);

  const onLocationSuccess = useCallback((position: GeolocationPosition) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;

    gpsReceivedRef.current = true;
    userLatRef.current = lat;
    userLngRef.current = lng;

    setGpsError(null);
    setUserLat(lat);
    setUserLng(lng);
    setQiblaBearing(calculateQiblaBearing(lat, lng));
    setDistanceKm(calculateDistanceKm(lat, lng));

    if (compassSupportedRef.current) {
      setStatusText('Compass active');
    } else if (noCompassAvailableRef.current) {
      setStatusText('Map mode - no compass sensor');
    } else {
      setStatusText('Detecting compass...');
    }
  }, []);

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

    headingBufferRef.current = [];
  }, []);

  const start = useCallback(async () => {
    cleanupSensors();

    setIsStarted(true);
    setGpsError(null);
    setStatusText('Waiting for sensors...');

    gpsReceivedRef.current = false;
    compassSupportedRef.current = false;
    noCompassAvailableRef.current = false;
    userLatRef.current = null;
    userLngRef.current = null;

    setCompassSupported(false);
    setNoCompassAvailable(false);
    setCurrentHeading(0);

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

        setCompassSupported(true);
        setNoCompassAvailable(false);
        setStatusText(userLatRef.current !== null ? 'Compass active' : 'Waiting for GPS...');
      }

      const smoothed = smoothHeading(heading);
      setCurrentHeading(smoothed);
    };

    orientationHandlerRef.current = handleOrientation;

    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
        } else {
          noCompassAvailableRef.current = true;
          setNoCompassAvailable(true);
          setStatusText('Map mode - compass permission denied');
          setGpsError('Compass permission denied. You can still use map mode to verify Qibla direction.');
        }
      } catch {
        noCompassAvailableRef.current = true;
        setNoCompassAvailable(true);
        setStatusText('Map mode - compass unavailable');
      }
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, true);
      compassTimeoutRef.current = window.setTimeout(() => {
        if (!compassSupportedRef.current) {
          noCompassAvailableRef.current = true;
          setNoCompassAvailable(true);
          setStatusText(userLatRef.current !== null ? 'Map mode - use map to verify direction' : 'Waiting for location...');
        }
      }, 2500);
    } else {
      noCompassAvailableRef.current = true;
      setNoCompassAvailable(true);
      setStatusText(userLatRef.current !== null ? 'Map mode - use map to verify direction' : 'Waiting for location...');
    }
  }, [cleanupSensors, onLocationError, onLocationSuccess]);

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
    isAligned,
    alignmentDiff,
  };
};
