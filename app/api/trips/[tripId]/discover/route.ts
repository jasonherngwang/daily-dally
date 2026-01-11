import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText, Output, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { getTripAccessByToken } from '@/lib/kv';
import { bestInsertAfterDestinationIdForCandidate, hasValidLocation } from '@/lib/discover';
import type { Coordinates } from '@/types/trip';

const RequestSchema = z.object({
  dayId: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
  stream: z.boolean().optional(),
});

type PlacesNearbySearchResponse = {
  status: string;
  error_message?: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    vicinity?: string;
    formatted_address?: string;
    types?: string[];
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

type Candidate = {
  candidateId: string; // place_id
  placeId: string;
  name: string;
  address: string;
  location: Coordinates;
  types: string[];
  detourKm: number;
  insertAfterDestinationId: string;
  insertAfterName: string;
};

function isRefererRestrictedKeyError(message: string) {
  return /referer restrictions cannot be used with this api/i.test(message);
}

async function fetchNearbyPlaces(args: {
  location: Coordinates;
  radiusMeters: number;
  type: string;
  apiKey: string;
}): Promise<Candidate[]> {
  const { location, radiusMeters, type, apiKey } = args;

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${location.lat},${location.lng}`);
  url.searchParams.set('radius', String(radiusMeters));
  url.searchParams.set('type', type);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Places nearbysearch failed (${res.status})`);
  }
  const data = (await res.json()) as PlacesNearbySearchResponse;
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Places nearbysearch status: ${data.status}`);
  }

  const results = data.results ?? [];
  const candidates: Candidate[] = [];
  for (const r of results) {
    const placeId = r.place_id;
    const name = r.name;
    const loc = r.geometry?.location;
    const lat = loc?.lat;
    const lng = loc?.lng;
    if (!placeId || !name || typeof lat !== 'number' || typeof lng !== 'number') continue;

    candidates.push({
      candidateId: placeId,
      placeId,
      name,
      address: r.vicinity || r.formatted_address || '',
      location: { lat, lng },
      types: r.types ?? [],
      detourKm: 0,
      insertAfterDestinationId: '',
      insertAfterName: '',
    });
  }

  return candidates;
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
    if (access.role !== 'edit') {
      // Per product requirement: don't show Discover in read-only; server enforces too.
      return NextResponse.json({ error: 'Read-only link' }, { status: 403 });
    }

    const parsed = RequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { dayId } = parsed.data;
    const limit = parsed.data.limit ?? 6;
    const stream = parsed.data.stream ?? false;

    const day = access.trip.days.find((d) => d.id === dayId);
    if (!day) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    // Enforce eligibility constraints.
    if (day.destinations.length === 0) {
      return NextResponse.json(
        { error: 'Add at least one destination first' },
        { status: 400 }
      );
    }

    const anchors = day.destinations
      .filter(hasValidLocation)
      .map((d) => ({ destinationId: d.id, location: d.location }));

    if (anchors.length === 0) {
      return NextResponse.json(
        { error: 'Discover requires at least one mapped destination' },
        { status: 400 }
      );
    }

    const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!mapsApiKey) {
      return NextResponse.json(
        { error: 'Server Google Maps API key not configured' },
        { status: 500 }
      );
    }

    const existingPlaceIds = new Set(
      day.destinations.map((d) => d.placeId).filter((v): v is string => !!v)
    );

    const center = anchors[anchors.length - 1]!.location;

    const radiusMeters = 10_000;
    const types = ['tourist_attraction', 'restaurant', 'cafe'];
    let fetched: Candidate[][];
    try {
      fetched = await Promise.all(
        types.map((type) =>
          fetchNearbyPlaces({ location: center, radiusMeters, type, apiKey: mapsApiKey })
        )
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isRefererRestrictedKeyError(msg)) {
        return NextResponse.json(
          {
            error:
              'Misconfigured Google Maps key. The server Places API cannot use a referrer-restricted key.\n' +
              'Create a separate server key with Application restrictions = None and API restrictions = Places API, then set GOOGLE_MAPS_API_KEY.',
          },
          { status: 500 }
        );
      }
      throw e;
    }

    const byId = new Map<string, Candidate>();
    for (const list of fetched) {
      for (const c of list) {
        if (existingPlaceIds.has(c.placeId)) continue;
        if (!byId.has(c.candidateId)) {
          byId.set(c.candidateId, c);
        }
      }
    }

    const candidates = Array.from(byId.values()).slice(0, 60).map((c) => {
      const { insertAfterDestinationId, detourKm } =
        bestInsertAfterDestinationIdForCandidate({
          anchors,
          candidateLocation: c.location,
        });
      const afterName =
        day.destinations.find((d) => d.id === insertAfterDestinationId)?.name ?? 'a stop';

      return {
        ...c,
        insertAfterDestinationId,
        detourKm,
        insertAfterName: afterName,
      };
    });

    if (candidates.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // AI rerank (optional, but v1 includes it). If not configured, fall back to detour sort.
    const genAiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!genAiKey) {
      const suggestions = [...candidates]
        .sort((a, b) => a.detourKm - b.detourKm)
        .slice(0, limit)
        .map((c) => ({
          candidateId: c.candidateId,
          placeId: c.placeId,
          name: c.name,
          address: c.address,
          location: c.location,
          detourKm: c.detourKm,
          insertAfterDestinationId: c.insertAfterDestinationId,
          whyItFits:
            `Close to your itinerary with a minimal detour. Fits best after ${c.insertAfterName}.`,
        }));
      return NextResponse.json({ suggestions });
    }

    const itinerarySummary = day.destinations
      .map((d) => {
        const bits = [d.name.trim()].filter(Boolean);
        const note = d.notes?.trim();
        if (note) bits.push(`(notes: ${note.slice(0, 120)})`);
        return bits.join(' ');
      })
      .filter(Boolean)
      .slice(0, 40)
      .join('\n- ');

    const candidateSummary = candidates
      .map((c) => ({
        candidateId: c.candidateId,
        name: c.name,
        address: c.address,
        types: c.types.slice(0, 6),
        detourKm: Number(c.detourKm.toFixed(2)),
      }))
      .slice(0, 60);

    const prompt = [
      'You are helping a user plan a single day road trip itinerary.',
      'Select the best suggestions from the provided candidates.',
      '',
      'Hard rules:',
      '- You MUST ONLY choose from the provided candidateId list. Do not invent places.',
      '- Prefer minimal detour, but balance with variety (attractions + food + coffee).',
      '- Avoid duplicates of the same type (e.g., 10 cafes).',
      '',
      `Return up to ${limit} items.`,
      '',
      'Current day itinerary destinations:',
      `- ${itinerarySummary || '(none)'}`,
      '',
      'Candidates JSON:',
      JSON.stringify(candidateSummary),
      '',
      'For each selected candidate, provide:',
      '- candidateId',
      '- whyItFits (1 short sentence)',
    ].join('\n');

    const candidateById = new Map(candidates.map((c) => [c.candidateId, c] as const));
    const elementSchema = z.object({
      candidateId: z.string(),
      whyItFits: z.string().min(1).max(220),
    });

    if (stream) {
      const { elementStream } = streamText({
        model: google('gemini-2.5-flash-lite'),
        prompt,
        output: Output.array({ element: elementSchema }),
      });

      const encoder = new TextEncoder();
      const seen = new Set<string>();

      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const sel of elementStream) {
              const c = candidateById.get(sel.candidateId);
              if (!c) continue;
              if (seen.has(c.candidateId)) continue;
              seen.add(c.candidateId);
              const placement = `Fits best after ${c.insertAfterName}.`;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    candidateId: c.candidateId,
                    placeId: c.placeId,
                    name: c.name,
                    address: c.address,
                    location: c.location,
                    detourKm: c.detourKm,
                    insertAfterDestinationId: c.insertAfterDestinationId,
                    whyItFits: `${sel.whyItFits} ${placement}`.trim(),
                  }) + '\n'
                )
              );
              if (seen.size >= limit) break;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            controller.enqueue(encoder.encode(JSON.stringify({ error: msg }) + '\n'));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(body, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const { output } = await generateText({
      model: google('gemini-2.5-flash-lite'),
      prompt,
      output: Output.array({ element: elementSchema }),
    });

    const seen = new Set<string>();
    const suggestions = (output ?? [])
      .map((sel) => {
        const c = candidateById.get(sel.candidateId);
        if (!c) return null;
        if (seen.has(c.candidateId)) return null;
        seen.add(c.candidateId);
        const placement = `Fits best after ${c.insertAfterName}.`;
        return {
          candidateId: c.candidateId,
          placeId: c.placeId,
          name: c.name,
          address: c.address,
          location: c.location,
          detourKm: c.detourKm,
          insertAfterDestinationId: c.insertAfterDestinationId,
          whyItFits: `${sel.whyItFits} ${placement}`.trim(),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v != null)
      .slice(0, limit);

    if (suggestions.length === 0) {
      const fallback = [...candidates]
        .sort((a, b) => a.detourKm - b.detourKm)
        .slice(0, limit)
        .map((c) => ({
          candidateId: c.candidateId,
          placeId: c.placeId,
          name: c.name,
          address: c.address,
          location: c.location,
          detourKm: c.detourKm,
          insertAfterDestinationId: c.insertAfterDestinationId,
          whyItFits:
            `Close to your itinerary with a minimal detour. Fits best after ${c.insertAfterName}.`,
        }));
      return NextResponse.json({ suggestions: fallback });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error running discover:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

