'use client';

import { LayoutList, Plus } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import type { Day } from '@/types/trip';
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
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DayTabsProps {
  days: Day[];
  activeDayId: string;
  onDaySelect: (dayId: string) => void;
  onTripViewSelect?: () => void;
  tripViewActive?: boolean;
  onAddDay: () => void;
  onReorderDay?: (dayId: string, direction: 'left' | 'right') => void; // Keeping for compatibility, but unused
  onReorderDays?: (days: Day[]) => void;
  readOnly?: boolean;
}

// Sortable Day Tab Component
function SortableDayTab({
  day,
  activeDayId,
  onDaySelect,
  readOnly,
}: {
  day: Day;
  activeDayId: string;
  onDaySelect: (dayId: string) => void;
  readOnly: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: day.id,
    disabled: readOnly,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = day.id === activeDayId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group shrink-0 touch-manipulation"
    >
      <div
        className={`
          flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer
          border
          ${
            isActive
              ? 'bg-forest text-white shadow-sm border-forest/30'
              : 'bg-parchment-mid text-ink hover:bg-parchment border-border/50'
          }
        `}
        onClick={() => onDaySelect(day.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDaySelect(day.id);
          }
        }}
      >
        <span>{day.label}</span>
      </div>
    </div>
  );
}

export function DayTabs({
  days,
  activeDayId,
  onDaySelect,
  onTripViewSelect,
  tripViewActive = false,
  onAddDay,
  onReorderDays,
  readOnly = false,
}: DayTabsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Start dragging after 5px movement
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;

    if (over && active.id !== over.id && onReorderDays) {
      const oldIndex = days.findIndex((d) => d.id === active.id);
      const newIndex = days.findIndex((d) => d.id === over.id);
      onReorderDays(arrayMove(days, oldIndex, newIndex));
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap pb-2">
      {onTripViewSelect && (
        <div className="relative group shrink-0">
          <div
            className={[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer border',
              tripViewActive
                ? 'bg-linear-to-r from-forest to-forest-light text-white shadow-sm border-forest/30'
                : 'bg-parchment-mid text-ink hover:bg-parchment border-border/50',
            ].join(' ')}
            onClick={() => onTripViewSelect()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onTripViewSelect();
              }
            }}
            title="View the full itinerary"
          >
            <LayoutList className="h-4 w-4 shrink-0" />
            <span>Trip</span>
          </div>
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={days.map(d => d.id)} 
          strategy={rectSortingStrategy}
        >
          {days.map((day) => (
            <SortableDayTab
              key={day.id}
              day={day}
              activeDayId={activeDayId}
              onDaySelect={onDaySelect}
              readOnly={readOnly}
            />
          ))}
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onAddDay}
          className="shrink-0 h-8 w-8 rounded-lg border border-border/30 hover:border-border"
          title="Add day"
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}
