/**
 * GET /api/collections/resolve
 *
 * Server-to-server endpoint for Common Area NIF (or any future partner)
 * to resolve slugs → landing/poster URLs without maintaining its own copy
 * of the registry. Merges static seed + KV overlay.
 *
 * Auth: Bearer $COLLECTIONS_SYNC_TOKEN
 *
 * Query:
 *   ?slugs=a,b,c              — return these specific slugs (missing ones omitted)
 *   ?since=2025-01-01         — return all active collections added on/after date
 *   (neither)                 — return all active collections
 *   &type=community-garden    — optional type filter
 *
 * Response:
 *   {
 *     "collections": [
 *       {
 *         "slug": "...",
 *         "type": "community-garden",
 *         "name": "...",
 *         "city": "...",
 *         "state": "...",
 *         "buyer_url": "https://www.localroots.love/garden/...",
 *         "poster_url": "https://www.localroots.love/garden/.../poster",
 *         "active": true,
 *         "added_date": "2025-04-15",
 *         "source": "seed" | "kv"
 *       }
 *     ]
 *   }
 */

import { NextResponse } from 'next/server';
import {
  getAllCollectionsAsync,
  getCollectionAsync,
  collectionBuyerUrl,
  collectionPosterUrl,
  type Collection,
  type CollectionType,
} from '@/lib/collections';
import { requireSyncAuth } from '@/lib/syncAuth';

const VALID_TYPES: CollectionType[] = [
  'community-garden',
  'farmers-market',
  'cohort',
  'popup',
];

export async function GET(req: Request) {
  const auth = requireSyncAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(req.url);
  const slugsParam = url.searchParams.get('slugs');
  const since = url.searchParams.get('since');
  const typeParam = url.searchParams.get('type');

  const type =
    typeParam && VALID_TYPES.includes(typeParam as CollectionType)
      ? (typeParam as CollectionType)
      : undefined;

  let matched: Collection[] = [];

  if (slugsParam) {
    const slugs = slugsParam
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const fetched = await Promise.all(slugs.map(s => getCollectionAsync(s)));
    matched = fetched.filter((c): c is Collection => !!c);
    if (type) matched = matched.filter(c => c.type === type);
  } else {
    matched = await getAllCollectionsAsync(type);
    if (since) {
      // ISO date string compare works for YYYY-MM-DD
      matched = matched.filter(c => c.addedDate >= since);
    }
  }

  const collections = matched.map(c => ({
    slug: c.slug,
    type: c.type,
    name: c.name,
    city: c.location.city,
    state: c.location.state,
    buyer_url: collectionBuyerUrl(c),
    poster_url: collectionPosterUrl(c),
    active: c.active,
    added_date: c.addedDate,
    source: c.source ?? 'seed',
  }));

  return NextResponse.json({ collections });
}
