'use client';

import { useState } from 'react';
import { DestinationList } from './DestinationList';
import { AddDestinationForm } from './AddDestinationForm';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/ulid';
import { MoveToDayModal } from '@/components/itinerary/MoveToDayModal';
import type { Coordinates, Day, Trip } from '@/types/trip';

interface DayEditorProps {
  tripToken: string;
  day: Day;
  trip: Trip;
  onUpdate: (day: Day) => void;
  onMoveDestination: (fromDayId: string, destinationId: string, toDayId: string) => void;
  onDeleteDay?: (dayId: string) => void;
  onRenameDay?: (dayId: string, newLabel: string) => void;
  onPreviewLocationChange?: (location: Coordinates | null) => void;
  activeDestinationId?: string;
  onSelectDestination?: (destinationId: string) => void;
  readOnly?: boolean;
}

export function DayEditor({
  tripToken,
  day,
  trip,
  onUpdate,
  onMoveDestination,
  onDeleteDay,
  onRenameDay,
  onPreviewLocationChange,
  activeDestinationId,
  onSelectDestination,
  readOnly = false,
}: DayEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const canDeleteDay = !readOnly && trip.days.length > 1 && !!onDeleteDay;
  const [moveDestinationId, setMoveDestinationId] = useState<string | null>(null);

  const handleStartEdit = () => {
    if (readOnly) return;
    setIsEditing(true);
    setEditLabel(day.label);
  };

  const handleSaveEdit = () => {
    if (readOnly) return;
    const next = editLabel.trim();
    if (!next) {
      setIsEditing(false);
      setEditLabel(day.label);
      return;
    }
    onRenameDay?.(day.id, next);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditLabel(day.label);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveEdit}
                className="h-9 bg-transparent border-transparent px-2 py-1 text-lg sm:text-xl font-display font-semibold leading-tight focus-visible:ring-offset-parchment"
                autoFocus
                disabled={readOnly}
              />
            </div>
          ) : (
            <button
              type="button"
              className={[
                // Match TripHeader title inset so entering edit mode doesn't feel like the text moved.
                'h-9 font-display font-semibold text-lg sm:text-xl text-ink truncate text-left px-2 py-1 border border-transparent rounded-xl leading-tight',
                readOnly
                  ? 'cursor-default'
                  : 'cursor-pointer hover:text-forest transition-colors',
              ].join(' ')}
              onClick={handleStartEdit}
              title={readOnly ? undefined : 'Click to rename'}
              disabled={readOnly}
            >
              {day.label}
            </button>
          )}
        </div>

        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-ink-light hover:text-red-700 focus-visible:text-red-700 active:text-red-700"
            disabled={!canDeleteDay}
            onClick={() => {
              if (!canDeleteDay) return;
              const ok = confirm(
                `Delete ${day.label}? This will remove the entire day and its destinations. This action cannot be undone.`
              );
              if (!ok) return;
              onDeleteDay?.(day.id);
            }}
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
          discover={{
            tripToken,
            dayId: day.id,
            destinations: day.destinations,
            onPreviewLocationChange,
            onInsert: (nextDestinations) => {
              if (readOnly) return;
              onUpdate({ ...day, destinations: nextDestinations });
            },
          }}
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
        activeDestinationId={activeDestinationId}
        onSelectDestination={onSelectDestination}
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
        onMove={(destinationId) => {
          if (readOnly) return;
          setMoveDestinationId(destinationId);
        }}
      />

      <MoveToDayModal
        open={!readOnly && moveDestinationId != null}
        days={trip.days}
        currentDayId={day.id}
        onClose={() => setMoveDestinationId(null)}
        onSelectDay={(toDayId) => {
          if (readOnly) return;
          const destinationId = moveDestinationId;
          if (!destinationId) return;
          setMoveDestinationId(null);
          onMoveDestination(day.id, destinationId, toDayId);
        }}
      />
    </div>
  );
}
