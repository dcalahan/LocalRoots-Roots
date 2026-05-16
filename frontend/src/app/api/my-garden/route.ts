import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import type { GardenPlant, GardenBed, MyGardenData } from '@/types/my-garden';
import { warmFacebookOgCache } from '@/lib/facebookOgScrape';
import { credit, type VerbId, type CreditResult } from '@/lib/offchainRP';
import { getIpGeoFromRequest } from '@/lib/ipGeo';

function kvKey(userId: string): string {
  return `my-garden:${userId}`;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ plants: [], beds: [] });
  }

  try {
    const data = await kv.get<MyGardenData>(kvKey(userId));
    return NextResponse.json({
      plants: data?.plants || [],
      beds: data?.beds || [],
    });
  } catch {
    return NextResponse.json({ plants: [], beds: [] });
  }
}

/**
 * PUT diff types — what changed between previous KV state and the
 * incoming payload. Each yields zero or more `credit()` calls.
 *
 * All diffs run BEFORE writing the new data, so we have access to the
 * previous values for each plant/bed.
 *
 * Idempotency is preserved by:
 *   - credit() using setnx on `rp:offchain:event:{hash(verb, dedupKey)}`
 *   - The dedupKey for each verb is plant.id, bed.id, or a stable
 *     composite — never time-varying. Same diff produced twice → no
 *     double-credit.
 */

interface DiffEvent {
  verbId: VerbId;
  dedupKey: string;
}

function diffMyGarden(
  previous: MyGardenData | null,
  next: { plants: GardenPlant[]; beds: GardenBed[] },
): DiffEvent[] {
  const events: DiffEvent[] = [];

  const prevPlantsById = new Map<string, GardenPlant>();
  for (const p of previous?.plants ?? []) {
    if (p.id) prevPlantsById.set(p.id, p);
  }
  const prevBedsById = new Map<string, GardenBed>();
  for (const b of previous?.beds ?? []) {
    if (b.id) prevBedsById.set(b.id, b);
  }

  // ── Plants ─────────────────────────────────────────────────────
  for (const plant of next.plants ?? []) {
    if (!plant.id) continue;
    const prev = prevPlantsById.get(plant.id);

    // 1) plant-added — plant.id not in previous
    if (!prev) {
      events.push({ verbId: 'plant-added', dedupKey: plant.id });
      // A newly-added plant could include a harvest record on first
      // save. Credit harvest-logged independently of plant-added.
      if (plant.harvestedDate) {
        events.push({ verbId: 'harvest-logged', dedupKey: `${plant.id}:${plant.harvestedDate}` });
      }
      // NOTE: plant-photo verb stays declared but live: false in the
      // registry until GardenPlant gets a photoIpfs field. When that
      // ships, add the diff here.
      continue;
    }

    // 2) harvest-logged — harvestedDate transition from unset → set
    if (plant.harvestedDate && !prev.harvestedDate) {
      events.push({ verbId: 'harvest-logged', dedupKey: `${plant.id}:${plant.harvestedDate}` });
    }

    // 3) plant-update — notes / quantity / manualStatus changed.
    //    Dedupe key is a hash of the new content so identical re-saves
    //    don't re-credit.
    const noteChange = (plant.notes ?? '') !== (prev.notes ?? '');
    const qtyChange = plant.quantity !== prev.quantity;
    const statusChange = (plant.manualStatus ?? '') !== (prev.manualStatus ?? '');
    if (noteChange || qtyChange || statusChange) {
      // Include the day to allow one update credit per plant per day max
      // (within the daily cap). Multiple edits on same day to same plant
      // collapse to one credit due to deduplication.
      const today = new Date().toISOString().slice(0, 10);
      events.push({ verbId: 'plant-update', dedupKey: `${plant.id}:${today}` });
    }
  }

  // ── Beds ───────────────────────────────────────────────────────
  for (const bed of next.beds ?? []) {
    if (!bed.id) continue;
    const prev = prevBedsById.get(bed.id);

    // 5) bed-created — bed.id not in previous
    if (!prev) {
      events.push({ verbId: 'bed-created', dedupKey: bed.id });
      if (bed.photoIpfs) {
        events.push({ verbId: 'bed-photo', dedupKey: `${bed.id}:photo-first` });
      }
      continue;
    }

    // 6) bed-photo — photoIpfs transition
    if (bed.photoIpfs && bed.photoIpfs !== prev.photoIpfs) {
      events.push({ verbId: 'bed-photo', dedupKey: `${bed.id}:${bed.photoIpfs}` });
    }
  }

  return events;
}

interface RpAggregator {
  credited: number;
  rpAmount: number;
  newTotal: number;
  cappedCount: number;
  byVerb: Partial<Record<VerbId, number>>;
}

async function applyCreditEvents(
  userId: string,
  events: DiffEvent[],
  ipMeta: import('@/lib/ipGeo').IpGeoMeta,
): Promise<RpAggregator> {
  const agg: RpAggregator = {
    credited: 0,
    rpAmount: 0,
    newTotal: 0,
    cappedCount: 0,
    byVerb: {},
  };

  // Sequential so the per-user summary's read-modify-write doesn't race
  // against itself. The credit() function never throws — partial KV
  // failures return ok:false and we keep iterating.
  for (const evt of events) {
    let result: CreditResult;
    try {
      result = await credit(evt.verbId, userId, evt.dedupKey, { ipMeta });
    } catch (err) {
      // Defensive: credit() shouldn't throw, but never let a credit error
      // break the response. Log and continue.
      console.error('[my-garden] credit threw (should never happen):', evt, err);
      continue;
    }
    if (result.ok && result.credited) {
      agg.credited += 1;
      agg.rpAmount += result.rpAmount;
      agg.newTotal = result.newTotal;
      agg.byVerb[evt.verbId] = (agg.byVerb[evt.verbId] ?? 0) + result.rpAmount;
    } else if (result.ok && !result.credited) {
      if (result.reason === 'daily-cap' || result.reason === 'lifetime-cap') {
        agg.cappedCount += 1;
      }
      // duplicate / not-live / anonymous → silent
    }
  }

  return agg;
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plants, beds } = body as {
      userId: string;
      plants: GardenPlant[];
      beds?: GardenBed[];
    };

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Read previous state for diffing BEFORE the write. Both reads and
    // writes can fail; the order matters: we want diff-detection to be
    // best-effort (no RP > wrong RP) and persistence to be authoritative.
    const previousData = await kv.get<MyGardenData>(kvKey(userId)).catch(() => null);

    const data: MyGardenData = {
      version: 2,
      plants: plants || [],
      beds: beds || [],
    };
    await kv.set(kvKey(userId), data);

    // Warm Facebook OG cache if user has a public garden profile
    kv.get(`garden-profile:${userId}`).then(profile => {
      if (profile) warmFacebookOgCache(`/gardeners/${encodeURIComponent(userId)}`).catch(() => {});
    }).catch(() => {});

    // Compute the diff and apply credit() for each event.
    const events = diffMyGarden(previousData, { plants: data.plants, beds: data.beds ?? [] });
    const rp = await applyCreditEvents(userId, events, getIpGeoFromRequest(request));

    return NextResponse.json({
      ok: true,
      rp,
    });
  } catch (err) {
    console.error('[my-garden] Save failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}
