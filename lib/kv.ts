import type { Trip } from '@/types/trip';
import { Redis } from '@upstash/redis';

const TRIP_PREFIX = 'trip:';

let redis: Redis | null = null;

function getKvClient(): Redis | null {
  if (redis) return redis;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      return redis;
    } catch (error) {
      redis = null;
      return null;
    }
  }

  return null;
}

export async function getTrip(tripId: string): Promise<Trip | null> {
  const client = getKvClient();
  if (!client) return null;

  try {
    const data = await client.get(`${TRIP_PREFIX}${tripId}`);
    if (!data) return null;

    if (typeof data === 'string') {
      return JSON.parse(data) as Trip;
    }
    return data as Trip;
  } catch (error) {
    console.error('Error getting trip:', error);
    return null;
  }
}

export async function saveTrip(trip: Trip): Promise<boolean> {
  const client = getKvClient();
  if (!client) return false;

  try {
    await client.set(`${TRIP_PREFIX}${trip.id}`, JSON.stringify(trip));
    return true;
  } catch (error) {
    console.error('Error saving trip:', error);
    return false;
  }
}

export async function deleteTrip(tripId: string): Promise<boolean> {
  const client = getKvClient();
  if (!client) return false;

  try {
    await client.del(`${TRIP_PREFIX}${tripId}`);
    return true;
  } catch (error) {
    console.error('Error deleting trip:', error);
    return false;
  }
}
