/**
 * POST /api/collections/propose
 *
 * Server-to-server endpoint for Common Area NIF (or any future partner)
 * to propose new gardens / collections for the registry. Slugs are
 * generated server-side, deduped against the static seed + KV overlay,
 * and persisted to KV. Landing pages and posters are immediately live.
 *
 * Auth: Bearer $COLLECTIONS_SYNC_TOKEN
 *
 * Request:
 *   {
 *     "gardens": [
 *       {
 *         "name": "Heritage Farm",
 *         "city": "Hilton Head Island",
 *         "state": "SC",
 *         "type": "community-garden",    // optional, default community-garden
 *         "contactEmail": "...",          // optional
 *         "website": "...",               // optional
 *         "wave": 1,                      // optional
 *         "zone": "8a",                   // optional
 *         "address": "...",               // optional
 *         "description": "...",           // optional; auto-generated if omitted
 *         "tagline": "..."                // optional; default used if omitted
 *       }
 *     ]
 *   }
 *
 * Response:
 *   {
 *     "created": [{ "original_name": "...", "slug": "..." }],
 *     "skipped": [{ "name": "...", "reason": "..." }]
 *   }
 *
 * Idempotent: re-posting an existing garden returns its existing slug
 * in `created` (not `skipped`) so the caller can safely re-sync.
 */

import { NextResponse } from 'next/server';
import { warmFacebookOgCache } from '@/lib/facebookOgScrape';
import {
  getAllCollectionsAsync,
  upsertCollectionToKV,
  generateUniqueSlug,
  type Collection,
  type CollectionType,
} from '@/lib/collections';
import { requireSyncAuth } from '@/lib/syncAuth';

interface ProposeGarden {
  name: string;
  city: string;
  state: string;
  type?: CollectionType;
  contactEmail?: string;
  contactName?: string;
  website?: string;
  wave?: number;
  zone?: string;
  address?: string;
  description?: string;
  tagline?: string;
  heroImage?: string | null;
}

export async function POST(req: Request) {
  const auth = requireSyncAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { gardens?: ProposeGarden[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.gardens) || body.gardens.length === 0) {
    return NextResponse.json(
      { error: 'Body must be { gardens: [...] } with at least one entry' },
      { status: 400 },
    );
  }
  if (body.gardens.length > 200) {
    return NextResponse.json(
      { error: 'Max 200 gardens per request — chunk larger batches' },
      { status: 400 },
    );
  }

  // Load the current full set (seed + KV) to dedup by name+city and to
  // seed the taken-slugs set for collision avoidance.
  const existing = await getAllCollectionsAsync();
  const taken = new Set(existing.map(c => c.slug));

  // Lookup existing by normalized name+city so we can return the
  // already-assigned slug (idempotent re-post).
  const existingByKey = new Map<string, Collection>();
  for (const c of existing) {
    existingByKey.set(keyOf(c.name, c.location.city), c);
  }

  const today = new Date().toISOString().split('T')[0];
  const created: { original_name: string; slug: string }[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const g of body.gardens) {
    if (!g.name || !g.city || !g.state) {
      skipped.push({ name: g.name || '(unnamed)', reason: 'Missing name, city, or state' });
      continue;
    }

    // Idempotency: same name+city = return existing slug
    const existingMatch = existingByKey.get(keyOf(g.name, g.city));
    if (existingMatch) {
      created.push({ original_name: g.name, slug: existingMatch.slug });
      continue;
    }

    // Generate unique slug
    let slug: string;
    try {
      slug = generateUniqueSlug(g.name, g.city, taken);
    } catch (err) {
      skipped.push({
        name: g.name,
        reason: err instanceof Error ? err.message : 'slug generation failed',
      });
      continue;
    }
    taken.add(slug);

    const type: CollectionType = g.type || 'community-garden';
    const collection: Collection = {
      slug,
      type,
      name: g.name,
      location: {
        city: g.city,
        state: g.state,
        ...(g.address ? { address: g.address } : {}),
      },
      description:
        g.description ||
        defaultDescription(g.name, g.city, g.state, type),
      tagline: g.tagline || defaultTagline(type),
      heroImage: g.heroImage ?? null,
      sellerIds: [],
      active: true,
      addedDate: today,
      source: 'kv',
      ...(g.contactEmail ? { contactEmail: g.contactEmail } : {}),
      ...(g.contactName ? { contactName: g.contactName } : {}),
      ...(g.website ? { website: g.website } : {}),
      ...(g.wave !== undefined ? { wave: g.wave } : {}),
      ...(g.zone ? { zone: g.zone } : {}),
    };

    try {
      await upsertCollectionToKV(collection);
      warmFacebookOgCache(`/garden/${slug}`).catch(() => {});
      existingByKey.set(keyOf(g.name, g.city), collection);
      created.push({ original_name: g.name, slug });
    } catch (err) {
      skipped.push({
        name: g.name,
        reason: err instanceof Error ? err.message : 'KV write failed',
      });
    }
  }

  return NextResponse.json({ created, skipped });
}

// ─── Helpers ──────────────────────────────────────────────

function keyOf(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

function defaultDescription(
  name: string,
  city: string,
  state: string,
  type: CollectionType,
): string {
  if (type === 'community-garden') {
    return `A community garden in ${city}, ${state}. Gardeners here grow more food than they can eat — this page lets neighbors buy the surplus directly, with 100% going to the grower.`;
  }
  if (type === 'farmers-market') {
    return `A farmers market in ${city}, ${state}. Vendors here sell local produce — this page gathers their listings in one place.`;
  }
  return `${name} in ${city}, ${state}.`;
}

function defaultTagline(type: CollectionType): string {
  if (type === 'community-garden') return 'Fresh from your neighbors\u2019 beds.';
  if (type === 'farmers-market') return 'Fresh from this week\u2019s market.';
  return 'Local food, local people.';
}
