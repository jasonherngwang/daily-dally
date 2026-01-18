'use client';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import type { Day } from '@/types/trip';
import { IconButton } from '@/components/ui/IconButton';
import { useRovingListNavigation } from '@/hooks/useRovingListNavigation';

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();
  const listboxId = `${uid}-movetoday-listbox`;
  const optionId = (idx: number) => `${uid}-movetoday-opt-${idx}`;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const nav = useRovingListNavigation({
    itemCount: days.length,
    isOpen: open && days.length > 0,
    initialActiveIndex: 0,
    getIsItemDisabled: (idx) => days[idx]?.id === currentDayId,
    onSelectIndex: (idx) => {
      const day = days[idx];
      if (!day) return;
      if (day.id === currentDayId) return;
      onSelectDay(day.id);
    },
    onClose: onClose,
    loop: true,
  });

  useEffect(() => {
    if (!open) return;
    // Focus the first enabled day for immediate keyboard use.
    const first = nav.firstEnabledIndex();
    if (first >= 0) {
      nav.setActiveIndex(first);
      setTimeout(() => nav.focusItem(first), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, days.length, currentDayId]);

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
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="Move to day"
        className="absolute inset-x-0 bottom-4 sm:top-10 mx-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-border bg-parchment-mid card-elevated-lg overflow-hidden"
        onKeyDown={(e) => {
          const activeEl = document.activeElement;
          if (activeEl && !rootRef.current?.contains(activeEl)) return;
          nav.onKeyDown(e);
        }}
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

        <div
          className="max-h-[65vh] overflow-auto p-2"
          role="listbox"
          id={listboxId}
          aria-label="Days"
        >
          {days.map((day, idx) => {
            const isCurrent = day.id === currentDayId;
            const isActive = idx === nav.activeIndex;
            return (
              <button
                key={day.id}
                ref={(el) => {
                  nav.itemRefs.current[idx] = el;
                }}
                id={optionId(idx)}
                className={[
                  'w-full text-left rounded-xl border px-3 py-3 transition-colors cursor-pointer',
                  isCurrent
                    ? 'border-border/60 bg-parchment-dark/50 text-ink-light cursor-not-allowed'
                    : 'border-transparent hover:bg-parchment-dark/50 text-ink',
                  !isCurrent && isActive ? 'ring-2 ring-forest/30 ring-inset' : '',
                ].join(' ')}
                disabled={isCurrent}
                onMouseEnter={() => nav.setActiveIndex(idx)}
                onFocus={() => nav.setActiveIndex(idx)}
                onKeyDown={nav.onKeyDown}
                onClick={() => onSelectDay(day.id)}
                role="option"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
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

