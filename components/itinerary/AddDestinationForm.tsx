'use client';

import { useMemo, useState } from 'react';
import { MapPin, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PlaceSearch } from './PlaceSearch';
import type { Destination, PlaceResult } from '@/types/trip';
import { DiscoverPanel } from './DiscoverPanel';

interface AddDestinationFormProps {
  onAdd: (destination: Omit<Destination, 'id'>) => void;
  locationBias?: { lat: number; lng: number };
  discover?: {
    tripToken: string;
    dayId: string;
    destinations: Destination[];
    onInsert: (nextDestinations: Destination[]) => void;
    onPreviewLocationChange?: (location: { lat: number; lng: number } | null) => void;
  };
}

type Mode = 'search' | 'discover' | 'note' | null;

export function AddDestinationForm({
  onAdd,
  locationBias,
  discover,
}: AddDestinationFormProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');

  const handlePlaceSelect = (place: PlaceResult) => {
    onAdd({
      name: place.name,
      placeId: place.placeId,
      address: place.address,
      location: place.location,
      notes: '',
    });
    resetForm();
  };

  const handleNoteAdd = () => {
    if (name.trim()) {
      onAdd({
        name: name.trim(),
        notes: notes.trim(),
      });
      resetForm();
    }
  };

  const resetForm = () => {
    setMode(null);
    setName('');
    setNotes('');
  };

  const canDiscover = useMemo(() => {
    if (!discover) return false;
    if (discover.destinations.length === 0) return false;
    return discover.destinations.some(
      (d) =>
        d.location != null &&
        Number.isFinite(d.location.lat) &&
        Number.isFinite(d.location.lng)
    );
  }, [discover]);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setMode((prev) => (prev === 'search' ? null : 'search'))}
          className="w-full gap-2 justify-center min-w-0 sm:flex-1"
        >
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="min-w-0 whitespace-normal leading-tight">Search</span>
        </Button>

        {canDiscover && (
          <Button
            size="sm"
            variant="secondary"
            className="w-full gap-2 justify-center min-w-0 sm:flex-1"
            onClick={() => setMode((prev) => (prev === 'discover' ? null : 'discover'))}
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="min-w-0 whitespace-normal leading-tight">Discover</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode((prev) => (prev === 'note' ? null : 'note'))}
          className="w-full gap-2 justify-center min-w-0 sm:flex-1"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="min-w-0 whitespace-normal leading-tight">Add Note</span>
        </Button>
      </div>

      {mode === 'search' && (
        <div className="transition-opacity duration-200 ease-out">
          {/* Intentionally no enclosing panel/padding; don't clip results dropdown */}
          <PlaceSearch
            onPlaceSelect={handlePlaceSelect}
            locationBias={locationBias}
            autoFocus
          />
        </div>
      )}

      {discover && (
        <DiscoverPanel
          tripToken={discover.tripToken}
          dayId={discover.dayId}
          destinations={discover.destinations}
          onInsert={discover.onInsert}
          onPreviewLocationChange={discover.onPreviewLocationChange}
          showButton={false}
          open={mode === 'discover'}
          onOpenChange={(open) => setMode(open ? 'discover' : null)}
        />
      )}

      <div
        className={[
          'grid transition-all duration-200 ease-out',
          mode === 'note' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border border-border/50 bg-parchment-mid card-elevated p-4">
            <div className="space-y-3">
              <Input
                placeholder="Title"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={mode === 'note'}
                className="h-9 text-sm"
              />
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleNoteAdd} disabled={!name.trim()}>
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
