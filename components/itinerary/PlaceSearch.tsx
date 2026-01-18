'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { PlaceResult } from '@/types/trip';
import { useRovingListNavigation } from '@/hooks/useRovingListNavigation';

interface PlaceSearchProps {
  onPlaceSelect: (place: PlaceResult) => void;
  placeholder?: string;
  locationBias?: { lat: number; lng: number };
  autoFocus?: boolean;
}

type AutocompleteSuggestion = google.maps.places.AutocompleteSuggestion;

export function PlaceSearch({
  onPlaceSelect,
  placeholder = 'Search for a place...',
  locationBias,
  autoFocus = true,
}: PlaceSearchProps) {
  const LOCATION_BIAS_RADIUS_METERS = 50_000;
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasApiKey = !!apiKey?.trim();
  const [isBootstrapping, setIsBootstrapping] = useState(hasApiKey);
  const [loadError, setLoadError] = useState<string | null>(
    hasApiKey ? null : 'Google Maps API key not configured'
  );
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [hasFocusWithin, setHasFocusWithin] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);

  const selectableSuggestions = suggestions.filter((s) => !!s.placePrediction);
  const listRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const listboxId = `${uid}-places-listbox`;
  const optionId = (idx: number) => `${uid}-places-opt-${idx}`;

  const isOpen = hasFocusWithin && selectableSuggestions.length > 0;

  const searchTimeoutRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!hasApiKey) return;

    const initPlaces = async () => {
      try {
        setIsBootstrapping(true);
        setLoadError(null);

        const { AutocompleteSessionToken } = await importLibrary('places');
        sessionTokenRef.current = new AutocompleteSessionToken();

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
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [hasApiKey, autoFocus]);

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
      const run = async () => {
        try {
          const { AutocompleteSuggestion, AutocompleteSessionToken } = await importLibrary('places');

          // Ensure we always have a live session token (recommended by Google for billing/session grouping).
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }

          const request = {
            input: trimmed,
            sessionToken: sessionTokenRef.current,
            ...(locationBias
              ? {
                  // Bias results toward the last destination location (instead of user/device location).
                  // NOTE: Runtime expects a Circle/CircleLiteral shape here (not the web-service `circle: {}` wrapper).
                  locationBias: {
                    center: locationBias,
                    radius: LOCATION_BIAS_RADIUS_METERS,
                  },
                  // Also set origin so distanceMeters (if present) uses the trip context.
                  origin: locationBias,
                }
              : {}),
          } as any;

          // Hard timeout so the spinner can't get stuck forever if the API never resolves.
          const timeoutMs = 8000;
          let timeoutId: number | null = null;
          const timeout = new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error('Autocomplete request timed out')), timeoutMs);
          });

          let nextSuggestions: AutocompleteSuggestion[] | null | undefined;
          try {
            ({ suggestions: nextSuggestions } = await Promise.race([
              AutocompleteSuggestion.fetchAutocompleteSuggestions(request),
              timeout,
            ]));
          } finally {
            if (timeoutId) {
              window.clearTimeout(timeoutId);
            }
          }

          // Only accept the latest request's results.
          if (mySeq !== requestSeqRef.current) return;

          setSuggestions(nextSuggestions ?? []);
          nav.setActiveIndex(0);
        } catch (error) {
          if (mySeq !== requestSeqRef.current) return;
          console.error('Error fetching autocomplete suggestions:', error);
          setSuggestions([]);
        } finally {
          if (mySeq === requestSeqRef.current) {
            setIsSearching(false);
          }
        }
      };

      run();
    }, 150);
  };

  const selectSuggestion = async (suggestion: AutocompleteSuggestion) => {
    setSelectError(null);
    setIsSearching(true);

    try {
      const { AutocompleteSessionToken } = await importLibrary('places');

      const prediction = suggestion.placePrediction;
      if (!prediction) {
        setSelectError('Could not load place details. Please try again.');
        return;
      }
      const place = prediction.toPlace();

      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location'],
      });

      const loc = place.location;
      const lat =
        loc && typeof (loc as google.maps.LatLng).lat === 'function'
          ? (loc as google.maps.LatLng).lat()
          : (loc as google.maps.LatLngLiteral | null)?.lat;
      const lng =
        loc && typeof (loc as google.maps.LatLng).lng === 'function'
          ? (loc as google.maps.LatLng).lng()
          : (loc as google.maps.LatLngLiteral | null)?.lng;

      if (!place.id || !place.displayName || typeof lat !== 'number' || typeof lng !== 'number') {
        setSelectError('Could not load place location. Please try again.');
        return;
      }

      onPlaceSelect({
        placeId: place.id,
        name: place.displayName,
        address: place.formattedAddress ?? '',
        location: { lat, lng },
      });

      // New token per selection (recommended session lifecycle).
      sessionTokenRef.current = new AutocompleteSessionToken();

      setValue('');
      setSuggestions([]);
      setHasFocusWithin(false);
    } catch (error) {
      console.error('Error loading place details:', error);
      setSelectError('Could not load place details. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const closeDropdown = () => {
    setSuggestions([]);
    setHasFocusWithin(false);
  };

  const nav = useRovingListNavigation({
    itemCount: selectableSuggestions.length,
    isOpen,
    initialActiveIndex: 0,
    onSelectIndex: (idx) => {
      const picked = selectableSuggestions[idx];
      if (picked) void selectSuggestion(picked);
    },
    onClose: () => {
      closeDropdown();
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    const el = nav.itemRefs.current[nav.activeIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, nav.activeIndex, nav.itemRefs]);

  useEffect(() => {
    nav.ensureValidActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectableSuggestions.length]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onFocusCapture={() => setHasFocusWithin(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && rootRef.current?.contains(next)) return;
        setHasFocusWithin(false);
      }}
    >
      <div className="relative">
        <Input
          ref={inputRef}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            if (!next.trim()) {
              setSuggestions([]);
              setIsSearching(false);
              setSelectError(null);
              nav.setActiveIndex(0);
              return;
            }
            setIsSearching(true);
            setSelectError(null);
            queueSearch(next);
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            // Space should always type into the input (not select an option).
            if (e.key === ' ' || e.key === 'Spacebar') return;

            if (e.key === 'ArrowDown') {
              if (!isOpen) return;
              e.preventDefault();
              // First ArrowDown from the input moves focus into the active option.
              nav.focusItem(nav.activeIndex);
              return;
            }
            if (e.key === 'ArrowUp') {
              if (!isOpen) return;
              e.preventDefault();
              // ArrowUp from input focuses the last enabled option.
              const last = selectableSuggestions.length - 1;
              nav.setActiveIndex(last);
              nav.focusItem(last);
              return;
            }
            if (e.key === 'Enter' && isOpen) {
              e.preventDefault();
              const picked =
                selectableSuggestions[nav.activeIndex] ?? selectableSuggestions[0];
              if (picked) void selectSuggestion(picked);
              return;
            }
            nav.onKeyDown(e);
          }}
          className="pr-10 bg-parchment-mid border-border/70"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={isOpen ? optionId(nav.activeIndex) : undefined}
        />

        {(isBootstrapping || isSearching) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-border/50 bg-parchment-mid card-elevated">
          <div
            ref={listRef}
            className="max-h-72 overflow-auto"
            role="listbox"
            id={listboxId}
            aria-label="Place suggestions"
          >
            {selectableSuggestions.map((s, idx) => {
              const p = s.placePrediction;
              if (!p) return null;
              const primary = p.mainText?.toString() ?? p.text.toString();
              const secondary = p.secondaryText?.toString();

              return (
              <button
                key={`${p.placeId}-${idx}`}
                type="button"
                ref={(el) => {
                  nav.itemRefs.current[idx] = el;
                }}
                id={optionId(idx)}
                className={[
                  'w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest',
                  idx === nav.activeIndex ? 'bg-parchment-dark/50' : 'hover:bg-parchment-dark/40',
                ].join(' ')}
                onMouseDown={(e) => {
                  // Prevent input blur before we can select.
                  e.preventDefault();
                }}
                onMouseEnter={() => nav.setActiveIndex(idx)}
                onFocus={() => nav.setActiveIndex(idx)}
                onClick={() => void selectSuggestion(s)}
                onKeyDown={nav.onKeyDown}
                role="option"
                aria-selected={idx === nav.activeIndex}
                tabIndex={idx === nav.activeIndex ? 0 : -1}
              >
                <div className="text-sm font-medium text-ink">
                  {primary}
                </div>
                {secondary && (
                  <div className="mt-0.5 text-xs text-ink-light">
                    {secondary}
                  </div>
                )}
              </button>
              );
            })}
          </div>
        </div>
      )}

      {(loadError || selectError) && (
        <div className="mt-2 text-sm text-red-600">{loadError ?? selectError}</div>
      )}
    </div>
  );
}
