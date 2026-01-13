import type { Coordinates } from '@/types/trip';

export type GooglePlacesCanonicalPlace = {
  placeId: string;
  name: string;
  address: string;
  location: Coordinates;
  types: string[];
};

type PlacesFindPlaceResponse = {
  status: string;
  error_message?: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  }>;
};

type PlacesDetailsResponse = {
  status: string;
  error_message?: string;
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    types?: string[];
  };
};

function parseCanonicalPlace(raw: {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  types?: string[];
}): GooglePlacesCanonicalPlace | null {
  const placeId = raw.place_id;
  const name = raw.name;
  const loc = raw.geometry?.location;
  const lat = loc?.lat;
  const lng = loc?.lng;
  if (!placeId || !name || typeof lat !== 'number' || typeof lng !== 'number') return null;
  return {
    placeId,
    name,
    address: raw.formatted_address || '',
    location: { lat, lng },
    types: raw.types ?? [],
  };
}

export async function googlePlacesDetails(args: {
  apiKey: string;
  placeId: string;
}): Promise<GooglePlacesCanonicalPlace | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', args.placeId);
  url.searchParams.set(
    'fields',
    [
      'place_id',
      'name',
      'formatted_address',
      'geometry/location',
      'types',
    ].join(',')
  );
  url.searchParams.set('key', args.apiKey);

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesDetailsResponse;
  if (data.status !== 'OK') return null;
  const place = data.result ? parseCanonicalPlace(data.result) : null;
  return place;
}

export async function googlePlacesFindPlaceFromText(args: {
  apiKey: string;
  input: string;
  locationBias?: { center: Coordinates; radiusMeters: number };
}): Promise<GooglePlacesCanonicalPlace | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', args.input);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set(
    'fields',
    [
      'place_id',
      'name',
      'formatted_address',
      'geometry/location',
      'types',
    ].join(',')
  );
  if (args.locationBias) {
    const { center, radiusMeters } = args.locationBias;
    url.searchParams.set('locationbias', `circle:${radiusMeters}@${center.lat},${center.lng}`);
  }
  url.searchParams.set('key', args.apiKey);

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) return null;
  const data = (await res.json()) as PlacesFindPlaceResponse;
  if (data.status !== 'OK') return null;
  const first = data.candidates?.[0];
  if (!first) return null;
  return parseCanonicalPlace(first);
}

