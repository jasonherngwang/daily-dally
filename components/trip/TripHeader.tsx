'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  Eye,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { TopoLogo } from '@/components/brand/TopoLogo';
import type { Trip } from '@/types/trip';
import { clearRecentTrips, getRecentTrips, removeRecentTrip, type RecentTrip } from '@/lib/recents';

interface TripHeaderProps {
  trip: Trip;
  accessRole: 'view' | 'edit';
  tripToken: string;
  tokens?: {
    viewToken?: string;
    editToken?: string;
  };
  onUpdate: (trip: Trip) => void;
  onDelete: () => void;
}

export function TripHeader({
  trip,
  accessRole,
  tripToken,
  tokens,
  onUpdate,
  onDelete,
}: TripHeaderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tripName, setTripName] = useState(trip.name);
  const [copiedKey, setCopiedKey] = useState<'view' | 'edit' | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>(() => getRecentTrips());

  const isReadOnly = accessRole !== 'edit';
  const viewToken = tokens?.viewToken;
  const editToken = tokens?.editToken || tripToken;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('dailyDally.recentTrips')) {
        setRecentTrips(getRecentTrips());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const menuRecents = useMemo(
    () => recentTrips.filter((t) => t.token !== tripToken).slice(0, 8),
    [recentTrips, tripToken]
  );

  const handleSave = () => {
    if (isReadOnly) return;
    if (tripName.trim()) {
      onUpdate({ ...trip, name: tripName.trim() });
      setIsEditing(false);
    }
  };

  const handleCopy = async (kind: 'view' | 'edit') => {
    const token = kind === 'view' ? viewToken : editToken;
    if (!token) return;
    const url = `${window.location.origin}/trip/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedKey(kind);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDelete = () => {
    if (isReadOnly) return;
    if (confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      onDelete();
    }
    setShowMenu(false);
  };

  const handleCopyTripLink = async (token: string) => {
    const url = `${window.location.origin}/trip/${token}`;
    await navigator.clipboard.writeText(url);
  };

  const handleCloneTrip = async () => {
    if (isCloning) return;
    setIsCloning(true);
    try {
      const response = await fetch(`/api/trips/${tripToken}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to clone trip');

      const data = (await response.json()) as {
        tokens?: { editToken?: string };
      };
      const editToken = data.tokens?.editToken;
      if (!editToken) throw new Error('Clone succeeded but no edit token returned');

      window.open(`/trip/${editToken}`, '_blank', 'noopener,noreferrer');
      setShowMenu(false);
    } catch (e) {
      console.error(e);
      alert('Could not clone this trip. Please try again.');
    } finally {
      setIsCloning(false);
    }
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
              className="flex-1 bg-transparent text-xl sm:text-2xl font-display font-bold text-ink focus:outline-none focus:ring-2 focus:ring-forest rounded-lg px-2 py-1 leading-tight"
              autoFocus
            />
            {isReadOnly && <Badge variant="warning">Read-only</Badge>}
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/"
              className="shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
              title="Home"
              aria-label="Home"
            >
              <TopoLogo className="h-9 w-9" />
            </Link>
            <h1
              className={[
                'text-xl sm:text-2xl font-display font-bold text-ink leading-tight truncate px-2 py-1',
                isReadOnly
                  ? 'cursor-default'
                  : 'cursor-pointer hover:text-ink-light transition-colors',
              ].join(' ')}
              onClick={() => {
                if (!isReadOnly) setIsEditing(true);
              }}
              title={trip.name}
            >
              {trip.name}
            </h1>
            {isReadOnly && <Badge variant="warning">Read-only</Badge>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShare((v) => !v)}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {showShare && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowShare(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-parchment-mid card-elevated z-20 overflow-hidden">
                <button
                  onClick={() => handleCopy('view')}
                  disabled={!viewToken}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-parchment transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copiedKey === 'view' ? (
                    <Check className="h-4 w-4 text-forest" />
                  ) : (
                    <Eye className="h-4 w-4 text-ink-light" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-ink">Copy view-only link</div>
                    <div className="text-xs text-ink-light truncate">
                      {viewToken ? 'Anyone with this link can view' : 'Unavailable'}
                    </div>
                  </div>
                </button>

                {!isReadOnly && (
                  <button
                    onClick={() => handleCopy('edit')}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-parchment transition-colors cursor-pointer"
                  >
                    {copiedKey === 'edit' ? (
                      <Check className="h-4 w-4 text-forest" />
                    ) : (
                      <Pencil className="h-4 w-4 text-ink-light" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-ink">Copy editable link</div>
                      <div className="text-xs text-ink-light truncate">
                        Anyone with this link can edit
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <IconButton
            variant="ghost"
            size="sm"
            onClick={() => setShowMenu(!showMenu)}
            className="h-8 w-8"
            title="Menu"
          >
            <MoreVertical className="h-4 w-4" />
          </IconButton>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-parchment-mid card-elevated z-20 overflow-hidden">
                <div className="px-4 pt-3 pb-2 text-xs font-semibold text-ink-light uppercase tracking-wide">
                  Recent trips
                </div>

                {menuRecents.length === 0 ? (
                  <div className="px-4 pb-3 text-sm text-ink-light">
                    No recent trips yet.
                  </div>
                ) : (
                  <div className="pb-1">
                    {menuRecents.map((t) => (
                      <div
                        key={t.token}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-parchment transition-colors"
                      >
                        <button
                          className="flex-1 min-w-0 text-left cursor-pointer"
                          onClick={() => {
                            setShowMenu(false);
                            router.push(`/trip/${t.token}`);
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="text-sm text-ink truncate">{t.name}</div>
                            <Badge variant={t.accessRole === 'edit' ? 'success' : 'default'}>
                              {t.accessRole === 'edit' ? 'Editable' : 'View'}
                            </Badge>
                          </div>
                          <div className="text-xs text-ink-light truncate">
                            Last opened {new Date(t.lastOpenedAt).toLocaleString()}
                          </div>
                        </button>

                        <button
                          className="p-1 rounded hover:bg-parchment-mid cursor-pointer"
                          title="Copy link"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleCopyTripLink(t.token);
                          }}
                        >
                          <Copy className="h-4 w-4 text-ink-light" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-parchment-mid cursor-pointer"
                          title="Remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentTrip(t.token);
                            setRecentTrips(getRecentTrips());
                          }}
                        >
                          <X className="h-4 w-4 text-ink-light" />
                        </button>
                      </div>
                    ))}

                    <button
                      className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink-light hover:bg-parchment transition-colors cursor-pointer"
                      onClick={() => {
                        clearRecentTrips();
                        setRecentTrips([]);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Clear recents
                    </button>
                  </div>
                )}

                <div className="h-px bg-border/60" />
                <button
                  onClick={handleCloneTrip}
                  disabled={isCloning}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-parchment transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="h-4 w-4" />
                  {isCloning ? 'Cloning…' : 'Clone trip'}
                </button>

                {!isReadOnly && (
                  <>
                    <div className="h-px bg-border/60" />
                    <button
                      onClick={handleDelete}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-600 hover:bg-parchment transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Trip
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
