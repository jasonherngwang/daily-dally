'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Edit2, Trash2, Navigation, FileText, MoreVertical, ArrowLeftRight } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { getGoogleMapsNavigationUrl } from '@/lib/navigation';
import type { Destination } from '@/types/trip';

const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
const TRAILING_PUNCT = new Set([',', '.', ';', ':', '!', '?', ')', ']', '}', '"', "'"]);

function splitTrailingPunctuation(raw: string): { urlPart: string; trailing: string } {
  let urlPart = raw;
  let trailing = '';

  while (urlPart.length > 0 && TRAILING_PUNCT.has(urlPart[urlPart.length - 1]!)) {
    trailing = urlPart[urlPart.length - 1]! + trailing;
    urlPart = urlPart.slice(0, -1);
  }

  return { urlPart, trailing };
}

function renderTextWithLinks(text: string): ReactNode {
  const parts = text.split(URL_REGEX);
  return parts.map((part, idx) => {
    // With a capturing group, split() includes matches at odd indices.
    const isMatch = idx % 2 === 1;
    if (!isMatch) return <span key={idx}>{part}</span>;

    const { urlPart, trailing } = splitTrailingPunctuation(part);
    if (!urlPart) return <span key={idx}>{part}</span>;

    const href = urlPart.startsWith('http://') || urlPart.startsWith('https://')
      ? urlPart
      : `https://${urlPart}`;

    return (
      <span key={idx}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-forest hover:text-forest-light underline underline-offset-2"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {urlPart}
        </a>
        {trailing}
      </span>
    );
  });
}

interface DestinationCardProps {
  destination: Destination;
  locationNumber?: number;
  isActive?: boolean;
  readOnly?: boolean;
  onUpdate: (updated: Destination) => void;
  onDelete: () => void;
  onMove?: () => void;
}

export function DestinationCard({
  destination,
  locationNumber,
  isActive,
  readOnly = false,
  onUpdate,
  onDelete,
  onMove,
}: DestinationCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(destination.name);
  const [notes, setNotes] = useState(destination.notes);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const hasLocation = !!destination.location;
  const navigationUrl = hasLocation ? getGoogleMapsNavigationUrl(destination) : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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
        flex items-start gap-2 sm:gap-3 ${!readOnly ? 'sm:cursor-grab sm:active:cursor-grabbing touch-manipulation' : ''}
        ${isActive ? 'ring-2 ring-forest ring-inset card-elevated-lg' : ''}
        ${isDragging ? 'shadow-lg' : ''}
        overflow-visible
        transition-colors duration-200
      `}
    >
      {/* Number badge */}
      <div
        className={`
          flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold
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
              className="font-semibold text-base h-9"
            />
            {destination.address && (
              <p className="text-xs text-ink wrap-break-word">{destination.address}</p>
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
                <h3 className="font-semibold text-ink text-base leading-tight wrap-break-word">{destination.name}</h3>
                {destination.address && (
                  <p className="mt-0.5 text-xs text-ink wrap-break-word">
                    {destination.address}
                  </p>
                )}
                {destination.notes && !destination.address && (
                  <p className="mt-1 text-xs text-ink whitespace-pre-wrap leading-relaxed wrap-break-word">
                    {renderTextWithLinks(destination.notes)}
                  </p>
                )}
              </div>
              
              <div 
                className="flex items-center gap-0.5 shrink-0"
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
                      className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-terracotta/10"
                      title="Edit"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </IconButton>

                    <div className="relative" ref={menuRef}>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-terracotta/10"
                        title="More actions"
                        aria-label="More actions"
                        aria-expanded={menuOpen}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </IconButton>

                      {menuOpen && (
                        <div
                          className="absolute right-0 top-9 z-50 w-44 rounded-xl border border-border/70 bg-parchment-mid card-elevated overflow-hidden"
                          role="menu"
                          onPointerDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                        >
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-parchment-dark/70 transition-colors flex items-center gap-2"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              onMove?.();
                            }}
                          >
                            <ArrowLeftRight className="h-4 w-4 text-ink-light" />
                            <span>Move to…</span>
                          </button>

                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-parchment-dark/70 transition-colors flex items-center gap-2"
                            role="menuitem"
                            onClick={() => {
                              setMenuOpen(false);
                              onDelete();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-700" />
                            <span className="text-red-700">Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {destination.notes && destination.address && (
              <div className="mt-2 pt-2 border-t border-border/80">
                <p className="text-xs text-ink whitespace-pre-wrap leading-relaxed wrap-break-word">
                  {renderTextWithLinks(destination.notes)}
                </p>
              </div>
            )}

          </>
        )}
      </div>
    </Card>
  );
}
