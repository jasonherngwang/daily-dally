import type { Destination } from '@/types/trip';

export function getGoogleMapsNavigationUrl(destination: Destination): string | null {
  if (!destination.location) return null;

  const { lat, lng } = destination.location;
  
  // Use coordinates for reliable navigation
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function getGoogleMapsDirectionsUrl(
  from: Destination,
  to: Destination
): string | null {
  if (!from.location || !to.location) return null;

  // Always use coordinates - place_id format is unreliable in URLs
  const origin = `${from.location.lat},${from.location.lng}`;
  const destination = `${to.location.lat},${to.location.lng}`;
  
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
}
