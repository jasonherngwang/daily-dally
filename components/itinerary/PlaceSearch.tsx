'use client';

import { useEffect, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { PlaceResult } from '@/types/trip';

interface PlaceSearchProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  locationBias?: { lat: number; lng: number };
}

export function PlaceSearch({
  onPlaceSelect,
  placeholder = 'Search for a place...',
  locationBias,
}: PlaceSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey?.trim()) {
      setLoadError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }

    const initGoogleMaps = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        if (!containerRef.current) return;

        const placesLibrary = await importLibrary('places') as google.maps.PlacesLibrary & {
          PlaceAutocompleteElement: typeof google.maps.places.PlaceAutocompleteElement;
        };
        const { PlaceAutocompleteElement } = placesLibrary;

        const autocompleteOptions: google.maps.places.PlaceAutocompleteElementOptions = {};
        
        if (locationBias) {
          autocompleteOptions.locationBias = {
            lat: locationBias.lat,
            lng: locationBias.lng,
          };
        }

        const autocomplete = new PlaceAutocompleteElement(autocompleteOptions) as google.maps.places.PlaceAutocompleteElement & HTMLElement & { placeholder: string };
        autocomplete.placeholder = placeholder;
        autocomplete.className = 'place-autocomplete-custom';
        autocomplete.style.width = '100%';
        
        if (!document.getElementById('place-autocomplete-styles')) {
          const style = document.createElement('style');
          style.id = 'place-autocomplete-styles';
          style.textContent = `
            gmp-place-autocomplete {
              --gmpx-color-surface: var(--color-parchment, #F5F0E6);
              --gmpx-color-on-surface: var(--color-ink, #2C2416);
              --gmpx-color-on-surface-variant: var(--color-ink-light, #5C5040);
              --gmpx-color-primary: var(--color-forest, #2D5A45);
              --gmpx-color-outline: var(--color-border, #D4C9B8);
              --gmpx-font-family-base: var(--font-body, 'Source Sans 3', sans-serif);
              --gmpx-font-size-base: 1rem;
            }
          `;
          document.head.appendChild(style);
        }

        autocomplete.addEventListener('gmp-select', async (event: Event & { placePrediction?: { toPlace: () => google.maps.places.Place } }) => {
          try {
            if (!event.placePrediction) return;
            const place = event.placePrediction.toPlace();
            await place.fetchFields({
              fields: ['id', 'displayName', 'formattedAddress', 'location'],
            });

            if (place.id && place.location) {
              const result: PlaceResult = {
                placeId: place.id,
                name: place.displayName || '',
                address: place.formattedAddress || '',
                location: {
                  lat: place.location.lat(),
                  lng: place.location.lng(),
                },
              };

              onPlaceSelect(result);
              
              if (autocomplete.shadowRoot) {
                const input = autocomplete.shadowRoot.querySelector('input');
                if (input) {
                  input.value = '';
                }
              }
            }
          } catch (error) {
            console.error('Error processing place selection:', error);
          }
        });

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(autocomplete);
        autocompleteRef.current = autocomplete;

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setLoadError('Failed to load place search');
        setIsLoading(false);
      }
    };

    initGoogleMaps();

    return () => {
      if (autocompleteRef.current && containerRef.current) {
        containerRef.current.removeChild(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [onPlaceSelect, placeholder, locationBias]);

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full" />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <LoadingSpinner size="sm" />
        </div>
      )}
      {loadError && (
        <div className="mt-2 text-sm text-red-600">{loadError}</div>
      )}
    </div>
  );
}
