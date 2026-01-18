'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Copy,
  Eye,
  Home,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
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
  onOpenSearch?: () => void;
}

export function TripHeader({
  trip,
  accessRole,
  tripToken,
  tokens,
  onUpdate,
  onDelete,
  onOpenSearch,
}: TripHeaderProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [tripName, setTripName] = useState(trip.name);
  const [copiedKey, setCopiedKey] = useState<'view' | 'edit' | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>(() => getRecentTrips());
  const shareMenuRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const focusableButtons = (root: HTMLElement | null) => {
    if (!root) return [] as HTMLButtonElement[];
    return Array.from(root.querySelectorAll('button'))
      .filter((b): b is HTMLButtonElement => b instanceof HTMLButtonElement)
      .filter((b) => !b.disabled && b.tabIndex !== -1);
  };

  const onMenuKeyDown = (e: ReactKeyboardEvent, close: () => void, root: HTMLElement | null) => {
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (k !== 'ArrowDown' && k !== 'ArrowUp' && k !== 'Home' && k !== 'End') return;
    const items = focusableButtons(root);
    if (items.length === 0) return;
    const active = document.activeElement;
    const currentIndex = items.findIndex((b) => b === active);

    e.preventDefault();
    if (k === 'Home') {
      items[0]?.focus();
      return;
    }
    if (k === 'End') {
      items[items.length - 1]?.focus();
      return;
    }
    if (k === 'ArrowDown') {
      const next = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
      items[next]?.focus();
      return;
    }
    if (k === 'ArrowUp') {
      const next =
        currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  };

  useEffect(() => {
    if (!showShare) return;
    setTimeout(() => focusableButtons(shareMenuRef.current)[0]?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShare]);

  useEffect(() => {
    if (!showMenu) return;
    setTimeout(() => focusableButtons(menuRef.current)[0]?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMenu]);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
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
              className="flex-1 bg-transparent border-transparent px-2 py-1 text-xl sm:text-2xl font-display font-bold leading-tight tracking-[-0.03em] focus-visible:ring-offset-parchment"
              autoFocus
            />
            {isReadOnly && <Badge variant="warning">Read-only</Badge>}
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1
              className={[
                // Reserve the same space as the edit Input (border + padding) to avoid layout shift.
                'text-xl sm:text-2xl font-display font-bold text-ink leading-tight truncate px-2 py-1 border border-transparent rounded-xl',
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
        {/* Search (opens modal) */}
        {onOpenSearch && (
          <>
            <div className="hidden sm:block w-[280px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-light" />
                <Input
                  readOnly
                  value=""
                  placeholder="Search…"
                  className="h-9 pl-9 pr-14 cursor-pointer bg-parchment-mid border-border/70"
                  onFocus={(e) => {
                    e.currentTarget.blur();
                    onOpenSearch();
                  }}
                  onMouseDown={(e) => {
                    // Prevent text selection + keep it feeling like a button.
                    e.preventDefault();
                    onOpenSearch();
                  }}
                  aria-label="Search trip"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-[11px] text-ink-light font-mono">
                  <span className="rounded border border-border/70 bg-parchment-mid px-1.5 py-0.5">⌘</span>
                  <span className="rounded border border-border/70 bg-parchment-mid px-1.5 py-0.5">K</span>
                </div>
              </div>
            </div>

            <IconButton
              variant="ghost"
              size="sm"
              className="sm:hidden h-8 w-8"
              title="Search"
              onClick={onOpenSearch}
            >
              <Search className="h-4 w-4" />
            </IconButton>
          </>
        )}

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
              <div
                ref={shareMenuRef}
                className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-parchment-mid card-elevated z-20 overflow-hidden"
                role="menu"
                aria-label="Share menu"
                onKeyDown={(e) => onMenuKeyDown(e, () => setShowShare(false), shareMenuRef.current)}
              >
                <button
                  onClick={() => handleCopy('view')}
                  disabled={!viewToken}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-parchment transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  role="menuitem"
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
                    role="menuitem"
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
              <div
                ref={menuRef}
                className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-parchment-mid card-elevated z-20 overflow-hidden"
                role="menu"
                aria-label="Trip menu"
                onKeyDown={(e) => onMenuKeyDown(e, () => setShowMenu(false), menuRef.current)}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    router.push('/');
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-parchment transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Home className="h-4 w-4 text-ink-light" />
                  Home
                </button>
                <div className="h-px bg-border/60" />

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
                          role="menuitem"
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
                          role="menuitem"
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
                          role="menuitem"
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
                      role="menuitem"
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
                  role="menuitem"
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
                      role="menuitem"
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
