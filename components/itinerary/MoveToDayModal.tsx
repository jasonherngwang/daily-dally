'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Day } from '@/types/trip';
import { IconButton } from '@/components/ui/IconButton';

export function MoveToDayModal({
  open,
  days,
  currentDayId,
  onClose,
  onSelectDay,
}: {
  open: boolean;
  days: Day[];
  currentDayId: string;
  onClose: () => void;
  onSelectDay: (dayId: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return;
          onClose();
        }}
        onTouchStart={(e) => {
          if (e.target !== e.currentTarget) return;
          onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Move to day"
        className="absolute inset-x-0 bottom-4 sm:top-10 mx-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-border bg-parchment-mid card-elevated-lg overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-parchment-mid px-3 sm:px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">Move to…</div>
            <div className="text-xs text-ink-light">Select a day</div>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            className="h-10 w-10"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="max-h-[65vh] overflow-auto p-2">
          {days.map((day) => {
            const isCurrent = day.id === currentDayId;
            return (
              <button
                key={day.id}
                className={[
                  'w-full text-left rounded-xl border px-3 py-3 transition-colors cursor-pointer',
                  isCurrent
                    ? 'border-border/60 bg-parchment-dark/50 text-ink-light cursor-not-allowed'
                    : 'border-transparent hover:bg-parchment-dark/50 text-ink',
                ].join(' ')}
                disabled={isCurrent}
                onClick={() => onSelectDay(day.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{day.label}</div>
                  {isCurrent && <div className="text-xs">Current</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

