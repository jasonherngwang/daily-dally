'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Trip } from '@/types/trip';
import { upsertRecentTrip } from '@/lib/recents';

type TripAccessRole = 'view' | 'edit';

interface TripApiResponse {
  trip: Trip;
  accessRole: TripAccessRole;
  tokens?: {
    viewToken?: string;
    editToken?: string;
  };
}

export function useTrip(tripToken: string | null) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessRole, setAccessRole] = useState<TripAccessRole>('edit');
  const [tokens, setTokens] = useState<TripApiResponse['tokens']>({});

  const fetchTrip = useCallback(async () => {
    if (!tripToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripToken}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trip');
      }
      const data = (await response.json()) as TripApiResponse;
      setTrip(data.trip);
      setAccessRole(data.accessRole);
      setTokens(data.tokens || {});
      upsertRecentTrip({
        token: tripToken,
        tripId: data.trip.id,
        name: data.trip.name,
        accessRole: data.accessRole,
        updatedAt: data.trip.updatedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setIsLoading(false);
    }
  }, [tripToken]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const updateTrip = useCallback(
    async (updates: Partial<Trip> | ((prev: Trip | null) => Trip)) => {
      if (!trip) return;
      if (accessRole !== 'edit') {
        throw new Error('Read-only link');
      }

      const updatedTrip =
        typeof updates === 'function' ? updates(trip) : { ...trip, ...updates };
      updatedTrip.updatedAt = new Date().toISOString();
      setTrip(updatedTrip);

      try {
        const response = await fetch(`/api/trips/${tripToken}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatedTrip),
        });

        if (!response.ok) {
          throw new Error('Failed to update trip');
        }

        const data = (await response.json()) as TripApiResponse;
        setTrip(data.trip);
        setAccessRole(data.accessRole);
        setTokens(data.tokens || {});
        if (tripToken) {
          upsertRecentTrip({
            token: tripToken,
            tripId: data.trip.id,
            name: data.trip.name,
            accessRole: data.accessRole,
            updatedAt: data.trip.updatedAt,
          });
        }
      } catch (err) {
        setTrip(trip);
        setError(err instanceof Error ? err.message : 'Failed to save changes');
        throw err;
      }
    },
    [trip, tripToken, accessRole]
  );

  return {
    trip,
    isLoading,
    error,
    updateTrip,
    refetch: fetchTrip,
    accessRole,
    tokens,
    isReadOnly: accessRole !== 'edit',
  };
}
