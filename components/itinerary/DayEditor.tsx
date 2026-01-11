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
  readOnly?: boolean;
}

export function DayEditor({ day, trip, onUpdate, readOnly = false }: DayEditorProps) {
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
      {!readOnly && (
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
      )}

      <DestinationList
        destinations={day.destinations}
        readOnly={readOnly}
        onReorder={(destinations) => {
          if (readOnly) return;
          onUpdate({ ...day, destinations });
        }}
        onUpdate={(index, destination) => {
          if (readOnly) return;
          const updated = [...day.destinations];
          updated[index] = destination;
          onUpdate({ ...day, destinations: updated });
        }}
        onDelete={(index) => {
          if (readOnly) return;
          const updated = day.destinations.filter((_, i) => i !== index);
          onUpdate({ ...day, destinations: updated });
        }}
      />
    </div>
  );
}
