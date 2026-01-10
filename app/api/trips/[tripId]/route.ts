import { NextRequest, NextResponse } from 'next/server';
import { getTrip, saveTrip, deleteTrip } from '@/lib/kv';
import type { Trip } from '@/types/trip';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const trip = await getTrip(tripId);

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(trip);
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
    const { tripId } = await params;
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

    return NextResponse.json(updates);
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
    const { tripId } = await params;
    const success = await deleteTrip(tripId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete trip' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting trip:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
