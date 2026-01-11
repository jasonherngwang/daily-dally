import type { Trip } from '@/types/trip';
import { Redis } from '@upstash/redis';
import { generateId } from '@/lib/ulid';

const TRIP_PREFIX = 'trip:';
const CAP_VIEW_PREFIX = 'cap:view:';
const CAP_EDIT_PREFIX = 'cap:edit:';
const TRIP_CAPS_PREFIX = 'tripcaps:';

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

export type TripAccessRole = 'view' | 'edit';

interface CapabilityRecord {
  tripId: string;
  role: TripAccessRole;
  createdAt: string;
  /**
   * Stored only on edit capabilities so editors can share the corresponding
   * read-only link without revealing the edit token.
   */
  viewToken?: string;
}

interface TripCapabilitiesRecord {
  tripId: string;
  viewToken: string;
  editToken: string;
  createdAt: string;
}

export interface TripAccess {
  trip: Trip;
  role: TripAccessRole;
  tokens: {
    viewToken?: string;
    editToken?: string;
  };
}

async function getJson<T>(key: string): Promise<T | null> {
  const client = getKvClient();
  if (!client) return null;

  try {
    const data = await client.get(key);
    if (!data) return null;
    if (typeof data === 'string') return JSON.parse(data) as T;
    return data as T;
  } catch (error) {
    console.error('Error getting key:', key, error);
    return null;
  }
}

async function setJson(key: string, value: unknown): Promise<boolean> {
  const client = getKvClient();
  if (!client) return false;

  try {
    await client.set(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Error setting key:', key, error);
    return false;
  }
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
  return await setJson(`${TRIP_PREFIX}${trip.id}`, trip);
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

export async function createTripCapabilityLinks(tripId: string): Promise<{
  viewToken: string;
  editToken: string;
} | null> {
  const client = getKvClient();
  if (!client) return null;

  const now = new Date().toISOString();
  const viewToken = generateId();
  const editToken = generateId();

  const viewRecord: CapabilityRecord = {
    tripId,
    role: 'view',
    createdAt: now,
  };

  const editRecord: CapabilityRecord = {
    tripId,
    role: 'edit',
    createdAt: now,
    viewToken,
  };

  const caps: TripCapabilitiesRecord = {
    tripId,
    viewToken,
    editToken,
    createdAt: now,
  };

  try {
    await client.mset({
      [`${CAP_VIEW_PREFIX}${viewToken}`]: JSON.stringify(viewRecord),
      [`${CAP_EDIT_PREFIX}${editToken}`]: JSON.stringify(editRecord),
      [`${TRIP_CAPS_PREFIX}${tripId}`]: JSON.stringify(caps),
    });
    return { viewToken, editToken };
  } catch (error) {
    console.error('Error creating capability links:', error);
    return null;
  }
}

export async function getTripAccessByToken(token: string): Promise<TripAccess | null> {
  // 1) Edit capability token
  const editCap = await getJson<CapabilityRecord>(`${CAP_EDIT_PREFIX}${token}`);
  if (editCap && editCap.tripId) {
    const trip = await getTrip(editCap.tripId);
    if (!trip) return null;
    return {
      trip,
      role: 'edit',
      tokens: { editToken: token, viewToken: editCap.viewToken },
    };
  }

  // 2) View capability token
  const viewCap = await getJson<CapabilityRecord>(`${CAP_VIEW_PREFIX}${token}`);
  if (viewCap && viewCap.tripId) {
    const trip = await getTrip(viewCap.tripId);
    if (!trip) return null;
    return {
      trip,
      role: 'view',
      tokens: { viewToken: token },
    };
  }

  // 3) Back-compat: treat raw tripId as an edit link
  const legacyTrip = await getTrip(token);
  if (legacyTrip) {
    return {
      trip: legacyTrip,
      role: 'edit',
      tokens: { editToken: token },
    };
  }

  return null;
}

export async function getTripCapabilitiesByTripId(
  tripId: string
): Promise<TripCapabilitiesRecord | null> {
  return await getJson<TripCapabilitiesRecord>(`${TRIP_CAPS_PREFIX}${tripId}`);
}

export async function deleteCapabilitiesForTrip(tripId: string): Promise<boolean> {
  const client = getKvClient();
  if (!client) return false;

  try {
    const caps = await getTripCapabilitiesByTripId(tripId);
    const keys: string[] = [`${TRIP_CAPS_PREFIX}${tripId}`];
    if (caps?.viewToken) keys.push(`${CAP_VIEW_PREFIX}${caps.viewToken}`);
    if (caps?.editToken) keys.push(`${CAP_EDIT_PREFIX}${caps.editToken}`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Error deleting capabilities:', error);
    return false;
  }
}
