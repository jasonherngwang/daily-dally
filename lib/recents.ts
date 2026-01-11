export type RecentTripAccessRole = 'view' | 'edit';

export interface RecentTrip {
  token: string;
  tripId: string;
  name: string;
  accessRole: RecentTripAccessRole;
  lastOpenedAt: string;
  updatedAt?: string;
  origin: string;
}

const STORAGE_KEY = 'dailyDally.recentTrips.v1';
const MAX_RECENTS = 15;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getRecentTrips(): RecentTrip[] {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const origin = window.location.origin;
    return parsed
      .filter((x): x is RecentTrip => {
        return (
          !!x &&
          typeof x === 'object' &&
          typeof (x as RecentTrip).token === 'string' &&
          typeof (x as RecentTrip).tripId === 'string' &&
          typeof (x as RecentTrip).name === 'string' &&
          ((x as RecentTrip).accessRole === 'view' || (x as RecentTrip).accessRole === 'edit') &&
          typeof (x as RecentTrip).lastOpenedAt === 'string' &&
          typeof (x as RecentTrip).origin === 'string'
        );
      })
      .filter((x) => x.origin === origin)
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function setRecentTrips(trips: RecentTrip[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips.slice(0, MAX_RECENTS)));
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export function upsertRecentTrip(entry: Omit<RecentTrip, 'lastOpenedAt' | 'origin'>) {
  if (!isBrowser()) return;

  const now = new Date().toISOString();
  const origin = window.location.origin;
  const current = getRecentTrips();

  const withoutSameTrip = current.filter((t) => t.tripId !== entry.tripId);
  const next: RecentTrip = {
    ...entry,
    lastOpenedAt: now,
    origin,
  };

  setRecentTrips([next, ...withoutSameTrip]);
}

export function removeRecentTrip(token: string) {
  const current = getRecentTrips();
  setRecentTrips(current.filter((t) => t.token !== token));
}

export function clearRecentTrips() {
  setRecentTrips([]);
}

