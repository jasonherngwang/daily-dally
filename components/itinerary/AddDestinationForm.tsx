'use client';

import { useState } from 'react';
import { MapPin, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { PlaceSearch } from './PlaceSearch';
import { generateId } from '@/lib/ulid';
import type { Destination, PlaceResult } from '@/types/trip';

interface AddDestinationFormProps {
  onAdd: (destination: Omit<Destination, 'id'>) => void;
  locationBias?: { lat: number; lng: number };
}

type Mode = 'search' | 'note' | null;

export function AddDestinationForm({ onAdd, locationBias }: AddDestinationFormProps) {
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

  if (mode === null) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMode('search')}
          className="w-full gap-2 justify-center"
        >
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <span>Search for a place</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode('note')}
          className="w-full gap-2 justify-center"
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span>Add a note</span>
        </Button>
      </div>
    );
  }

  if (mode === 'search') {
    return (
      <div className="space-y-3">
        <PlaceSearch onPlaceSelect={handlePlaceSelect} locationBias={locationBias} />
        <Button variant="ghost" size="sm" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-parchment-dark card-elevated p-4">
      <Input
        placeholder="Destination name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
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
        <Button
          size="sm"
          onClick={handleNoteAdd}
          disabled={!name.trim()}
        >
          Add Note
        </Button>
        <Button variant="ghost" size="sm" onClick={resetForm}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
