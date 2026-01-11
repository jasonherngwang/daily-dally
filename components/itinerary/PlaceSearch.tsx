'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { Input } from '@/components/ui/Input';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = !!apiKey?.trim();
  const [isBootstrapping, setIsBootstrapping] = useState(hasApiKey);
  const [loadError, setLoadError] = useState<string | null>(
    hasApiKey ? null : 'Google Maps API key not configured'
  );
  const [value, setValue] = useState('');
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  const shouldShowDropdown = isFocused && predictions.length > 0;

  const searchTimeoutRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!hasApiKey) return;

    const initPlaces = async () => {
      try {
        setIsBootstrapping(true);
        setLoadError(null);

        await importLibrary('places');
        autocompleteServiceRef.current = new google.maps.places.AutocompleteService();
        placesServiceRef.current = new google.maps.places.PlacesService(document.createElement('div'));

        setIsBootstrapping(false);
      } catch (error) {
        console.error('Error loading Google Maps:', error);
        setLoadError('Failed to load place search');
        setIsBootstrapping(false);
      }
    };

    initPlaces();
  }, [hasApiKey]);

  useLayoutEffect(() => {
    // Best-effort mobile behavior: focus immediately on mount.
    // Some mobile browsers will still block programmatic focus, but removing any async gating helps a lot.
    if (!hasApiKey) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [hasApiKey]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const queueSearch = (next: string) => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = next.trim();
    if (!trimmed) return;

    const mySeq = ++requestSeqRef.current;
    searchTimeoutRef.current = window.setTimeout(() => {
      const service = autocompleteServiceRef.current;
      if (!service) {
        setIsSearching(false);
        return;
      }

      const request: google.maps.places.AutocompletionRequest = {
        input: trimmed,
        ...(locationBias ? { location: new google.maps.LatLng(locationBias.lat, locationBias.lng) } : {}),
      };

      service.getPlacePredictions(request, (results) => {
        // Only accept the latest request's results.
        if (mySeq !== requestSeqRef.current) return;
        setPredictions(results ?? []);
        setIsSearching(false);
      });
    }, 150);
  };

  const selectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    const service = placesServiceRef.current;
    if (!service) return;

    setSelectError(null);
    setIsSearching(true);

    service.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['place_id', 'name', 'formatted_address', 'geometry'],
      },
      (place, status) => {
        setIsSearching(false);

        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          setSelectError('Could not load place details. Please try again.');
          return;
        }

        const loc = place.geometry?.location;
        if (!place.place_id || !place.name || !loc) {
          setSelectError('Could not load place location. Please try again.');
          return;
        }

        onPlaceSelect({
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address ?? '',
          location: { lat: loc.lat(), lng: loc.lng() },
        });

        setValue('');
        setPredictions([]);
        setIsFocused(false);
      }
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            if (!next.trim()) {
              setPredictions([]);
              setIsSearching(false);
              setSelectError(null);
              return;
            }
            setIsSearching(true);
            setSelectError(null);
            queueSearch(next);
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Allow click on a result before closing.
            window.setTimeout(() => setIsFocused(false), 100);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setPredictions([]);
              setIsFocused(false);
              inputRef.current?.blur();
            }
            if (e.key === 'Enter' && predictions.length > 0) {
              e.preventDefault();
              selectPrediction(predictions[0]);
            }
          }}
          className="pr-10"
        />

        {(isBootstrapping || isSearching) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {shouldShowDropdown && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-parchment-dark card-elevated">
          <div className="max-h-72 overflow-auto">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                className="w-full px-4 py-3 text-left transition-colors hover:bg-parchment/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                onMouseDown={(e) => {
                  // Prevent input blur before we can select.
                  e.preventDefault();
                }}
                onClick={() => selectPrediction(p)}
              >
                <div className="text-sm font-medium text-ink">
                  {p.structured_formatting?.main_text ?? p.description}
                </div>
                {p.structured_formatting?.secondary_text && (
                  <div className="mt-0.5 text-xs text-ink-light">
                    {p.structured_formatting.secondary_text}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {(loadError || selectError) && (
        <div className="mt-2 text-sm text-red-600">{loadError ?? selectError}</div>
      )}
    </div>
  );
}
