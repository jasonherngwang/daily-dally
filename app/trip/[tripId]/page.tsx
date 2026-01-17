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

  const previewLocation =
    preview.dayId === activeDayId ? preview.location : null;

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

  const activeDestinationId =
    (hovered.dayId === activeDayId ? hovered.id : null) ??
    (selected.dayId === activeDayId ? selected.id : null) ??
    undefined;

  const handleMapDestinationHover = useCallback(
    (id: string | null) => {
      setHovered({ dayId: activeDayId, id });
    },
    [activeDayId]
  );

  const handleMapDestinationClick = useCallback(
    (id: string) => {
      setSelected({ dayId: activeDayId, id });
      // Scroll card into view (DestinationList sets wrapper ids).
      const el = document.getElementById(`destination-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [activeDayId]
  );

  const handleMapClick = useCallback(() => {
    setSelected({ dayId: activeDayId, id: null });
    setHovered({ dayId: activeDayId, id: null });
  }, [activeDayId]);

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

      // If switching days, wait for the next DayEditor mount before scrolling.
      pendingScrollRef.current = { dayId, destinationId };

      if (dayId !== activeDayId) {
        router.push(`/trip/${tripToken}?day=${dayIndex}`, { scroll: false });
      } else {
        scrollToDestinationCard(destinationId);
        pendingScrollRef.current = null;
      }

      setIsSearchOpen(false);
    },
    [activeDayId, router, scrollToDestinationCard, trip, tripToken]
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
    },
    [activeDayId, isReadOnly, trip, updateTrip]
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

      {activeDay && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-6 overflow-hidden">
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <div className="space-y-4 min-w-0">
              <DayTabs
                days={trip.days}
                activeDayId={activeDayId}
                onDaySelect={handleDaySelect}
                onAddDay={handleAddDay}
                onReorderDays={handleReorderDays}
                readOnly={isReadOnly}
              />
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

            <div className="h-[400px] sm:h-[500px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-0">
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
        </div>
      )}

      <TripSearchModal
        open={isSearchOpen}
        trip={trip}
        onClose={() => setIsSearchOpen(false)}
        onSelect={navigateToDestination}
      />
    </div>
  );
}
