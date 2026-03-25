import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  KAABA_LAT,
  KAABA_LNG,
  calculateDistanceKm,
  destinationPoint,
  formatBytes,
  generateTileUrls,
  greatCirclePath,
} from '../../utils/qiblaMath';

interface QiblaMapProps {
  userLat: number | null;
  userLng: number | null;
  currentHeading: number;
  noCompassAvailable: boolean;
  darkMode?: boolean;
}

interface TileCacheInfo {
  count: number;
  bytes: number;
}

const postToServiceWorker = async (message: Record<string, unknown>) => {
  if (!('serviceWorker' in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return true;
  }

  if (registration.active) {
    registration.active.postMessage(message);
    return true;
  }

  return false;
};

const QiblaMap: React.FC<QiblaMapProps> = ({ userLat, userLng, currentHeading, noCompassAvailable, darkMode = false }) => {
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const qiblaLineRef = useRef<L.Polyline | null>(null);
  const headingLineRef = useRef<L.Polyline | null>(null);

  const [cacheInfo, setCacheInfo] = useState<TileCacheInfo | null>(null);
  const [downloadState, setDownloadState] = useState({ active: false, done: 0, total: 0, errors: 0 });
  const [offlineError, setOfflineError] = useState<string | null>(null);

  useEffect(() => {
    if (userLat === null || userLng === null || mapRef.current) return;

    const map = L.map('qibla-map', { zoomControl: false, attributionControl: false }).setView([userLat, userLng], 16);
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      subdomains: 'abcd',
    }).addTo(map);

    L.marker([KAABA_LAT, KAABA_LNG], {
      icon: L.divIcon({
        html: '<div style="font-size:22px;line-height:1">🕋</div>',
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    })
      .addTo(map)
      .bindTooltip('Makkah - Kaaba', { direction: 'top', offset: [0, -14] });

    userMarkerRef.current = L.marker([userLat, userLng], {
      icon: L.divIcon({
        html: '<div style="width:14px;height:14px;background:#10b981;border:2.5px solid #fff;border-radius:50%;box-shadow:0 0 10px rgba(16,185,129,.6)"></div>',
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    })
      .addTo(map)
      .bindTooltip('You', { direction: 'top', offset: [0, -10] });

    qiblaLineRef.current = L.polyline(greatCirclePath(userLat, userLng, KAABA_LAT, KAABA_LNG), {
      color: '#14b8a6',
      weight: 3,
      opacity: 0.85,
      dashArray: '8 6',
      lineCap: 'round',
    }).addTo(map);

    const headingDistance = Math.min(calculateDistanceKm(userLat, userLng) * 0.15, 300);
    headingLineRef.current = L.polyline(
      [[userLat, userLng], destinationPoint(userLat, userLng, currentHeading, Math.max(headingDistance, 30))],
      {
        color: '#f59e0b',
        weight: 3,
        opacity: noCompassAvailable ? 0 : 0.7,
        lineCap: 'round',
      }
    ).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      qiblaLineRef.current = null;
      headingLineRef.current = null;
    };
  }, [currentHeading, noCompassAvailable, userLat, userLng]);

  useEffect(() => {
    if (userLat === null || userLng === null || !mapRef.current) return;

    userMarkerRef.current?.setLatLng([userLat, userLng]);
    qiblaLineRef.current?.setLatLngs(greatCirclePath(userLat, userLng, KAABA_LAT, KAABA_LNG));

    const headingDistance = Math.min(calculateDistanceKm(userLat, userLng) * 0.15, 300);
    headingLineRef.current?.setLatLngs([
      [userLat, userLng],
      destinationPoint(userLat, userLng, currentHeading, Math.max(headingDistance, 30)),
    ]);

    headingLineRef.current?.setStyle({ opacity: noCompassAvailable ? 0 : 0.7 });
  }, [currentHeading, noCompassAvailable, userLat, userLng]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data?.type) return;

      if (data.type === 'PRECACHE_PROGRESS') {
        setDownloadState({ active: true, done: data.done || 0, total: data.total || 0, errors: data.errors || 0 });
      }

      if (data.type === 'PRECACHE_COMPLETE') {
        setDownloadState({ active: false, done: data.total || 0, total: data.total || 0, errors: data.errors || 0 });
        void postToServiceWorker({ type: 'GET_TILE_CACHE_SIZE' });
      }

      if (data.type === 'TILE_CACHE_CLEARED') {
        setCacheInfo({ count: 0, bytes: 0 });
        setDownloadState({ active: false, done: 0, total: 0, errors: 0 });
      }

      if (data.type === 'TILE_CACHE_SIZE') {
        setCacheInfo({ count: data.count || 0, bytes: data.bytes || 0 });
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);
    void postToServiceWorker({ type: 'GET_TILE_CACHE_SIZE' });

    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  const onCacheTiles = async () => {
    if (userLat === null || userLng === null) return;

    const tiles = generateTileUrls(userLat, userLng, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 12);
    setDownloadState({ active: true, done: 0, total: tiles.length, errors: 0 });
    setOfflineError(null);

    const sent = await postToServiceWorker({ type: 'PRECACHE_TILES', tiles });
    if (!sent) {
      setDownloadState({ active: false, done: 0, total: 0, errors: 0 });
      setOfflineError('Offline map service is not ready yet. Refresh once and try again.');
    }
  };

  const onClearTiles = async () => {
    setOfflineError(null);
    const sent = await postToServiceWorker({ type: 'CLEAR_TILE_CACHE' });
    if (!sent) {
      setOfflineError('Could not clear saved tiles right now. Please refresh and try again.');
    }
  };

  const progressPercent = downloadState.total > 0 ? Math.round((downloadState.done / downloadState.total) * 100) : 0;

  return (
    <div className="w-full space-y-4">
      <div className={`rounded-2xl border p-2 shadow-sm ${darkMode ? 'border-[#C9A84C]/30 bg-[#111827]' : 'border-emerald-100 bg-white'}`}>
        <div id="qibla-map" className="h-[290px] w-full rounded-xl" style={darkMode ? { filter: 'brightness(0.65) contrast(1.15) saturate(0.25) hue-rotate(180deg) invert(1)' } : undefined} />
      </div>

      <div className={`rounded-2xl border p-4 shadow-sm ${darkMode ? 'border-[#C9A84C]/30 bg-[#111827]' : 'border-emerald-100 bg-white'}`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-base font-semibold ${darkMode ? 'text-[#C9A84C]' : 'text-gray-900'}`}>Offline Map</h3>
          <p className={`text-xs ${darkMode ? 'text-[#8896AB]' : 'text-gray-500'}`}>
            {cacheInfo && cacheInfo.count > 0
              ? `${cacheInfo.count} tiles · ${formatBytes(cacheInfo.bytes)}`
              : 'No cached tiles'}
          </p>
        </div>

        <p className={`mt-2 text-xs ${darkMode ? 'text-[#8896AB]' : 'text-gray-500'}`}>
          Save map tiles around your location so this map still works without internet.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCacheTiles}
            disabled={userLat === null || userLng === null || downloadState.active}
            className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cacheInfo && cacheInfo.count > 0 ? 'Update Offline Map' : 'Save Map for Offline'}
          </button>

          {cacheInfo && cacheInfo.count > 0 && (
            <button
              type="button"
              onClick={onClearTiles}
              className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Clear Saved Map
            </button>
          )}
        </div>

        {offlineError && (
          <p className={`mt-2 text-xs ${darkMode ? 'text-rose-300' : 'text-rose-600'}`}>{offlineError}</p>
        )}

        {(downloadState.active || downloadState.total > 0) && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${downloadState.active ? 'bg-emerald-500' : 'bg-teal-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
              <span>
                {downloadState.active
                  ? `Downloading tiles... ${downloadState.done}/${downloadState.total}`
                  : `Done: ${downloadState.done - downloadState.errors} cached`}
              </span>
              <span>{downloadState.active ? `${progressPercent}%` : 'Complete'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QiblaMap;
