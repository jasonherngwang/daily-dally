import { setOptions } from '@googlemaps/js-api-loader';

let isInitialized = false;

export function initGoogleMaps() {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey?.trim()) {
    return;
  }

  try {
    setOptions({
      key: apiKey.trim(),
      v: 'weekly',
    });
    isInitialized = true;
  } catch (error) {
    console.error('[Google Maps] Failed to initialize:', error);
  }
}
