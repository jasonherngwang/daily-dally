'use client';

import { useState } from 'react';
import { DestinationList } from './DestinationList';
import { AddDestinationForm } from './AddDestinationForm';
import { Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { generateId } from '@/lib/ulid';
import type { Coordinates, Day, Trip } from '@/types/trip';

interface DayEditorProps {
  tripToken: string;
  day: Day;
  trip: Trip;
  onUpdate: (day: Day) => void;
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

  const handleStartEdit = () => {
    if (readOnly) return;
    setIsEditing(true);
    setEditLabel(day.label);
  };

  const handleSaveEdit = () => {
    if (editLabel.trim() && onRenameDay) {
      onRenameDay(day.id, editLabel.trim());
    }
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
                className="h-8 text-sm font-semibold"
                autoFocus
                disabled={readOnly}
              />
              <IconButton
                variant="ghost"
                size="sm"
                onClick={handleSaveEdit}
                className="h-8 w-8"
                disabled={readOnly}
              >
                <Check className="h-4 w-4" />
              </IconButton>
            </div>
          ) : (
            <div
              className="font-semibold text-ink truncate cursor-pointer hover:text-forest transition-colors"
              onClick={handleStartEdit}
              title={readOnly ? undefined : 'Click to rename'}
            >
              {day.label}
            </div>
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
      />
    </div>
  );
}
