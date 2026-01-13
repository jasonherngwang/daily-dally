import { memoryCacheGet, memoryCacheSet } from '@/lib/memory-cache';

export type SerpApiSourceLink = {
  title: string;
  url: string;
  snippet?: string;
};

export type SerpApiPlaceDetails = {
  rating?: number;
  reviews?: number;
  primaryType?: string;
  types?: string[];
  address?: string;
  openState?: string;
  hoursSummary?: string;
  description?: string;
  featuredUserReview?: string;
  highlights?: string[];
  activities?: string[];
  amenities?: string[];
};

export type SerpApiPlaceHint = {
  /**
   * A best-effort stable identifier (if provided by SerpAPI).
   * NOTE: May or may not be a Google Places place_id; always validate.
   */
  placeIdHint?: string;
  name: string;
  sources: SerpApiSourceLink[];
  details?: SerpApiPlaceDetails;
};

export class SerpApiQuotaError extends Error {
  name = 'SerpApiQuotaError';
}

function isQuotaErrorMessage(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes('exceeded') ||
    m.includes('quota') ||
    m.includes('credit') ||
    m.includes('monthly') ||
    m.includes('payment required')
  );
}

type SerpApiGoogleMapsResponse = {
  error?: string;
  local_results?: Array<{
    title?: string;
    link?: string;
    website?: string;
    place_id_search?: string;
    snippet?: string;
    place_id?: string;
    gps_coordinates?: { latitude?: number; longitude?: number };
    rating?: number;
    reviews?: number;
    type?: string;
    types?: string[];
    address?: string;
    open_state?: string;
    hours?: string;
    description?: string;
    user_review?: string;
    extensions?: Array<Record<string, string[]>>;
  }>;
  // Some responses include "top_sights" for sightseeing-like queries.
  top_sights?: Array<{
    title?: string;
    link?: string;
    website?: string;
    place_id_search?: string;
    snippet?: string;
    place_id?: string;
    rating?: number;
    reviews?: number;
    type?: string;
    types?: string[];
    address?: string;
    open_state?: string;
    hours?: string;
    description?: string;
    user_review?: string;
    extensions?: Array<Record<string, string[]>>;
  }>;
};

function normalizeName(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

function safeSourceLink(args: { title?: string; url?: string; snippet?: string }): SerpApiSourceLink | null {
  const title = (args.title || '').trim();
  const urlRaw = (args.url || '').trim();
  if (!title || !urlRaw) return null;
  try {
    const u = new URL(urlRaw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return { title, url: u.toString(), snippet: args.snippet?.trim() || undefined };
  } catch {
    return null;
  }
}

function googleMapsPlaceUrl(args: { name: string; placeId: string }) {
  // Public Google Maps deeplink that doesn't require scraping or extra API calls.
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', args.name);
  url.searchParams.set('query_place_id', args.placeId);
  return url.toString();
}

function trimOneLine(s: string, max: number) {
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function parseExtensions(ext?: Array<Record<string, string[]>>) {
  const highlights: string[] = [];
  const activities: string[] = [];
  const amenities: string[] = [];

  for (const obj of ext ?? []) {
    for (const [k, v] of Object.entries(obj)) {
      if (!Array.isArray(v)) continue;
      if (k === 'highlights') highlights.push(...v);
      if (k === 'activities') activities.push(...v);
      if (k === 'amenities') amenities.push(...v);
    }
  }

  const uniq = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))).slice(0, 6);

  return {
    highlights: uniq(highlights),
    activities: uniq(activities),
    amenities: uniq(amenities),
  };
}

/**
 * Runs a single SerpAPI Google Maps search and returns a list of POI name hints.
 *
 * We intentionally keep this to ONE SerpAPI request per Discover to respect low monthly quotas.
 */
export async function serpapiGoogleMapsSearch(args: {
  apiKey: string;
  query: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}): Promise<SerpApiPlaceHint[]> {
  const ll = args.center ? `${args.center.lat.toFixed(4)},${args.center.lng.toFixed(4)}` : '';
  const z = args.zoom ?? 12;
  const cacheKey = `serpapi:google_maps:${args.query}:${ll}:${z}`;
  const cached = memoryCacheGet<SerpApiPlaceHint[]>(cacheKey);
  if (cached) return cached;

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_maps');
  url.searchParams.set('q', args.query);
  url.searchParams.set('api_key', args.apiKey);
  url.searchParams.set('hl', 'en');
  url.searchParams.set('gl', 'us');
  if (args.center) {
    url.searchParams.set('ll', `@${args.center.lat},${args.center.lng},${z}z`);
  }

  const res = await fetch(url.toString(), { method: 'GET' });

  // Quota errors are often 402 (Payment Required) or 429 (Too Many Requests).
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const msg = bodyText || `SerpAPI request failed (${res.status})`;
    if (res.status === 402 || res.status === 429 || isQuotaErrorMessage(msg)) {
      throw new SerpApiQuotaError(msg);
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as SerpApiGoogleMapsResponse;
  if (data.error) {
    if (isQuotaErrorMessage(data.error)) {
      throw new SerpApiQuotaError(data.error);
    }
    throw new Error(data.error);
  }

  const hints: SerpApiPlaceHint[] = [];

  const push = (raw: {
    title?: string;
    link?: string;
    website?: string;
    place_id_search?: string;
    snippet?: string;
    place_id?: string;
    rating?: number;
    reviews?: number;
    type?: string;
    types?: string[];
    address?: string;
    open_state?: string;
    hours?: string;
    description?: string;
    user_review?: string;
    extensions?: Array<Record<string, string[]>>;
  }) => {
    const name = normalizeName(raw.title || '');
    if (!name) return;
    const sources: SerpApiSourceLink[] = [];
    // Prefer an official site when present.
    const website = safeSourceLink({ title: `${name} website`, url: raw.website });
    if (website) sources.push(website);

    // Always provide a public Google Maps link when we have a place_id.
    if (raw.place_id) {
      const maps = safeSourceLink({
        title: 'Google Maps',
        url: googleMapsPlaceUrl({ name, placeId: raw.place_id }),
      });
      if (maps) sources.push(maps);
    }

    // Fallbacks (rarely present depending on the SerpAPI response shape)
    const l1 = safeSourceLink({ title: name, url: raw.link, snippet: raw.snippet });
    if (l1) sources.push(l1);
    const l3 = safeSourceLink({ title: 'SerpAPI place lookup', url: raw.place_id_search });
    if (l3) sources.push(l3);

    const ext = parseExtensions(raw.extensions);
    const details: SerpApiPlaceDetails = {
      rating: typeof raw.rating === 'number' ? raw.rating : undefined,
      reviews: typeof raw.reviews === 'number' ? raw.reviews : undefined,
      primaryType: raw.type?.trim() || undefined,
      types: Array.isArray(raw.types) ? raw.types.map((t) => t.trim()).filter(Boolean).slice(0, 8) : undefined,
      address: raw.address?.trim() || undefined,
      openState: raw.open_state?.trim() || undefined,
      hoursSummary: raw.hours?.trim() || undefined,
      description: raw.description ? trimOneLine(raw.description, 220) : undefined,
      featuredUserReview: raw.user_review ? trimOneLine(raw.user_review.replace(/^"+|"+$/g, ''), 220) : undefined,
      highlights: ext.highlights,
      activities: ext.activities,
      amenities: ext.amenities,
    };

    hints.push({
      name,
      placeIdHint: raw.place_id?.trim() || undefined,
      sources: sources.slice(0, 3),
      details,
    });
  };

  for (const r of data.local_results ?? []) push(r);
  for (const r of data.top_sights ?? []) push(r);

  // Dedupe by name (SerpAPI can repeat across sections)
  const byName = new Map<string, SerpApiPlaceHint>();
  for (const h of hints) {
    const key = h.name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, h);
      continue;
    }
    const merged: SerpApiPlaceHint = {
      name: prev.name,
      placeIdHint: prev.placeIdHint || h.placeIdHint,
      sources: [...prev.sources, ...h.sources].slice(0, 3),
      details: prev.details ?? h.details,
    };
    byName.set(key, merged);
  }

  const out = Array.from(byName.values());
  memoryCacheSet(cacheKey, out, 12 * 60 * 60 * 1000); // 12h
  return out;
}

