import type { Coordinates, Destination } from '@/types/trip';

export function hasValidLocation(d: Destination): d is Destination & { location: Coordinates } {
  return (
    d.location != null &&
    Number.isFinite(d.location.lat) &&
    Number.isFinite(d.location.lng)
  );
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  // Mean Earth radius (km)
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function bestInsertAfterDestinationIdForCandidate(args: {
  anchors: Array<{ destinationId: string; location: Coordinates }>;
  candidateLocation: Coordinates;
}): { insertAfterDestinationId: string; detourKm: number } {
  const { anchors, candidateLocation } = args;

  if (anchors.length === 0) {
    throw new Error('No anchors available');
  }

  if (anchors.length === 1) {
    const detourKm = haversineKm(anchors[0].location, candidateLocation);
    return { insertAfterDestinationId: anchors[0].destinationId, detourKm };
  }

  let best = {
    insertAfterDestinationId: anchors[0].destinationId,
    detourKm: Number.POSITIVE_INFINITY,
  };

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    const delta =
      haversineKm(a.location, candidateLocation) +
      haversineKm(candidateLocation, b.location) -
      haversineKm(a.location, b.location);
    if (delta < best.detourKm) {
      best = { insertAfterDestinationId: a.destinationId, detourKm: delta };
    }
  }

  return best;
}

