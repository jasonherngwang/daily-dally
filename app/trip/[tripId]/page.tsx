'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTrip } from '@/hooks/useTrip';
import { TripHeader } from '@/components/trip/TripHeader';
import { DayTabs } from '@/components/trip/DayTabs';
import { DayEditor } from '@/components/itinerary/DayEditor';
import { TripMap } from '@/components/map/TripMap';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { generateId } from '@/lib/ulid';
import { distinctRouteColor } from '@/lib/route-colors';
import type { Coordinates, Day, Destination } from '@/types/trip';
import { TripSearchModal, type TripSearchSelection } from '@/components/search/TripSearchModal';

function isEditableElement(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return (el as HTMLElement).isContentEditable === true;
}

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripToken = params.tripId as string;

  const { trip, isLoading, error, updateTrip, accessRole, tokens, isReadOnly } =
    useTrip(tripToken);
  const isTripView = useMemo(() => searchParams.get('view') === 'trip', [searchParams]);
  const stickyStackRef = useRef<HTMLDivElement | null>(null);
  const [stickyStackHeight, setStickyStackHeight] = useState(0);
  const [isStickyOverContent, setIsStickyOverContent] = useState(false);
  const activeDayIndex = useMemo(() => {
    if (!trip || trip.days.length === 0) return 0;
    const dayParam = searchParams.get('day');
    if (!dayParam) return 0;
    const parsed = Number.parseInt(dayParam, 10);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed < 0) return 0;
    if (parsed >= trip.days.length) return trip.days.length - 1;
    return parsed;
  }, [trip, searchParams]);

  const activeDay = trip?.days?.[activeDayIndex];
  const activeDayId = activeDay?.id || '';
  const [openTripViewDayId, setOpenTripViewDayId] = useState<string | null>(null);
  const wasTripViewRef = useRef(false);
  const hasToggledAccordionRef = useRef(false);
  const [preview, setPreview] = useState<{
    dayId: string;
    location: Coordinates | null;
  }>({ dayId: '', location: null });

  const [selected, setSelected] = useState<{ dayId: string; id: string | null }>({
    dayId: '',
    id: null,
  });
  const [hovered, setHovered] = useState<{ dayId: string; id: string | null }>({
    dayId: '',
    id: null,
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pendingScrollRef = useRef<{ dayId: string; destinationId: string } | null>(null);

  // When the page scrolls, the sticky header begins to overlap content. Add a bottom border for clarity.
  useEffect(() => {
    const update = () => {
      setIsStickyOverContent(window.scrollY > 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Measure sticky header stack height so the map can stick directly below it (no magic numbers).
  useEffect(() => {
    const el = stickyStackRef.current;
    if (!el) return;
    const update = () => {
      // Use scrollHeight to get the full height including any overflow, or getBoundingClientRect for visual height
      const height = el.scrollHeight || el.getBoundingClientRect().height;
      setStickyStackHeight(Math.ceil(height));
    };
    // Use requestAnimationFrame to ensure layout is complete on initial load
    let rafId = requestAnimationFrame(() => {
      update();
    });
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const mapStickyTopPx = stickyStackHeight > 0 ? stickyStackHeight + 16 : 140; // small fallback
  const tripDayColors = useMemo(() => {
    if (!trip) return new Map<string, string>();
    return new Map(trip.days.map((d, idx) => [d.id, distinctRouteColor(idx)]));
  }, [trip]);

  // Initialize the open accordion day when entering Trip View.
  useEffect(() => {
    if (!trip) return;
    const wasTripView = wasTripViewRef.current;
    wasTripViewRef.current = isTripView;
    if (!isTripView) return;
    if (wasTripView) return; // only run on transition into Trip View
    hasToggledAccordionRef.current = false; // Reset toggle state when entering Trip View
    setOpenTripViewDayId(activeDayId || trip.days[0]?.id || null);
  }, [activeDayId, isTripView, trip]);

  // If the currently-open day no longer exists (deleted/reordered), pick a sensible fallback.
  useEffect(() => {
    if (!trip) return;
    if (!isTripView) return;
    if (!openTripViewDayId) return;
    const exists = trip.days.some((d) => d.id === openTripViewDayId);
    if (exists) return;
    setOpenTripViewDayId(activeDayId || trip.days[0]?.id || null);
  }, [activeDayId, isTripView, openTripViewDayId, trip]);

  const previewLocation = isTripView
    ? preview.location
    : preview.dayId === activeDayId
      ? preview.location
      : null;

  const handlePreviewLocationChange = useCallback(
    (location: Coordinates | null) => {
      setPreview((prev) => {
        // Avoid useless state updates (helps prevent render loops).
        const sameDay = prev.dayId === activeDayId;
        const sameLoc =
          (prev.location == null && location == null) ||
          (prev.location != null &&
            location != null &&
            prev.location.lat === location.lat &&
            prev.location.lng === location.lng);
        if (sameDay && sameLoc) return prev;
        return { dayId: activeDayId, location };
      });
    },
    [activeDayId]
  );

  const handlePreviewLocationChangeForDay = useCallback(
    (dayId: string, location: Coordinates | null) => {
      setPreview((prev) => {
        const sameDay = prev.dayId === dayId;
        const sameLoc =
          (prev.location == null && location == null) ||
          (prev.location != null &&
            location != null &&
            prev.location.lat === location.lat &&
            prev.location.lng === location.lng);
        if (sameDay && sameLoc) return prev;
        return { dayId, location };
      });
    },
    []
  );

  const activeDestinationId =
    isTripView
      ? (hovered.id ?? selected.id ?? undefined) || undefined
      : (hovered.dayId === activeDayId ? hovered.id : null) ??
        (selected.dayId === activeDayId ? selected.id : null) ??
        undefined;

  const handleMapDestinationHover = useCallback(
    (id: string | null) => {
      if (!trip || !id) {
        setHovered({ dayId: activeDayId, id });
        return;
      }
      const owningDayId =
        trip.days.find((d) => d.destinations.some((x) => x.id === id))?.id ?? activeDayId;
      setHovered({ dayId: owningDayId, id });
    },
    [activeDayId, trip]
  );

  const handleMapDestinationClick = useCallback(
    (id: string) => {
      if (!trip) return;
      const owningDayId =
        trip.days.find((d) => d.destinations.some((x) => x.id === id))?.id ?? activeDayId;
      setSelected({ dayId: owningDayId, id });
      if (isTripView) setOpenTripViewDayId(owningDayId);
      // Scroll card into view (DestinationList sets wrapper ids).
      const el = document.getElementById(`destination-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [activeDayId, isTripView, trip]
  );

  const handleMapClick = useCallback(() => {
    if (isTripView) {
      setSelected((prev) => ({ ...prev, id: null }));
      setHovered((prev) => ({ ...prev, id: null }));
      return;
    }
    setSelected({ dayId: activeDayId, id: null });
    setHovered({ dayId: activeDayId, id: null });
  }, [activeDayId, isTripView]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'k') return;
      const activeEl = document.activeElement;
      if (isEditableElement(activeEl)) return;
      e.preventDefault();
      setIsSearchOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const scrollToDestinationCard = useCallback((destinationId: string) => {
    const el = document.getElementById(`destination-${destinationId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const navigateToDestination = useCallback(
    (selection: TripSearchSelection) => {
      if (!trip) return;
      const { dayId, dayIndex, destinationId } = selection;
      setSelected({ dayId, id: destinationId });
      setHovered({ dayId, id: null });

      if (isTripView) {
        // No routing in Trip View; just scroll to the destination (and open accordion day on mobile).
        pendingScrollRef.current = null;
        setOpenTripViewDayId(dayId);
        // Best-effort: ensure the day section is near viewport first.
        const dayEl = document.getElementById(`day-${dayId}`);
        dayEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => scrollToDestinationCard(destinationId), 150);
      } else {
        // If switching days, wait for the next DayEditor mount before scrolling.
        pendingScrollRef.current = { dayId, destinationId };
        if (dayId !== activeDayId) {
          router.push(`/trip/${tripToken}?day=${dayIndex}`, { scroll: false });
        } else {
          scrollToDestinationCard(destinationId);
          pendingScrollRef.current = null;
        }
      }

      setIsSearchOpen(false);
    },
    [activeDayId, isTripView, router, scrollToDestinationCard, trip, tripToken]
  );

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    if (activeDayId !== pending.dayId) return;
    scrollToDestinationCard(pending.destinationId);
    pendingScrollRef.current = null;
  }, [activeDayId, scrollToDestinationCard]);

  const handleDaySelect = (dayId: string) => {
    if (!trip) return;
    const dayIndex = trip.days.findIndex((d) => d.id === dayId);
    if (dayIndex !== -1) {
      router.push(`/trip/${tripToken}?day=${dayIndex}`, { scroll: false });
    }
  };

  const handleTripViewSelect = () => {
    // Preserve `day` so we can return to the last selected day.
    router.push(`/trip/${tripToken}?day=${activeDayIndex}&view=trip`, { scroll: false });
  };

  const handleAddDay = async () => {
    if (!trip || isReadOnly) return;

    const newDay: Day = {
      id: generateId(),
      label: `Day ${trip.days.length + 1}`,
      destinations: [],
    };

    await updateTrip({
      ...trip,
      days: [...trip.days, newDay],
    });

    router.push(`/trip/${tripToken}?day=${trip.days.length}`, { scroll: false });
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!trip || isReadOnly || trip.days.length <= 1) return;

    const dayIndex = trip.days.findIndex((d) => d.id === dayId);
    const newDays = trip.days.filter((d) => d.id !== dayId);

    await updateTrip({
      ...trip,
      days: newDays,
    });

    if (activeDayId === dayId) {
      const newIndex = Math.min(dayIndex, newDays.length - 1);
      router.push(`/trip/${tripToken}?day=${newIndex}`, { scroll: false });
    }
  };

  const handleReorderDay = async (dayId: string, direction: 'left' | 'right') => {
    if (!trip || isReadOnly) return;

    const dayIndex = trip.days.findIndex((d) => d.id === dayId);
    if (dayIndex === -1) return;

    const newIndex = direction === 'left' ? dayIndex - 1 : dayIndex + 1;
    if (newIndex < 0 || newIndex >= trip.days.length) return;

    const newDays = [...trip.days];
    [newDays[dayIndex], newDays[newIndex]] = [newDays[newIndex], newDays[dayIndex]];

    await updateTrip({
      ...trip,
      days: newDays,
    });

    router.push(`/trip/${tripToken}?day=${newIndex}`, { scroll: false });
  };

  const handleReorderDays = async (newDays: Day[]) => {
    if (!trip || isReadOnly) return;

    // Find the new index of the active day to keep it selected/in view
    const newActiveDayIndex = newDays.findIndex((d) => d.id === activeDayId);
    
    await updateTrip({
      ...trip,
      days: newDays,
    });

    if (newActiveDayIndex !== -1) {
       router.push(`/trip/${tripToken}?day=${newActiveDayIndex}`, { scroll: false });
    }
  };

  const handleRenameDay = async (dayId: string, newLabel: string) => {
    if (!trip || isReadOnly) return;

    const newDays = trip.days.map((d) =>
      d.id === dayId ? { ...d, label: newLabel } : d
    );

    await updateTrip({
      ...trip,
      days: newDays,
    });
  };

  const handleMoveDestination = useCallback(
    async (fromDayId: string, destinationId: string, toDayId: string) => {
      if (!trip || isReadOnly) return;
      if (fromDayId === toDayId) return;

      const fromDay = trip.days.find((d) => d.id === fromDayId);
      const toDay = trip.days.find((d) => d.id === toDayId);
      if (!fromDay || !toDay) return;

      const destination: Destination | undefined = fromDay.destinations.find(
        (d) => d.id === destinationId
      );
      if (!destination) return;

      // If moving out of the active day, clear selection/hover for that destination.
      if (activeDayId === fromDayId) {
        setSelected((prev) =>
          prev.dayId === fromDayId && prev.id === destinationId
            ? { dayId: fromDayId, id: null }
            : prev
        );
        setHovered((prev) =>
          prev.dayId === fromDayId && prev.id === destinationId
            ? { dayId: fromDayId, id: null }
            : prev
        );
      }

      const newDays = trip.days.map((day) => {
        if (day.id === fromDayId) {
          return {
            ...day,
            destinations: day.destinations.filter((d) => d.id !== destinationId),
          };
        }
        if (day.id === toDayId) {
          return {
            ...day,
            destinations: [...day.destinations, destination],
          };
        }
        return day;
      });

      await updateTrip({ ...trip, days: newDays });

      if (isTripView) {
        setSelected({ dayId: toDayId, id: destinationId });
        setHovered({ dayId: toDayId, id: null });
        setOpenTripViewDayId(toDayId);
        // Scroll to the destination in its new day (best-effort; DOM updates after state).
        setTimeout(() => {
          document.getElementById(`day-${toDayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => {
            document
              .getElementById(`destination-${destinationId}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
        }, 150);
      }
    },
    [activeDayId, isReadOnly, isTripView, trip, updateTrip]
  );

  const handleDeleteTrip = async () => {
    if (isReadOnly) return;
    try {
      const response = await fetch(`/api/trips/${tripToken}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        router.push('/');
      }
    } catch {
      // User can retry
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center topo-pattern">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-screen items-center justify-center topo-pattern">
        <div className="text-center">
          <p className="text-lg text-red-600">{error || 'Trip not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-parchment topo-pattern">
      <div
        ref={stickyStackRef}
        className={[
          'sticky top-0 z-40',
          // More transparent so the header feels like it floats above the topo background.
          'bg-parchment/75 backdrop-blur-md',
          // Only show a bottom border when overlapping scrolled content.
          isStickyOverContent ? 'border-b border-border/70' : '',
        ].join(' ')}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <TripHeader
            trip={trip}
            accessRole={accessRole}
            tokens={tokens}
            tripToken={tripToken}
            onUpdate={updateTrip}
            onDelete={handleDeleteTrip}
            onOpenSearch={() => setIsSearchOpen(true)}
          />
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-2">
          <DayTabs
            days={trip.days}
            activeDayId={isTripView ? '' : activeDayId}
            tripViewActive={isTripView}
            onTripViewSelect={handleTripViewSelect}
            onDaySelect={(dayId) => {
              if (!trip) return;
              const dayIndex = trip.days.findIndex((d) => d.id === dayId);
              if (dayIndex === -1) return;
              // Clicking a day chip always returns to Day View.
              router.push(`/trip/${tripToken}?day=${dayIndex}`, { scroll: false });
            }}
            onAddDay={handleAddDay}
            onReorderDays={handleReorderDays}
            readOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-6">
        {/* Day View */}
        {!isTripView && activeDay && (
          <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-start">
            <div className="space-y-4 min-w-0 lg:flex-1">
              <DayEditor
                key={activeDayId}
                tripToken={tripToken}
                day={activeDay}
                trip={trip}
                readOnly={isReadOnly}
                onPreviewLocationChange={handlePreviewLocationChange}
                activeDestinationId={activeDestinationId}
                onSelectDestination={(id) => {
                  setSelected({ dayId: activeDayId, id });
                  setHovered({ dayId: activeDayId, id: null });
                }}
                onDeleteDay={handleDeleteDay}
                onRenameDay={handleRenameDay}
                onMoveDestination={handleMoveDestination}
                onUpdate={(updatedDay) => {
                  if (isReadOnly) return;
                  const updatedDays = trip.days.map((d) =>
                    d.id === updatedDay.id ? updatedDay : d
                  );
                  updateTrip({ ...trip, days: updatedDays });
                }}
              />
            </div>

            <div
              className="h-[400px] sm:h-[500px] lg:h-auto lg:flex-1 lg:sticky lg:self-start map-sticky-lg"
              style={
                {
                  '--mapStickyTop': `${mapStickyTopPx}px`,
                  '--mapHeight': `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  top: `${mapStickyTopPx}px`,
                  position: 'sticky',
                  height: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  maxHeight: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  minHeight: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                } as React.CSSProperties
              }
            >
              <TripMap
                key={activeDayId}
                destinations={activeDay.destinations}
                activeDestinationId={activeDestinationId}
                previewLocation={previewLocation}
                onDestinationClick={handleMapDestinationClick}
                onDestinationHover={handleMapDestinationHover}
                onMapClick={handleMapClick}
              />
            </div>
          </div>
        )}

        {/* Trip View */}
        {isTripView && (
          <div className="flex flex-col gap-4 lg:gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 lg:flex-1">
              {/* Desktop: show all days */}
              <div className="hidden lg:block space-y-8">
                {trip.days.map((day) => (
                  <div key={day.id} id={`day-${day.id}`} className="scroll-mt-40">
                    <DayEditor
                      tripToken={tripToken}
                      day={day}
                      trip={trip}
                      readOnly={isReadOnly}
                      locationBadgeColor={tripDayColors.get(day.id)}
                      onPreviewLocationChange={(loc) => handlePreviewLocationChangeForDay(day.id, loc)}
                      activeDestinationId={
                        selected.dayId === day.id || hovered.dayId === day.id
                          ? activeDestinationId
                          : undefined
                      }
                      onSelectDestination={(id) => {
                        setSelected({ dayId: day.id, id });
                        setHovered({ dayId: day.id, id: null });
                      }}
                      onDeleteDay={handleDeleteDay}
                      onRenameDay={handleRenameDay}
                      onMoveDestination={handleMoveDestination}
                      onUpdate={(updatedDay) => {
                        if (isReadOnly) return;
                        const updatedDays = trip.days.map((d) =>
                          d.id === updatedDay.id ? updatedDay : d
                        );
                        updateTrip({ ...trip, days: updatedDays });
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Mobile/tablet: single-open accordion (implemented via collapsible DayEditor body; no duplicate headers) */}
              <div className="lg:hidden space-y-3">
                {trip.days.map((day) => {
                  // If user has toggled, respect their choice (including null = all closed)
                  // Otherwise, fall back to activeDayId on initial load
                  const effectiveOpenDayId = hasToggledAccordionRef.current ? openTripViewDayId : (openTripViewDayId ?? activeDayId);
                  const isOpen = effectiveOpenDayId === day.id;
                  return (
                    <div
                      key={day.id}
                      id={`day-${day.id}`}
                      className={[
                        'rounded-xl border border-border/60 bg-parchment-mid card-elevated scroll-mt-40',
                        isOpen ? 'px-3 pt-2.5 pb-3' : 'px-3 pt-2.5 pb-1',
                      ].join(' ')}
                    >
                      <DayEditor
                        tripToken={tripToken}
                        day={day}
                        trip={trip}
                        readOnly={isReadOnly}
                        locationBadgeColor={tripDayColors.get(day.id)}
                        collapsible={{
                          isOpen,
                          onToggle: () => {
                            hasToggledAccordionRef.current = true;
                            setOpenTripViewDayId((prev) => (prev === day.id ? null : day.id));
                          },
                        }}
                        onPreviewLocationChange={(loc) => handlePreviewLocationChangeForDay(day.id, loc)}
                        activeDestinationId={
                          selected.dayId === day.id || hovered.dayId === day.id
                            ? activeDestinationId
                            : undefined
                        }
                        onSelectDestination={(id) => {
                          setSelected({ dayId: day.id, id });
                          setHovered({ dayId: day.id, id: null });
                          setOpenTripViewDayId(day.id);
                        }}
                        onDeleteDay={handleDeleteDay}
                        onRenameDay={handleRenameDay}
                        onMoveDestination={handleMoveDestination}
                        onUpdate={(updatedDay) => {
                          if (isReadOnly) return;
                          const updatedDays = trip.days.map((d) =>
                            d.id === updatedDay.id ? updatedDay : d
                          );
                          updateTrip({ ...trip, days: updatedDays });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="h-[360px] sm:h-[420px] lg:h-auto lg:flex-1 lg:sticky lg:self-start map-sticky-lg"
              style={
                {
                  '--mapStickyTop': `${mapStickyTopPx}px`,
                  '--mapHeight': `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  top: `${mapStickyTopPx}px`,
                  position: 'sticky',
                  height: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  maxHeight: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                  minHeight: `calc(100vh - ${mapStickyTopPx}px - 48px)`,
                } as React.CSSProperties
              }
            >
              <TripMap
                key={trip.id}
                routes={trip.days.map((day, idx) => ({
                  id: day.id,
                  label: day.label,
                  dayIndex: idx,
                  color: tripDayColors.get(day.id),
                  destinations: day.destinations,
                }))}
                activeDestinationId={activeDestinationId}
                previewLocation={previewLocation}
                onDestinationClick={handleMapDestinationClick}
                onDestinationHover={handleMapDestinationHover}
                onMapClick={handleMapClick}
              />
            </div>
          </div>
        )}
      </div>

      <TripSearchModal
        open={isSearchOpen}
        trip={trip}
        onClose={() => setIsSearchOpen(false)}
        onSelect={navigateToDestination}
      />
    </div>
  );
}
