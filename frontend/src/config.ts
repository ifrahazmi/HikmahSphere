export const getApiUrl = () => {
  // Check if we have an environment variable first
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Use relative path to leverage the proxy in package.json
  // This is the correct way for IDX/Codespaces where 127.0.0.1 is not accessible from the client browser directly
  return '/api';
};

export const API_URL = getApiUrl();

// The Google Maps API Key is loaded from the environment variable REACT_APP_GOOGLE_MAPS_API_KEY with a fallback
export const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyCIqYSh04cj7XYTAC0QuS1hGxam-D6US9I";
