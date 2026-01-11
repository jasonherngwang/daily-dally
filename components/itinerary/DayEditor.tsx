'use client';

import { DestinationList } from './DestinationList';
import { AddDestinationForm } from './AddDestinationForm';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { generateId } from '@/lib/ulid';
import type { Day, Trip } from '@/types/trip';

interface DayEditorProps {
  day: Day;
  trip: Trip;
  onUpdate: (day: Day) => void;
  onDeleteDay?: (dayId: string) => void;
  readOnly?: boolean;
}

export function DayEditor({
  day,
  trip,
  onUpdate,
  onDeleteDay,
  readOnly = false,
}: DayEditorProps) {
  const canDeleteDay = !readOnly && trip.days.length > 1 && !!onDeleteDay;

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-xs text-ink-light">Day</div>
          <div className="font-semibold text-ink truncate">{day.label}</div>
        </div>

        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-red-600 hover:text-red-700"
            disabled={!canDeleteDay}
            onClick={() => onDeleteDay?.(day.id)}
            title={
              trip.days.length <= 1
                ? 'You need at least one day in a trip'
                : 'Delete this day'
            }
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete day</span>
          </Button>
        )}
      </div>

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
