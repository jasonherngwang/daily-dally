import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCapabilitiesForTrip,
  deleteTrip,
  getTripAccessByToken,
  saveTrip,
} from '@/lib/kv';
import type { Trip } from '@/types/trip';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId: token } = await params;
    const access = await getTripAccessByToken(token);

    if (!access) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      trip: access.trip,
      accessRole: access.role,
      tokens: access.tokens,
    });
  } catch (error) {
    console.error('Error fetching trip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId: token } = await params;
    const access = await getTripAccessByToken(token);
    if (!access) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    if (access.role !== 'edit') {
      return NextResponse.json({ error: 'Read-only link' }, { status: 403 });
    }

    const tripId = access.trip.id;
    const updates: Trip = await request.json();

    // Ensure the tripId in the URL matches the trip ID in the body
    if (updates.id !== tripId) {
      return NextResponse.json(
        { error: 'Trip ID mismatch' },
        { status: 400 }
      );
    }

    const success = await saveTrip(updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update trip' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      trip: updates,
      accessRole: 'edit',
      tokens: access.tokens,
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId: token } = await params;
    const access = await getTripAccessByToken(token);
    if (!access) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    if (access.role !== 'edit') {
      return NextResponse.json({ error: 'Read-only link' }, { status: 403 });
    }

    const tripId = access.trip.id;
    const success = await deleteTrip(tripId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete trip' },
        { status: 500 }
      );
    }

    await deleteCapabilitiesForTrip(tripId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
