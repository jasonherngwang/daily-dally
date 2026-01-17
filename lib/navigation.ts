import type { Destination } from '@/types/trip';

export function getGoogleMapsNavigationUrl(destination: Destination): string | null {
  if (!destination.location) return null;

  const { lat, lng } = destination.location;
  
  // Use coordinates for reliable navigation
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
