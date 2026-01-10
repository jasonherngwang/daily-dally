'use client';

import { useEffect } from 'react';
import { initGoogleMaps } from '@/lib/google-maps-init';

export function GoogleMapsInit() {
  useEffect(() => {
    initGoogleMaps();
  }, []);

  if (typeof window !== 'undefined') {
    initGoogleMaps();
  }

  return null;
}
