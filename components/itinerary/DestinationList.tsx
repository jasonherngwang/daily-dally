'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DestinationCard } from './DestinationCard';
import type { Destination } from '@/types/trip';

interface DestinationListProps {
  destinations: Destination[];
  onReorder: (destinations: Destination[]) => void;
  onUpdate: (index: number, destination: Destination) => void;
  onDelete: (index: number) => void;
  activeDestinationId?: string;
}

export function DestinationList({
  destinations,
  onReorder,
  onUpdate,
  onDelete,
  activeDestinationId,
}: DestinationListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = destinations.findIndex((d) => d.id === active.id);
      const newIndex = destinations.findIndex((d) => d.id === over.id);
      onReorder(arrayMove(destinations, oldIndex, newIndex));
    }
  };

  const validDestinations = destinations.filter((d) => d.id);
  
  if (validDestinations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-parchment-dark/50 p-12 sm:p-16 text-center">
        <p className="text-ink-light text-base">No destinations yet. Add one above!</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={validDestinations.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col">
          {validDestinations.map((destination, index) => {
            const originalIndex = destinations.findIndex((d) => d.id === destination.id);
            const previousDestination = index > 0 ? validDestinations[index - 1] : undefined;
            const isLast = index === validDestinations.length - 1;
            return (
              <div 
                key={destination.id || `destination-${index}`} 
                className={isLast ? '' : 'mb-3'}
              >
                <DestinationCard
                  destination={destination}
                  index={index}
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
