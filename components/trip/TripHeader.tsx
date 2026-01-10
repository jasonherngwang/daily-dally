'use client';

import { useState } from 'react';
import { Copy, Check, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import type { Trip } from '@/types/trip';

interface TripHeaderProps {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
  onDelete: () => void;
}

export function TripHeader({ trip, onUpdate, onDelete }: TripHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tripName, setTripName] = useState(trip.name);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleSave = () => {
    if (tripName.trim()) {
      onUpdate({ ...trip, name: tripName.trim() });
      setIsEditing(false);
    }
  };

  const handleCopy = async () => {
    const url = `${window.location.origin}/trip/${trip.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      onDelete();
    }
    setShowMenu(false);
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') {
                  setTripName(trip.name);
                  setIsEditing(false);
                }
              }}
              className="flex-1 bg-transparent text-xl sm:text-2xl font-display font-bold text-ink focus:outline-none focus:ring-2 focus:ring-forest rounded-lg px-2 py-1"
              autoFocus
            />
          </div>
        ) : (
          <h1
            className="text-xl sm:text-2xl font-display font-bold text-ink cursor-pointer hover:text-ink-light transition-colors leading-tight"
            onClick={() => setIsEditing(true)}
          >
            {trip.name}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </>
          )}
        </Button>

        <div className="relative">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8"
          >
            <MoreVertical className="h-4 w-4" />
          </IconButton>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-parchment-dark card-elevated z-20 overflow-hidden">
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-parchment transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Trip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
