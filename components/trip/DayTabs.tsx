'use client';

import { useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Edit2, Check } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import type { Day } from '@/types/trip';

interface DayTabsProps {
  days: Day[];
  activeDayId: string;
  onDaySelect: (dayId: string) => void;
  onAddDay: () => void;
  onDeleteDay?: (dayId: string) => void;
  onReorderDay?: (dayId: string, direction: 'left' | 'right') => void;
  onRenameDay?: (dayId: string, newLabel: string) => void;
}

export function DayTabs({
  days,
  activeDayId,
  onDaySelect,
  onAddDay,
  onDeleteDay,
  onReorderDay,
  onRenameDay,
}: DayTabsProps) {
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleStartEdit = (day: Day, e: React.MouseEvent) => {
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
      {days.map((day, index) => {
        const isActive = day.id === activeDayId;
        const isEditing = editingDayId === day.id;
        const canMoveLeft = index > 0;
        const canMoveRight = index < days.length - 1;
        const canDelete = days.length > 1;

        return (
          <div key={day.id} className="relative group flex-shrink-0">
            {isEditing ? (
              <div className="flex items-center gap-1 bg-parchment-dark rounded-lg p-1 border border-forest">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, day.id)}
                  className="h-6 w-20 text-xs px-2"
                  autoFocus
                />
                <IconButton
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSaveEdit(day.id)}
                  className="h-6 w-6"
                >
                  <Check className="h-3 w-3" />
                </IconButton>
              </div>
            ) : (
              <div
                className={`
                  flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer
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
                {isActive && canMoveLeft && onReorderDay && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderDay(day.id, 'left');
                    }}
                    className="p-0.5 hover:bg-white/20 rounded transition-colors"
                    title="Move left"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                )}

                <span
                  onDoubleClick={(e) => handleStartEdit(day, e)}
                  title="Double-click to rename"
                >
                  {day.label}
                </span>

                {isActive && canMoveRight && onReorderDay && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderDay(day.id, 'right');
                    }}
                    className="p-0.5 hover:bg-white/20 rounded transition-colors"
                    title="Move right"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}

                {isActive && canDelete && onDeleteDay && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDay(day.id);
                    }}
                    className="p-0.5 hover:bg-white/20 rounded transition-colors ml-1"
                    title="Delete day"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <IconButton
        variant="ghost"
        size="sm"
        onClick={onAddDay}
        className="flex-shrink-0 h-8 w-8 rounded-lg border border-border/30 hover:border-border"
        title="Add day"
      >
        <Plus className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
