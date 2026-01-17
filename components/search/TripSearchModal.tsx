'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Fuse from 'fuse.js';
import { FileText, MapPin, Search, X } from 'lucide-react';
import type { Trip } from '@/types/trip';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';

type TripSearchDoc = {
  tripId: string;
  tripName: string;
  dayId: string;
  dayIndex: number;
  dayLabel: string;
  destinationId: string;
  name: string;
  address?: string;
  notes: string;
  hasLocation: boolean;
};

export type TripSearchSelection = {
  dayId: string;
  dayIndex: number;
  destinationId: string;
};

function isEditableElement(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return (el as HTMLElement).isContentEditable === true;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function renderHighlightedText(text: string, ranges: Array<[number, number]>) {
  if (!text) return null;
  if (!ranges || ranges.length === 0) return <>{text}</>;

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1] + 1) merged.push([s, e]);
    else last[1] = Math.max(last[1], e);
  }

  const out: React.ReactNode[] = [];
  let idx = 0;
  merged.forEach(([s, e], i) => {
    if (idx < s) out.push(<span key={`t-${i}-a`}>{text.slice(idx, s)}</span>);
    out.push(
      <span
        key={`t-${i}-b`}
        className="rounded bg-forest/15 px-1 text-ink"
      >
        {text.slice(s, e + 1)}
      </span>
    );
    idx = e + 1;
  });
  if (idx < text.length) out.push(<span key="t-end">{text.slice(idx)}</span>);
  return <>{out}</>;
}

function buildSnippet(text: string, firstRange?: [number, number]) {
  const t = text ?? '';
  if (!t) return null;
  if (!firstRange) {
    const trimmed = t.trim();
    return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
  }
  const [s, e] = firstRange;
  const before = Math.max(0, s - 60);
  const after = Math.min(t.length, e + 1 + 60);
  const prefix = before > 0 ? '…' : '';
  const suffix = after < t.length ? '…' : '';
  const slice = t.slice(before, after);
  const localStart = s - before;
  const localEnd = e - before;
  return {
    prefix,
    before: slice.slice(0, localStart),
    match: slice.slice(localStart, localEnd + 1),
    after: slice.slice(localEnd + 1),
    suffix,
  };
}

export function TripSearchModal({
  open,
  trip,
  onClose,
  onSelect,
}: {
  open: boolean;
  trip: Trip;
  onClose: () => void;
  onSelect: (selection: TripSearchSelection) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const docs: TripSearchDoc[] = useMemo(() => {
    const out: TripSearchDoc[] = [];
    trip.days.forEach((day, dayIndex) => {
      day.destinations.forEach((d) => {
        out.push({
          tripId: trip.id,
          tripName: trip.name,
          dayId: day.id,
          dayIndex,
          dayLabel: day.label,
          destinationId: d.id,
          name: d.name,
          address: d.address,
          notes: d.notes ?? '',
          hasLocation:
            d.location != null &&
            Number.isFinite(d.location.lat) &&
            Number.isFinite(d.location.lng),
        });
      });
    });
    return out;
  }, [trip]);

  const fuse = useMemo(() => {
    return new Fuse(docs, {
      includeMatches: true,
      includeScore: true,
      threshold: 0.38,
      ignoreLocation: true,
      keys: [
        { name: 'name', weight: 0.55 },
        { name: 'notes', weight: 0.25 },
        { name: 'address', weight: 0.12 },
        { name: 'dayLabel', weight: 0.06 },
        { name: 'tripName', weight: 0.02 },
      ],
    });
  }, [docs]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return fuse.search(q, { limit: 50 });
  }, [fuse, query]);

  useEffect(() => {
    if (!open) return;
    // Focus after paint.
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

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
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Keep keyboard navigation scoped to when focus is within modal.
      const activeEl = document.activeElement;
      if (activeEl && !document.getElementById('trip-search-modal')?.contains(activeEl)) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => clamp(i + 1, 0, Math.max(0, results.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => clamp(i - 1, 0, Math.max(0, results.length - 1)));
      } else if (e.key === 'Enter') {
        if (results.length === 0) return;
        if (isEditableElement(activeEl) || activeEl === inputRef.current) {
          e.preventDefault();
          const picked = results[clamp(activeIndex, 0, results.length - 1)];
          if (!picked) return;
          onSelect({
            dayId: picked.item.dayId,
            dayIndex: picked.item.dayIndex,
            destinationId: picked.item.destinationId,
          });
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, onSelect, results, activeIndex]);

  if (!open) return null;

  const countLabel = query.trim()
    ? `${results.length} result${results.length === 1 ? '' : 's'}`
    : 'Search your trip';

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
        id="trip-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search trip"
        className="absolute inset-x-0 top-4 sm:top-10 mx-auto w-[min(720px,calc(100vw-2rem))] rounded-2xl border border-border bg-parchment-mid card-elevated-lg overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-border/60 bg-parchment-mid px-3 sm:px-4 py-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-light" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search destinations, notes, addresses…"
              className="h-10 pl-10 pr-3"
            />
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

        <div className="px-3 sm:px-4 py-2 text-xs text-ink-light flex items-center justify-between">
          <div>{countLabel}</div>
          <div className="hidden sm:block font-mono">Esc</div>
        </div>

        <div className="max-h-[65vh] overflow-auto px-2 pb-2">
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-10 text-center text-ink-light text-sm">
              No matches found.
            </div>
          )}

          {!query.trim() && (
            <div className="px-3 py-10 text-center text-ink-light text-sm">
              Type to search across all days and notes.
            </div>
          )}

          {results.map((r, idx) => {
            const isActive = idx === clamp(activeIndex, 0, Math.max(0, results.length - 1));
            const matches = r.matches ?? [];
            const nameMatch = matches.find((m) => m.key === 'name');
            const notesMatch = matches.find((m) => m.key === 'notes');
            const addressMatch = matches.find((m) => m.key === 'address');

            const bestNotesRange = notesMatch?.indices?.[0] as [number, number] | undefined;
            const snippet = buildSnippet(r.item.notes ?? '', bestNotesRange);

            return (
              <button
                key={`${r.item.dayId}:${r.item.destinationId}`}
                className={[
                  'w-full text-left rounded-xl border border-transparent px-3 py-3 hover:bg-parchment-dark/50 transition-colors cursor-pointer',
                  isActive ? 'border-forest/30 bg-parchment-dark/70' : '',
                ].join(' ')}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() =>
                  onSelect({
                    dayId: r.item.dayId,
                    dayIndex: r.item.dayIndex,
                    destinationId: r.item.destinationId,
                  })
                }
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-ink-light">
                    {r.item.hasLocation ? (
                      <MapPin className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink leading-tight wrap-break-word">
                      {renderHighlightedText(
                        r.item.name || '(Untitled)',
                        (nameMatch?.indices ?? []) as Array<[number, number]>
                      )}
                    </div>

                    <div className="mt-0.5 text-xs text-ink-light truncate">
                      Day {r.item.dayIndex + 1} · {r.item.dayLabel}
                      {r.item.address ? ` · ${r.item.address}` : ''}
                      {!r.item.address && addressMatch?.value
                        ? ` · ${addressMatch.value}`
                        : ''}
                    </div>

                    {snippet && typeof snippet === 'string' && (
                      <div className="mt-2 text-xs text-ink whitespace-pre-wrap wrap-break-word">
                        {snippet}
                      </div>
                    )}

                    {snippet && typeof snippet !== 'string' && (
                      <div className="mt-2 text-xs text-ink whitespace-pre-wrap wrap-break-word">
                        <span className="text-ink-light">{snippet.prefix}</span>
                        <span>{snippet.before}</span>
                        <span className="rounded bg-forest/15 px-1">{snippet.match}</span>
                        <span>{snippet.after}</span>
                        <span className="text-ink-light">{snippet.suffix}</span>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

