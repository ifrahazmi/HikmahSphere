type LocationInput = {
  name?: string;
  address?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
};

const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/?api=1';

export const generateGoogleMapsDirectionsUrl = (location: LocationInput): string => {
  const lat = location?.coordinates?.lat;
  const lng = location?.coordinates?.lng;

  if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
    return `${GOOGLE_MAPS_DIRECTIONS_BASE}&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  const destinationText = (location?.address || location?.name || '').trim();
  if (destinationText.length > 0) {
    return `${GOOGLE_MAPS_DIRECTIONS_BASE}&destination=${encodeURIComponent(destinationText)}`;
  }

  return 'https://www.google.com/maps';
};
