import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ulid';
import { createTripCapabilityLinks, saveTrip } from '@/lib/kv';
import type { Trip, Day } from '@/types/trip';

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Trip name is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const tripId = generateId();
    const dayId = generateId();

    const firstDay: Day = {
      id: dayId,
      label: 'Day 1',
      destinations: [],
    };

    const trip: Trip = {
      id: tripId,
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      days: [firstDay],
    };

    const success = await saveTrip(trip);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save trip' },
        { status: 500 }
      );
    }

    const tokens = await createTripCapabilityLinks(trip.id);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Failed to create share links' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        trip,
        accessRole: 'edit',
        tokens,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating trip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
