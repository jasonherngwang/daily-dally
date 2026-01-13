import { NextRequest, NextResponse } from 'next/server';
import { generateId } from '@/lib/ulid';
import { createTripCapabilityLinks, getTripAccessByToken, saveTrip } from '@/lib/kv';
import type { Day, Destination, Trip } from '@/types/trip';

function cloneTripWithNewIds(source: Trip, overrides?: { name?: string }): Trip {
  const now = new Date().toISOString();

  const days: Day[] = source.days.map((day) => {
    const destinations: Destination[] = day.destinations.map((d) => ({
      ...d,
      id: generateId(),
    }));

    return {
      ...day,
      id: generateId(),
      destinations,
    };
  });

  return {
    ...source,
    id: generateId(),
    name: (overrides?.name ?? `${source.name} (Copy)`).trim(),
    createdAt: now,
    updatedAt: now,
    days,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId: token } = await params;
    const access = await getTripAccessByToken(token);

    if (!access) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const name =
      typeof body?.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : undefined;

    const clonedTrip = cloneTripWithNewIds(access.trip, { name });
    const success = await saveTrip(clonedTrip);
    if (!success) {
      return NextResponse.json({ error: 'Failed to save trip' }, { status: 500 });
    }

    const tokens = await createTripCapabilityLinks(clonedTrip.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Failed to create share links' }, { status: 500 });
    }

    return NextResponse.json(
      {
        trip: clonedTrip,
        accessRole: 'edit',
        tokens,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error cloning trip:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

