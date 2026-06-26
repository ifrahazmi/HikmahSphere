import React, { useEffect, useRef, useState, useCallback } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import useGoogleMaps from '../../hooks/useGoogleMaps';
import { MapPinIcon, ArrowTopRightOnSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MosqueFinderProps {
  location: {
    lat: number;
    lon: number;
    city?: string;
    country?: string;
  } | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d.toFixed(1); // Distance in km
};

const getDirectionsUrl = (mosque: google.maps.places.Place) => {
    if (!mosque.location) return '#';
    const lat = mosque.location.lat();
    const lng = mosque.location.lng();
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
};

const MosqueFinder: React.FC<MosqueFinderProps> = ({ location }) => {
  const { isLoaded, error: mapError } = useGoogleMaps();
  const mapRef = useRef<any>(null);
  const placePickerRef = useRef<any>(null);
  const [mosques, setMosques] = useState<google.maps.places.Place[]>([]);
  const [selectedMosque, setSelectedMosque] = useState<google.maps.places.Place | null>(null);
  const [componentError, setComponentError] = useState<string | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const searchForMosques = useCallback(async (searchLocation: google.maps.LatLng) => {
    if (!isLoaded) {
      console.error("MosqueFinder: Google Maps not loaded for places search");
      return;
    }
  
    const request: google.maps.places.SearchNearbyRequest = {
      locationRestriction: {
        center: searchLocation,
        radius: 5000, // 5km
      },
      includedTypes: ['mosque'],
      fields: ['id', 'displayName', 'formattedAddress', 'location'],
    };
  
    try {
      const { places } = await google.maps.places.Place.searchNearby(request);
      if (places) {
        setMosques(places);
      }
    } catch (error) {
      console.warn("MosqueFinder: nearby search for mosques failed with error:", error);
    }
  }, [isLoaded]);

  const handleGetLocation = useCallback(() => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsLocating(false);
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          if (mapRef.current) {
            mapRef.current.center = pos;
            mapRef.current.zoom = 13;
          }
          if (isLoaded) {
             searchForMosques(new google.maps.LatLng(pos.lat, pos.lng));
          }
        },
        (error) => {
          setIsLocating(false);
          console.error("Error getting location:", error);
          alert("Could not get your location. Please check your browser or device location permissions.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }, [isLoaded, searchForMosques]);

  const initializeMap = useCallback(async () => {
    if (!isLoaded || !location) return;

    await customElements.whenDefined('gmp-map');
    const map = mapRef.current;
    if (!map || !map.innerMap) return;
    
    const center = { lat: location.lat, lng: location.lon };
    map.center = center;
    map.zoom = 13;

    await searchForMosques(new google.maps.LatLng(center.lat, center.lng));

    map.innerMap.addListener('idle', () => {
      const newCenter = map.innerMap.getCenter();
      if (newCenter) {
        searchForMosques(newCenter);
      }
    });
    
    const placePicker = placePickerRef.current;
    if(placePicker){
        placePicker.addEventListener('gmpx-placechange', () => {
            const place = placePicker.value;
            if (place?.location) {
                map.center = place.location;
            }
        });
    }
  }, [isLoaded, location, searchForMosques]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (location) {
        initializeMap();
    } else {
        setComponentError("Location not available. Please enable location services and refresh the page.");
    }
  }, [location, initializeMap]);

  const handleMarkerClick = (mosque: google.maps.places.Place) => {
    setSelectedMosque(mosque);
    if(mapRef.current && mosque.location) {
        mapRef.current.center = mosque.location;
        mapRef.current.zoom = 16;
    }
    
    // Attempt to scroll the selected mosque into view in the list
    const element = document.getElementById(`mosque-${mosque.id}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  if (!isLoaded && !mapError) {
    return <div className="flex justify-center items-center h-96"><LoadingSpinner /></div>;
  }

  if (mapError) {
    return <div className="text-center p-4 text-red-500">{mapError.message}</div>;
  }

  if (componentError) {
    return <div className="text-center p-4 text-red-500">{componentError}</div>;
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100dvh-120px)] lg:h-[calc(100vh-160px)] min-h-[500px] w-full border border-emerald-100 rounded-2xl overflow-hidden shadow-xl bg-white relative z-0">
      
      {/* Left Panel: Mosque List */}
      <div className="w-full lg:w-1/3 flex flex-col h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-emerald-100 bg-gray-50/50 z-10">
        
        {/* Panel Header & Search */}
        <div className="p-3 sm:p-5 border-b border-emerald-100 bg-white shadow-sm shrink-0">
          <div className="flex justify-between items-center mb-2 sm:mb-3">
            <h3 className="text-base sm:text-xl font-bold text-emerald-800 flex items-center gap-1.5">
              <MapPinIcon className="h-5 w-5 sm:h-6 sm:w-6" /> Mosque Finder
            </h3>
            <div className="flex gap-2">
              <button 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="lg:hidden text-xs sm:text-sm flex items-center gap-1 text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
              >
                 {isLocating ? 'Locating...' : 'Near Me'}
              </button>
              <button 
                onClick={() => setShowMobileSearch(!showMobileSearch)}
                className="lg:hidden text-xs sm:text-sm flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
              >
                 <MagnifyingGlassIcon className="h-4 w-4" />
                 {showMobileSearch ? 'Close' : 'Search'}
              </button>
            </div>
          </div>
          <div className={`${showMobileSearch ? 'flex' : 'hidden'} lg:flex w-full h-11 relative mb-1 gap-2`}>
             <button 
                onClick={handleGetLocation}
                disabled={isLocating}
                className="hidden lg:flex shrink-0 items-center justify-center text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 rounded-lg border border-blue-200 transition-colors disabled:opacity-50"
              >
                 {isLocating ? 'Locating...' : 'Near Me'}
              </button>
             <div className="flex-1 min-w-0 relative">
                <gmpx-place-picker ref={placePickerRef} placeholder="Search for a location" />
             </div>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {mosques.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center">
                <MapPinIcon className="h-12 w-12 mb-3 text-emerald-200" />
                <p className="text-sm">No mosques found nearby.</p>
                <p className="text-xs mt-1">Try moving the map or searching a different area.</p>
            </div>
          ) : (
            mosques.map(mosque => {
                const isSelected = selectedMosque?.id === mosque.id;
                const dist = location && mosque.location ? calculateDistance(location.lat, location.lon, mosque.location.lat(), mosque.location.lng()) : null;
                const name = (mosque.displayName as any)?.text || mosque.displayName || 'Mosque';
                
                return (
                <div 
                    id={`mosque-${mosque.id}`}
                    key={mosque.id} 
                    onClick={() => handleMarkerClick(mosque)}
                    className={`p-3 sm:p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                        isSelected 
                            ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-1 ring-emerald-500 scale-[1.02]' 
                            : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-md'
                    }`}
                >
                    <div className="flex justify-between items-start gap-2">
                        <h4 className={`font-bold text-sm sm:text-base ${isSelected ? 'text-emerald-800' : 'text-gray-900'}`}>{name}</h4>
                        {dist && <span className="shrink-0 text-[11px] sm:text-xs font-semibold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">{dist} km</span>}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{mosque.formattedAddress}</p>
                    
                    {isSelected && (
                    <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-emerald-200 flex justify-end transition-opacity duration-300">
                        <a 
                        href={getDirectionsUrl(mosque)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2 rounded-lg transition-all shadow-sm hover:shadow-md"
                        >
                        Get Directions <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        </a>
                    </div>
                    )}
                </div>
                );
            })
          )}
        </div>
      </div>
      
      {/* Right Panel: Map */}
      <div className="w-full lg:w-2/3 h-1/2 lg:h-full relative bg-gray-100">
        {/* TODO: Replace DEMO_MAP_ID with your actual Map ID */}
        <gmp-map ref={mapRef} map-id="DEMO_MAP_ID" style={{ display: 'block', width: '100%', height: '100%' }}>
            {location && <gmp-advanced-marker position={`${location.lat},${location.lon}`} title="Your Location" />}

            {mosques.map((mosque) => {
              const isSelected = selectedMosque?.id === mosque.id;
              return mosque.location && (
                <gmp-advanced-marker
                    key={mosque.id}
                    position={`${mosque.location.lat()},${mosque.location.lng()}`}
                    title={(mosque.displayName as any)?.text || mosque.displayName || 'Mosque'}
                    onClick={() => handleMarkerClick(mosque)}
                    zIndex={isSelected ? 100 : 1}
                >
                    {isSelected && <gmp-pin background="#10b981" border-color="#064e3b" glyph-color="white" scale="1.3"></gmp-pin>}
                </gmp-advanced-marker>
              );
            })}
        </gmp-map>
      </div>
    </div>
  );
};

export default MosqueFinder;
