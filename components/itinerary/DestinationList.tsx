'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragCancelEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DestinationCard } from './DestinationCard';
import type { Destination } from '@/types/trip';
import { useRef } from 'react';

interface DestinationListProps {
  destinations: Destination[];
  onReorder: (destinations: Destination[]) => void;
  onUpdate: (index: number, destination: Destination) => void;
  onDelete: (index: number) => void;
  activeDestinationId?: string;
  onSelectDestination?: (destinationId: string) => void;
  readOnly?: boolean;
}

export function DestinationList({
  destinations,
  onReorder,
  onUpdate,
  onDelete,
  activeDestinationId,
  onSelectDestination,
  readOnly = false,
}: DestinationListProps) {
  const isDraggingRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {
    isDraggingRef.current = true;
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    isDraggingRef.current = false;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    isDraggingRef.current = false;

    if (over && active.id !== over.id) {
      const oldIndex = destinations.findIndex((d) => d.id === active.id);
      const newIndex = destinations.findIndex((d) => d.id === over.id);
      onReorder(arrayMove(destinations, oldIndex, newIndex));
    }
  };

  const validDestinations = destinations.filter((d) => d.id);
  const hasValidLocation = (d: Destination) =>
    d.location != null &&
    Number.isFinite(d.location.lat) &&
    Number.isFinite(d.location.lng);
  
  if (validDestinations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-parchment-dark/50 p-12 sm:p-16 text-center">
        <p className="text-ink-light text-base">No destinations yet. Add one above!</p>
      </div>
    );
  }

  // Only destinations with locations get numbers (and participate in "previous destination" for directions).
  let locationCounter = 0;
  let lastLocationDestination: Destination | undefined;
  const renderItems = validDestinations.map((destination) => {
    const isLocation = hasValidLocation(destination);
    const locationNumber = isLocation ? ++locationCounter : undefined;
    const previousDestination = isLocation ? lastLocationDestination : undefined;
    if (isLocation) {
      lastLocationDestination = destination;
    }
    return { destination, locationNumber, previousDestination };
  });

  if (readOnly) {
    return (
      <div className="flex flex-col">
        {renderItems.map(({ destination, locationNumber, previousDestination }, index) => {
          const isLast = index === validDestinations.length - 1;
          return (
            <div
              id={`destination-${destination.id}`}
              key={destination.id || `destination-${index}`}
              className={isLast ? '' : 'mb-3'}
              onPointerDownCapture={(e) => {
                if (!onSelectDestination) return;
                if (isDraggingRef.current) return;
                const t = e.target as HTMLElement | null;
                // Don't select when interacting with buttons/inputs/links, etc.
                // NOTE: dnd-kit applies `role="button"` to the draggable card; do not treat that as an interactive child.
                if (t?.closest('button, a, input, textarea, select')) return;
                onSelectDestination(destination.id);
              }}
            >
              <DestinationCard
                destination={destination}
                locationNumber={locationNumber}
                previousDestination={previousDestination}
                isActive={destination.id === activeDestinationId}
                readOnly
                onUpdate={() => {}}
                onDelete={() => {}}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={validDestinations.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {renderItems.map(({ destination, locationNumber, previousDestination }, index) => {
            const originalIndex = destinations.findIndex((d) => d.id === destination.id);
            const isLast = index === validDestinations.length - 1;
            return (
              <div 
                id={`destination-${destination.id}`}
                key={destination.id || `destination-${index}`} 
                className={isLast ? '' : 'mb-3'}
                onPointerDownCapture={(e) => {
                  if (!onSelectDestination) return;
                  if (isDraggingRef.current) return;
                  const t = e.target as HTMLElement | null;
                  if (t?.closest('button, a, input, textarea, select')) return;
                  onSelectDestination(destination.id);
                }}
              >
                <DestinationCard
                  destination={destination}
                  locationNumber={locationNumber}
                  previousDestination={previousDestination}
                  isActive={destination.id === activeDestinationId}
                  onUpdate={(updated) => onUpdate(originalIndex, updated)}
                  onDelete={() => onDelete(originalIndex)}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
