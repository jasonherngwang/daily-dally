'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { generateId } from '@/lib/ulid';
import type { Destination } from '@/types/trip';

export interface DiscoverSuggestion {
  candidateId: string;
  placeId: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  detourKm: number;
  insertAfterDestinationId: string;
  whyItFits: string;
}

interface DiscoverResponse {
  suggestions: DiscoverSuggestion[];
}

function hasValidLocation(d: Destination) {
  return (
    d.location != null &&
    Number.isFinite(d.location.lat) &&
    Number.isFinite(d.location.lng)
  );
}

function insertAfterId(
  destinations: Destination[],
  insertAfterDestinationId: string,
  newDestination: Destination
) {
  const idx = destinations.findIndex((d) => d.id === insertAfterDestinationId);
  if (idx === -1) {
    return [...destinations, newDestination];
  }
  const next = [...destinations];
  next.splice(idx + 1, 0, newDestination);
  return next;
}

export function DiscoverPanel({
  tripToken,
  dayId,
  destinations,
  onInsert,
  onPreviewLocationChange,
  open,
  onOpenChange,
  showButton = true,
}: {
  tripToken: string;
  dayId: string;
  destinations: Destination[];
  onInsert: (nextDestinations: Destination[]) => void;
  onPreviewLocationChange?: (location: { lat: number; lng: number } | null) => void;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  showButton?: boolean;
}) {
  const isEligible = useMemo(() => {
    if (!tripToken || !dayId) return false;
    if (destinations.length === 0) return false;
    return destinations.some(hasValidLocation);
  }, [tripToken, dayId, destinations]);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = open != null;
  const isOpen = isControlled ? !!open : uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DiscoverSuggestion[]>([]);

  const LIMIT = 6;

  // Clear map preview when panel closes.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      onPreviewLocationChange?.(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, onPreviewLocationChange]);

  const readNdjsonSuggestions = async (res: Response) => {
    if (!res.body) {
      throw new Error('No response body');
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    setSuggestions([]);

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const trimmed = line.trim();
        if (!trimmed) continue;
        const s = JSON.parse(trimmed) as DiscoverSuggestion;
        setSuggestions((prev) => {
          if (prev.some((p) => p.candidateId === s.candidateId)) return prev;
          return [...prev, s].slice(0, LIMIT);
        });
      }

      if (done) break;
    }
  };

  const runDiscover = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripToken}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayId, limit: LIMIT, stream: true }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || 'Failed to discover suggestions');
      }
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/x-ndjson')) {
        await readNdjsonSuggestions(res);
      } else {
        const data = (await res.json()) as DiscoverResponse;
        setSuggestions((data.suggestions ?? []).slice(0, LIMIT));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to discover suggestions');
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isEligible) return;
    if (!isOpen) return;
    if (suggestions.length > 0) return;
    if (isLoading) return;
    void runDiscover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEligible, isOpen]);

  if (!isEligible) return null;

  return (
    <div className="space-y-2">
      {showButton && (
        <Button
          size="sm"
          variant="secondary"
          className={[
            'w-full gap-2 justify-center min-w-0 sm:flex-1',
            'bg-linear-to-r from-forest to-forest-light text-white',
            'hover:from-forest-light hover:to-forest',
          ].join(' ')}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="min-w-0 whitespace-normal leading-tight">Discover</span>
        </Button>
      )}

      {isOpen && (
        <Card className="bg-forest text-parchment border border-forest/30 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">
              Suggestions
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-parchment border-parchment/30 hover:bg-parchment/10"
              disabled={isLoading}
              onClick={() => void runDiscover()}
            >
              Refresh
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-parchment/80">
              <LoadingSpinner size="sm" />
              Finding great stops nearby…
            </div>
          )}

          {error && (
            <div className="text-sm text-parchment/90">
              {error}
            </div>
          )}

          {!isLoading && !error && suggestions.length === 0 && (
            <div className="text-sm text-parchment/80">
              No suggestions found. Try again after adding more stops.
            </div>
          )}

          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.candidateId}
                className="relative rounded-xl border border-border/50 bg-parchment-mid p-3"
                onMouseEnter={() => onPreviewLocationChange?.(s.location)}
                onMouseLeave={() => onPreviewLocationChange?.(null)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <h3 className="font-display font-semibold text-ink text-base leading-tight break-words">
                      {s.name}
                    </h3>
                    <div className="mt-0.5 text-xs text-ink-light">
                      {s.address}
                    </div>
                    {s.whyItFits && (
                      <div className="mt-1.5 text-sm text-ink-light">
                        {s.whyItFits}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const newDestination: Destination = {
                          id: generateId(),
                          name: s.name,
                          placeId: s.placeId,
                          address: s.address,
                          location: s.location,
                          notes: '',
                        };
                        onInsert(
                          insertAfterId(
                            destinations,
                            s.insertAfterDestinationId,
                            newDestination
                          )
                        );
                        setSuggestions((prev) =>
                          prev.filter((p) => p.candidateId !== s.candidateId)
                        );
                        onPreviewLocationChange?.(null);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

