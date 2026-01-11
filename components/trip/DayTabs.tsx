'use client';

import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
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
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface DayTabsProps {
  days: Day[];
  activeDayId: string;
  onDaySelect: (dayId: string) => void;
  onAddDay: () => void;
  onDeleteDay?: (dayId: string) => void;
  onReorderDay?: (dayId: string, direction: 'left' | 'right') => void; // Keeping for compatibility, but unused
  onReorderDays?: (days: Day[]) => void;
  onRenameDay?: (dayId: string, newLabel: string) => void;
  readOnly?: boolean;
}

// Sortable Day Tab Component
function SortableDayTab({
  day,
  activeDayId,
  editingDayId,
  editLabel,
  onDaySelect,
  onDeleteDay,
  onStartEdit,
  onSaveEdit,
  setEditLabel,
  handleKeyDown,
  canDelete,
  readOnly,
}: {
  day: Day;
  activeDayId: string;
  editingDayId: string | null;
  editLabel: string;
  onDaySelect: (dayId: string) => void;
  onDeleteDay?: (dayId: string) => void;
  onStartEdit: (day: Day, e: React.MouseEvent) => void;
  onSaveEdit: (dayId: string) => void;
  setEditLabel: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent, dayId: string) => void;
  canDelete: boolean;
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
    disabled: readOnly || editingDayId === day.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = day.id === activeDayId;
  const isEditing = editingDayId === day.id;
  const isReadOnly = readOnly;

  if (isEditing) {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners}
        className="flex items-center gap-1 bg-parchment-dark rounded-lg p-1 border border-forest relative group flex-shrink-0"
        onPointerDown={(e) => e.stopPropagation()} 
      >
        <Input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, day.id)}
          className="h-6 w-20 text-xs px-2"
          autoFocus
          disabled={isReadOnly}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={() => onSaveEdit(day.id)}
          className="h-6 w-6"
          disabled={isReadOnly}
        >
          <Check className="h-3 w-3" />
        </IconButton>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group flex-shrink-0 touch-manipulation"
    >
      <div
        className={`
          flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer
          ${
            isActive
              ? 'bg-forest text-white shadow-sm'
              : 'bg-parchment-dark text-ink hover:bg-parchment border border-border/30'
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
        <span
          onDoubleClick={(e) => {
            if (isReadOnly) return;
            onStartEdit(day, e);
          }}
          title={isReadOnly ? undefined : 'Double-click to rename'}
        >
          {day.label}
        </span>

        {!isReadOnly && isActive && canDelete && onDeleteDay && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDay(day.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 hover:bg-white/20 rounded transition-colors ml-1"
            title="Delete day"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

export function DayTabs({
  days,
  activeDayId,
  onDaySelect,
  onAddDay,
  onDeleteDay,
  onReorderDays,
  onRenameDay,
  readOnly = false,
}: DayTabsProps) {
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

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

  const handleStartEdit = (day: Day, e: React.MouseEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    setEditingDayId(day.id);
    setEditLabel(day.label);
  };

  const handleSaveEdit = (dayId: string) => {
    if (editLabel.trim() && onRenameDay) {
      onRenameDay(dayId, editLabel.trim());
    }
    setEditingDayId(null);
    setEditLabel('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, dayId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(dayId);
    } else if (e.key === 'Escape') {
      setEditingDayId(null);
      setEditLabel('');
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={days.map(d => d.id)} 
          strategy={horizontalListSortingStrategy}
        >
          {days.map((day) => (
            <SortableDayTab
              key={day.id}
              day={day}
              activeDayId={activeDayId}
              editingDayId={editingDayId}
              editLabel={editLabel}
              onDaySelect={onDaySelect}
              onDeleteDay={onDeleteDay}
              onStartEdit={handleStartEdit}
              onSaveEdit={handleSaveEdit}
              setEditLabel={setEditLabel}
              handleKeyDown={handleKeyDown}
              canDelete={days.length > 1}
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
          className="flex-shrink-0 h-8 w-8 rounded-lg border border-border/30 hover:border-border"
          title="Add day"
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}
