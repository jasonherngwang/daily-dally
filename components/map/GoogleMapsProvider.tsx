'use client';

import { createContext, useContext, ReactNode } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | null;
  getMapLibrary: () => Promise<google.maps.MapsLibrary>;
  getDirectionsLibrary: () => Promise<google.maps.RoutesLibrary>;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue | null>(null);

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const value: GoogleMapsContextValue = {
    isLoaded: true,
    loadError: null,
    getMapLibrary: async () => {
      const { Map } = await importLibrary('maps');
      return { Map } as google.maps.MapsLibrary;
    },
    getDirectionsLibrary: async () => {
      return await importLibrary('routes');
    },
  };

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within GoogleMapsProvider');
  }
  return context;
}
