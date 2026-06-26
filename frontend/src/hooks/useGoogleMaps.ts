import { useState, useEffect } from 'react';
import { GOOGLE_MAPS_API_KEY } from '../config';

const useGoogleMaps = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
    
  useEffect(() => {
    const loadGoogleMapsScript = async () => {
      console.log("useGoogleMaps: useEffect triggered");

      if (!GOOGLE_MAPS_API_KEY) {
        setError(new Error("Google Maps API key is missing. Please add it to your .env file."));
        return;
      }

      if ((window as any).google && (window as any).google.maps) {
        console.log("useGoogleMaps: google maps already loaded");
        setIsLoaded(true);
        return;
      }

      if (document.getElementById('google-maps-script-with-places')) {
        console.log("useGoogleMaps: script already exists");
        // Wait for the existing script to load
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if ((window as any).google && (window as any).google.maps) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
        setIsLoaded(true);
        return;
      }

      try {
        const script = document.createElement('script');
        script.id = 'google-maps-script-with-places';
        // TODO: Replace DEMO_MAP_ID with your actual Map ID
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,marker&loading=async`;
        script.async = true;
        script.defer = true;
        script.crossOrigin = "anonymous";

        await new Promise<void>((resolve, reject) => {
          script.onload = () => {
            console.log("useGoogleMaps: google maps script loaded");
            resolve();
          };
          script.onerror = (e) => {
            console.error("useGoogleMaps: failed to load google maps script", e);
            reject(new Error('Failed to load Google Maps.'));
          };
          document.head.appendChild(script); 
        });

        const componentLibScript = document.createElement('script');
        componentLibScript.type = 'module';
        componentLibScript.src = 'https://ajax.googleapis.com/ajax/libs/@googlemaps/extended-component-library/0.6.15/index.min.js';
        
        await new Promise<void>((resolve, reject) => {
          componentLibScript.onload = () => {
            console.log("useGoogleMaps: extended component library loaded");
            resolve();
          };
          componentLibScript.onerror = (e) => {
            console.error("useGoogleMaps: failed to load extended component library", e);
            reject(new Error('Failed to load Google Maps Components.'));
          };
          document.head.appendChild(componentLibScript);
        });

        setIsLoaded(true);
      } catch (e: any) {
        setError(e);
      }
    };

    loadGoogleMapsScript();

  }, []);

  return { isLoaded, error };
};

export default useGoogleMaps;
