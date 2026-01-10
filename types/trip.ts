export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Destination {
  id: string;
  name: string;
  placeId?: string;
  address?: string;
  location?: Coordinates;
  notes: string;
}

export interface Day {
  id: string;
  label: string;
  destinations: Destination[];
}

export interface Trip {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  days: Day[];
}

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  location: Coordinates;
}
