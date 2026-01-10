'use client';

import { useState } from 'react';
import { DestinationList } from './DestinationList';
import { AddDestinationForm } from './AddDestinationForm';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/ulid';
import type { Day, Trip } from '@/types/trip';

interface DayEditorProps {
  day: Day;
  trip: Trip;
  onUpdate: (day: Day) => void;
}

export function DayEditor({ day, trip, onUpdate }: DayEditorProps) {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [dayLabel, setDayLabel] = useState(day.label);

  const handleLabelSave = () => {
    if (dayLabel.trim()) {
      onUpdate({ ...day, label: dayLabel.trim() });
      setIsEditingLabel(false);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div>
        {isEditingLabel ? (
          <Input
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelSave();
              if (e.key === 'Escape') {
                setDayLabel(day.label);
                setIsEditingLabel(false);
              }
            }}
            className="text-xl sm:text-2xl font-display font-semibold h-12"
            autoFocus
          />
        ) : (
          <h2
            className="text-xl sm:text-2xl font-display font-semibold text-ink cursor-pointer hover:text-ink-light transition-colors leading-tight"
            onClick={() => setIsEditingLabel(true)}
          >
            {day.label}
          </h2>
        )}
      </div>

      <AddDestinationForm
        locationBias={
          day.destinations.length > 0
            ? day.destinations
                .filter((d) => d.location)
                .slice(-1)[0]?.location
            : undefined
        }
        onAdd={(destination) => {
          onUpdate({
            ...day,
            destinations: [
              ...day.destinations,
              { ...destination, id: generateId() },
            ],
          });
        }}
      />

      <DestinationList
        destinations={day.destinations}
        onReorder={(destinations) => {
          onUpdate({ ...day, destinations });
        }}
        onUpdate={(index, destination) => {
          const updated = [...day.destinations];
          updated[index] = destination;
          onUpdate({ ...day, destinations: updated });
        }}
        onDelete={(index) => {
          const updated = day.destinations.filter((_, i) => i !== index);
          onUpdate({ ...day, destinations: updated });
        }}
      />
    </div>
  );
}
