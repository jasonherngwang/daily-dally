'use client';

import { useState } from 'react';
import { GripVertical, Edit2, Trash2, Navigation, FileText } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { getGoogleMapsNavigationUrl, getGoogleMapsDirectionsUrl } from '@/lib/navigation';
import type { Destination } from '@/types/trip';

interface DestinationCardProps {
  destination: Destination;
  locationNumber?: number;
  previousDestination?: Destination;
  isActive?: boolean;
  readOnly?: boolean;
  onUpdate: (updated: Destination) => void;
  onDelete: () => void;
}

export function DestinationCard({
  destination,
  locationNumber,
  previousDestination,
  isActive,
  readOnly = false,
  onUpdate,
  onDelete,
}: DestinationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(destination.name);
  const [notes, setNotes] = useState(destination.notes);

  const hasLocation = !!destination.location;
  const navigationUrl = hasLocation ? getGoogleMapsNavigationUrl(destination) : null;
  const directionsUrl = previousDestination && hasLocation && previousDestination.location
    ? getGoogleMapsDirectionsUrl(previousDestination, destination)
    : null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: destination.id,
    disabled: isEditing || readOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    if (readOnly) return;
    if (name.trim()) {
      onUpdate({
        ...destination,
        name: name.trim(),
        notes: notes.trim(),
      });
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setName(destination.name);
    setNotes(destination.notes);
    setIsEditing(false);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        flex items-start gap-2 sm:gap-3 sm:cursor-grab sm:active:cursor-grabbing touch-manipulation
        ${isActive ? 'border-2 border-terracotta card-elevated-lg' : ''}
        ${!hasLocation ? 'opacity-80' : ''}
        ${isDragging ? 'shadow-lg' : ''}
        transition-colors duration-200
      `}
    >
      {/* Drag handle - hidden on mobile */}
      <div className="hidden sm:block mt-1 text-ink-light p-1">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Number badge */}
      <div
        className={`
          flex h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold
          ${hasLocation ? 'bg-terracotta text-white shadow-sm' : 'bg-border/60 text-ink-light'}
        `}
      >
        {hasLocation ? (
          locationNumber
        ) : (
          <FileText className="h-3.5 w-3.5" aria-label="Note" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div 
            className="space-y-2"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Destination name"
              className="font-semibold text-sm h-9"
            />
            {destination.address && (
              <p className="text-xs text-ink-light truncate">{destination.address}</p>
            )}
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-ink text-sm leading-tight">{destination.name}</h3>
                {destination.address && (
                  <p className="mt-0.5 text-xs text-ink-light truncate sm:whitespace-normal sm:line-clamp-2">
                    {destination.address}
                  </p>
                )}
              </div>
              
              <div 
                className="flex items-center gap-0.5 flex-shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {navigationUrl && (
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(navigationUrl, '_blank')}
                    className="h-7 w-7 sm:h-8 sm:w-8 text-forest hover:bg-forest/10"
                    title="Navigate here"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                  </IconButton>
                )}
                {!readOnly && (
                  <>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={onDelete}
                      className="h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </>
                )}
              </div>
            </div>

            {destination.notes && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-ink-light whitespace-pre-wrap leading-relaxed bg-parchment/50 rounded-md px-2.5 py-2">
                  {destination.notes}
                </p>
              </div>
            )}

            {directionsUrl && (
              <button
                onClick={() => window.open(directionsUrl, '_blank')}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="mt-2 text-xs text-forest hover:text-forest-light flex items-center gap-1.5 transition-colors"
              >
                <Navigation className="h-3 w-3" />
                <span>Directions from {previousDestination?.name || 'previous'}</span>
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
