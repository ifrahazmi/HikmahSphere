import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowTopRightOnSquareIcon, MagnifyingGlassIcon, MapPinIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../LoadingSpinner';
import { generateGoogleMapsDirectionsUrl } from '../../utils/maps';
import { OSM_RASTER_ATTRIBUTION, OSM_RASTER_TILE_URL } from '../../utils/osmBasemap';
import {
  fetchNearbyMosques,
  formatMosqueDistanceKm,
  haversineKm,
  searchPlaces,
  shouldRefreshMosqueSearch,
  type NearbyMosque,
  type PlaceSuggestion,
} from '../../utils/mosqueOsm';

interface MosqueFinderProps {
  location: {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
  } | null;
}

const createUserIcon = () =>
  L.divIcon({
    html: '<div class="mosque-user-dot"></div>',
    className: 'mosque-map-pin',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const mosquePinSvg = (selected: boolean): string => {
  const pin = selected ? '#b45309' : '#047857';
  const wall = selected ? '#fff7ed' : '#ecfdf5';
  const dome = selected ? '#fdba74' : '#6ee7b7';
  const accent = '#fbbf24';
  const door = selected ? '#7c2d12' : '#064e3b';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46" aria-hidden="true">
    <path d="M18 44.8C18 44.8 33.2 29 33.2 18.4A15.2 15.2 0 1 0 2.8 18.4C2.8 29 18 44.8 18 44.8z" fill="${pin}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/>
    <rect x="8.1" y="16.2" width="2.6" height="9.2" rx="0.7" fill="${wall}"/>
    <rect x="25.3" y="16.2" width="2.6" height="9.2" rx="0.7" fill="${wall}"/>
    <circle cx="9.4" cy="15.3" r="1.25" fill="${accent}"/>
    <circle cx="26.6" cy="15.3" r="1.25" fill="${accent}"/>
    <path d="M12.4 22.8c0-4.2 2.5-7.4 5.6-7.4s5.6 3.2 5.6 7.4" fill="${dome}"/>
    <rect x="12.4" y="22.2" width="11.2" height="7.4" rx="1.1" fill="${wall}"/>
    <rect x="16.5" y="24.6" width="3" height="5" rx="0.55" fill="${door}"/>
    <path d="M18 11.6c1.55 0 2.45 1.2 2.45 2.45" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="18" cy="11.4" r="1" fill="${accent}"/>
  </svg>`;
};

const createMosqueIcon = (selected: boolean) =>
  L.divIcon({
    html: mosquePinSvg(selected),
    className: selected ? 'mosque-map-pin is-selected' : 'mosque-map-pin',
    iconSize: selected ? [42, 54] : [36, 46],
    iconAnchor: selected ? [21, 52] : [18, 44],
  });

const MosqueFinder: React.FC<MosqueFinderProps> = ({ location }) => {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const mosqueMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const lastSearchRef = useRef<{ lat: number; lon: number } | null>(null);
  const searchTimerRef = useRef<number | null>(null);
  const placeTimerRef = useRef<number | null>(null);
  const mosqueAbortRef = useRef<AbortController | null>(null);
  const placeAbortRef = useRef<AbortController | null>(null);
  const skipNextMoveSearchRef = useRef(false);

  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<NearbyMosque | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(location ? { lat: location.lat, lon: location.lon } : null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runMosqueSearch = useCallback(async (lat: number, lon: number, force = false) => {
    if (!force && !shouldRefreshMosqueSearch(lastSearchRef.current, { lat, lon })) {
      return;
    }

    mosqueAbortRef.current?.abort();
    const controller = new AbortController();
    mosqueAbortRef.current = controller;
    lastSearchRef.current = { lat, lon };
    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await fetchNearbyMosques(lat, lon, { signal: controller.signal });
      if (controller.signal.aborted) {
        return;
      }
      setMosques(results);
      setSelectedMosque((current) => current && results.some((mosque) => mosque.id === current.id) ? current : null);
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return;
      }
      setSearchError('Could not load nearby mosques. Please try again.');
      setMosques([]);
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, []);

  const panTo = useCallback((lat: number, lon: number, zoom = 14) => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    skipNextMoveSearchRef.current = true;
    map.setView([lat, lon], zoom);
  }, []);

  const handleMarkerClick = useCallback((mosque: NearbyMosque) => {
    setSelectedMosque(mosque);
    panTo(mosque.lat, mosque.lon, 16);
    const element = document.getElementById(`mosque-${mosque.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [panTo]);

  const handleGetLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setOrigin({ lat, lon });
        panTo(lat, lon, 14);
        void runMosqueSearch(lat, lon, true);
      },
      (error) => {
        setIsLocating(false);
        console.error('Error getting location:', error);
        alert('Could not get your location. Please check your browser or device location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [panTo, runMosqueSearch]);

  const selectPlace = useCallback((place: PlaceSuggestion) => {
    setQuery(place.label);
    setSuggestions([]);
    setShowMobileSearch(false);
    panTo(place.lat, place.lon, 14);
    void runMosqueSearch(place.lat, place.lon, true);
  }, [panTo, runMosqueSearch]);

  const locationLat = location?.lat;
  const locationLon = location?.lon;

  useEffect(() => {
    if (locationLat == null || locationLon == null) {
      return;
    }
    setOrigin({ lat: locationLat, lon: locationLon });
  }, [locationLat, locationLon]);

  useEffect(() => {
    if (locationLat == null || locationLon == null || !mapElRef.current) {
      return;
    }

    if (mapRef.current) {
      skipNextMoveSearchRef.current = true;
      mapRef.current.setView([locationLat, locationLon], 13);
      void runMosqueSearch(locationLat, locationLon, true);
      return;
    }

    const map = L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([locationLat, locationLon], 13);

    L.tileLayer(OSM_RASTER_TILE_URL, {
      maxZoom: 19,
      attribution: OSM_RASTER_ATTRIBUTION,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    userMarkerRef.current = L.marker([locationLat, locationLon], {
      icon: createUserIcon(),
      zIndexOffset: 400,
      title: 'Your location',
    })
      .addTo(map)
      .bindTooltip('You', { direction: 'top', offset: [0, -10] });

    map.on('moveend', () => {
      if (skipNextMoveSearchRef.current) {
        skipNextMoveSearchRef.current = false;
        return;
      }
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
      }
      const center = map.getCenter();
      searchTimerRef.current = window.setTimeout(() => {
        void runMosqueSearch(center.lat, center.lng);
      }, 1200);
    });

    mapRef.current = map;
    void runMosqueSearch(locationLat, locationLon, true);
    window.requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 250);
  }, [locationLat, locationLon, runMosqueSearch]);

  useEffect(() => () => {
    if (searchTimerRef.current !== null) {
      window.clearTimeout(searchTimerRef.current);
    }
    mosqueAbortRef.current?.abort();
    mapRef.current?.remove();
    mapRef.current = null;
    markersLayerRef.current = null;
    userMarkerRef.current = null;
    mosqueMarkersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!origin || !userMarkerRef.current) {
      return;
    }
    userMarkerRef.current.setLatLng([origin.lat, origin.lon]);
  }, [origin]);

  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) {
      return;
    }

    layer.clearLayers();
    mosqueMarkersRef.current.clear();

    mosques.forEach((mosque) => {
      const marker = L.marker([mosque.lat, mosque.lon], {
        icon: createMosqueIcon(selectedMosque?.id === mosque.id),
        title: mosque.name,
        zIndexOffset: selectedMosque?.id === mosque.id ? 300 : 1,
      }).on('click', () => handleMarkerClick(mosque));
      marker.addTo(layer);
      mosqueMarkersRef.current.set(mosque.id, marker);
    });
  }, [handleMarkerClick, mosques, selectedMosque]);

  useEffect(() => {
    if (placeTimerRef.current !== null) {
      window.clearTimeout(placeTimerRef.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return undefined;
    }

    placeTimerRef.current = window.setTimeout(() => {
      placeAbortRef.current?.abort();
      const controller = new AbortController();
      placeAbortRef.current = controller;
      void searchPlaces(trimmed, { signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
          }
        })
        .catch((error) => {
          if ((error as { name?: string })?.name !== 'AbortError') {
            setSuggestions([]);
          }
        });
    }, 400);

    return () => {
      if (placeTimerRef.current !== null) {
        window.clearTimeout(placeTimerRef.current);
      }
    };
  }, [query]);

  useEffect(() => () => {
    placeAbortRef.current?.abort();
    mosqueAbortRef.current?.abort();
  }, []);

  if (!location) {
    return (
      <div className="text-center p-4 text-red-500">
        Location not available. Please enable location services and refresh the page.
      </div>
    );
  }

  const searchField = (
    <div className="relative min-w-0 flex-1">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search for a location"
        autoComplete="off"
        className="h-11 w-full rounded-lg border border-emerald-200 bg-white pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none ring-emerald-500 placeholder:text-gray-400 focus:border-emerald-400 focus:ring-2"
      />
      {suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-emerald-100 bg-white py-1 shadow-lg">
          {suggestions.map((place) => (
            <li key={`${place.lat},${place.lon},${place.label}`}>
              <button
                type="button"
                onClick={() => selectPlace(place)}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-emerald-50"
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <div className="relative z-0 flex h-[calc(100dvh-120px)] min-h-[500px] w-full flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl lg:h-[calc(100vh-160px)] lg:flex-row">
      <div className="z-10 flex h-1/2 w-full flex-col border-b border-emerald-100 bg-gray-50/50 lg:h-full lg:w-1/3 lg:border-b-0 lg:border-r">
        <div className="shrink-0 border-b border-emerald-100 bg-white p-3 shadow-sm sm:p-5">
          <div className="mb-2 flex items-center justify-between sm:mb-3">
            <h3 className="flex items-center gap-1.5 text-base font-bold text-emerald-800 sm:text-xl">
              <img src="/mosque-find.png" alt="" className="h-6 w-6 object-contain sm:h-7 sm:w-7" />
              Mosque Finder
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 sm:text-sm lg:hidden"
              >
                {isLocating ? 'Locating...' : 'Near Me'}
              </button>
              <button
                type="button"
                onClick={() => setShowMobileSearch((open) => !open)}
                className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100 sm:text-sm lg:hidden"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
                {showMobileSearch ? 'Close' : 'Search'}
              </button>
            </div>
          </div>
          <div className={`${showMobileSearch ? 'flex' : 'hidden'} mb-1 w-full gap-2 lg:flex`}>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={isLocating}
              className="hidden shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 lg:flex"
            >
              {isLocating ? 'Locating...' : 'Near Me'}
            </button>
            {searchField}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
          {isSearching && mosques.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : searchError ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-rose-600">
              <p className="text-sm">{searchError}</p>
            </div>
          ) : mosques.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-gray-400">
              <MapPinIcon className="mb-3 h-12 w-12 text-emerald-200" />
              <p className="text-sm">No mosques found nearby.</p>
              <p className="mt-1 text-xs">Try moving the map or searching a different area.</p>
            </div>
          ) : (
            mosques.map((mosque) => {
              const isSelected = selectedMosque?.id === mosque.id;
              const dist = origin ? formatMosqueDistanceKm(haversineKm(origin.lat, origin.lon, mosque.lat, mosque.lon)) : null;
              return (
                <div
                  id={`mosque-${mosque.id}`}
                  key={mosque.id}
                  onClick={() => handleMarkerClick(mosque)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleMarkerClick(mosque);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer rounded-xl border p-3 transition-all duration-300 sm:p-4 ${
                    isSelected
                      ? 'scale-[1.02] border-emerald-500 bg-emerald-50/80 shadow-md ring-1 ring-emerald-500'
                      : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={`text-sm font-bold sm:text-base ${isSelected ? 'text-emerald-800' : 'text-gray-900'}`}>{mosque.name}</h4>
                    {dist ? (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 sm:text-xs">
                        {dist} km
                      </span>
                    ) : null}
                  </div>
                  {mosque.address ? (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500 sm:text-sm">{mosque.address}</p>
                  ) : null}
                  {isSelected ? (
                    <div className="mt-3 flex justify-end border-t border-emerald-200 pt-3 transition-opacity duration-300 sm:mt-4 sm:pt-4">
                      <a
                        href={generateGoogleMapsDirectionsUrl({
                          name: mosque.name,
                          address: mosque.address,
                          coordinates: { lat: mosque.lat, lng: mosque.lon },
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:from-emerald-500 hover:to-teal-500 hover:shadow-md sm:text-sm"
                      >
                        Get Directions <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="relative h-1/2 w-full bg-gray-100 lg:h-full lg:w-2/3">
        {isSearching ? (
          <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-emerald-800 shadow">
            Updating mosques...
          </div>
        ) : null}
        <div ref={mapElRef} className="mosque-finder-map h-full w-full" />
      </div>
    </div>
  );
};

export default MosqueFinder;
