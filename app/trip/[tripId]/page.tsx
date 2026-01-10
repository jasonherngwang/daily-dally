'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTrip } from '@/hooks/useTrip';
import { TripHeader } from '@/components/trip/TripHeader';
import { DayTabs } from '@/components/trip/DayTabs';
import { DayEditor } from '@/components/itinerary/DayEditor';
import { TripMap } from '@/components/map/TripMap';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { generateId } from '@/lib/ulid';
import type { Day } from '@/types/trip';

export default function TripPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = params.tripId as string;

  const { trip, isLoading, error, updateTrip } = useTrip(tripId);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);

  useEffect(() => {
    if (trip && trip.days.length > 0) {
      const dayParam = searchParams.get('day');
      if (dayParam) {
        const dayIndex = parseInt(dayParam, 10);
        if (dayIndex >= 0 && dayIndex < trip.days.length) {
          setActiveDayId(trip.days[dayIndex].id);
          return;
        }
      }
      setActiveDayId(trip.days[0].id);
    }
  }, [trip, searchParams]);

  const handleDaySelect = (dayId: string) => {
    if (!trip) return;
    const dayIndex = trip.days.findIndex((d) => d.id === dayId);
    if (dayIndex !== -1) {
      setActiveDayId(dayId);
      router.push(`/trip/${tripId}?day=${dayIndex}`, { scroll: false });
    }
  };

  const handleAddDay = async () => {
    if (!trip) return;

    const newDay: Day = {
      id: generateId(),
      label: `Day ${trip.days.length + 1}`,
      destinations: [],
    };

    await updateTrip({
      ...trip,
      days: [...trip.days, newDay],
    });

    setActiveDayId(newDay.id);
    router.push(`/trip/${tripId}?day=${trip.days.length}`, { scroll: false });
  };

  const handleDeleteDay = async (dayId: string) => {
    if (!trip || trip.days.length <= 1) return;

    const dayIndex = trip.days.findIndex((d) => d.id === dayId);
    const newDays = trip.days.filter((d) => d.id !== dayId);

    await updateTrip({
      ...trip,
      days: newDays,
    });

    if (activeDayId === dayId) {
      const newIndex = Math.min(dayIndex, newDays.length - 1);
      setActiveDayId(newDays[newIndex].id);
      router.push(`/trip/${tripId}?day=${newIndex}`, { scroll: false });
    }
  };

  const handleReorderDay = async (dayId: string, direction: 'left' | 'right') => {
    if (!trip) return;

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

    router.push(`/trip/${tripId}?day=${newIndex}`, { scroll: false });
  };

  const handleRenameDay = async (dayId: string, newLabel: string) => {
    if (!trip) return;

    const newDays = trip.days.map((d) =>
      d.id === dayId ? { ...d, label: newLabel } : d
    );

    await updateTrip({
      ...trip,
      days: newDays,
    });
  };

  const handleDeleteTrip = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
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

  const activeDay = trip.days.find((d) => d.id === activeDayId);

  return (
    <div className="min-h-screen bg-parchment topo-pattern">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <TripHeader trip={trip} onUpdate={updateTrip} onDelete={handleDeleteTrip} />
      </div>

      {activeDay && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-6 overflow-hidden">
          <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
            <div className="space-y-4 min-w-0">
              <DayTabs
                days={trip.days}
                activeDayId={activeDayId || ''}
                onDaySelect={handleDaySelect}
                onAddDay={handleAddDay}
                onDeleteDay={handleDeleteDay}
                onReorderDay={handleReorderDay}
                onRenameDay={handleRenameDay}
              />
              <DayEditor
                day={activeDay}
                trip={trip}
                onUpdate={(updatedDay) => {
                  const updatedDays = trip.days.map((d) =>
                    d.id === updatedDay.id ? updatedDay : d
                  );
                  updateTrip({ ...trip, days: updatedDays });
                }}
              />
            </div>

            <div className="h-[400px] sm:h-[500px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-4">
              <TripMap
                key={activeDayId}
                destinations={activeDay.destinations}
                activeDestinationId={undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
