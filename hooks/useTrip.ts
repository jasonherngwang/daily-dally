'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Trip } from '@/types/trip';

export function useTrip(tripId: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrip = useCallback(async () => {
    if (!tripId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trip');
      }
      const data = await response.json();
      setTrip(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const updateTrip = useCallback(
    async (updates: Partial<Trip> | ((prev: Trip | null) => Trip)) => {
      if (!trip) return;

      const updatedTrip =
        typeof updates === 'function' ? updates(trip) : { ...trip, ...updates };
      updatedTrip.updatedAt = new Date().toISOString();
      setTrip(updatedTrip);

      try {
        const response = await fetch(`/api/trips/${tripId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedTrip),
        });

        if (!response.ok) {
          throw new Error('Failed to update trip');
        }

        const savedTrip = await response.json();
        setTrip(savedTrip);
      } catch (err) {
        setTrip(trip);
        setError(err instanceof Error ? err.message : 'Failed to save changes');
        throw err;
      }
    },
    [trip, tripId]
  );

  return {
    trip,
    isLoading,
    error,
    updateTrip,
    refetch: fetchTrip,
  };
}
