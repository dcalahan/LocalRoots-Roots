/**
 * Collections registry — groups of sellers that share a surface.
 *
 * A "collection" is any bucket of sellers we want to show together on
 * a landing page: a community garden, a farmers market booth roster,
 * an ambassador cohort, a pop-up market weekend. The `type` field
 * discriminates them so UIs can render the right framing.
 *
 * Two sources:
 *   1. `@/data/collections.json` — seed data, checked into git. Fast,
 *      synchronous, survives KV outage.
 *   2. Vercel KV under `collection:<slug>` — runtime additions posted
 *      via `/api/collections/propose` by Common Area NIF or an admin UI.
 *
 * Use the sync `getCollection` / `getAllCollections` for client
 * components (JSON only). Use the async variants for server components
 * or API routes (merged view).
 */

import data from '@/data/collections.json';
import { kv } from './kv';

export type CollectionType =
  | 'community-garden'
  | 'farmers-market'
  | 'cohort'
  | 'popup';

export interface Collection {
  slug: string;
  type: CollectionType;
  name: string;
  location: {
    city: string;
    state: string;
    address?: string;
  };
  description: string;
  tagline: string;
  heroImage: string | null;
  /** On-chain seller IDs whose listings appear on this collection's page. */
  sellerIds: string[];
  contactName?: string;
  contactEmail?: string;
  website?: string;
  wave?: number;
  zone?: string;
  active: boolean;
  addedDate: string;
  /** 'seed' = from collections.json, 'kv' = added via propose API */
  source?: 'seed' | 'kv';
}

interface RegistryFile {
  version: string;
  collections: Collection[];
}

const registry = data as RegistryFile;

// ─── Sync (seed-only) accessors ────────────────────────────

export function getAllCollections(type?: CollectionType): Collection[] {
  return registry.collections.filter(
    c => c.active && (!type || c.type === type),
  );
}

export function getCollection(slug: string): Collection | null {
  return registry.collections.find(c => c.slug === slug) ?? null;
}

// ─── Async (seed + KV overlay) accessors ───────────────────

const KV_KEY_PREFIX = 'collection:';
const KV_INDEX_KEY = 'collections:index';

function kvKeyFor(slug: string): string {
  return `${KV_KEY_PREFIX}${slug}`;
}

export async function getCollectionAsync(slug: string): Promise<Collection | null> {
  // Seed takes priority — if both exist, seed wins (manually curated).
  const seeded = getCollection(slug);
  if (seeded) return { ...seeded, source: 'seed' };

  try {
    const kvEntry = await kv.get<Collection>(kvKeyFor(slug));
    if (kvEntry && kvEntry.active) return { ...kvEntry, source: 'kv' };
  } catch {
    /* KV down — degrade gracefully */
  }
  return null;
}

export async function getAllCollectionsAsync(
  type?: CollectionType,
): Promise<Collection[]> {
  const seed = getAllCollections(type).map(c => ({ ...c, source: 'seed' as const }));
  const seedSlugs = new Set(seed.map(c => c.slug));

  let kvEntries: Collection[] = [];
  try {
    const slugs = (await kv.get<string[]>(KV_INDEX_KEY)) || [];
    const unique = slugs.filter(s => !seedSlugs.has(s));
    const fetched = await Promise.all(unique.map(s => kv.get<Collection>(kvKeyFor(s))));
    kvEntries = fetched
      .filter((c): c is Collection => !!c && c.active && (!type || c.type === type))
      .map(c => ({ ...c, source: 'kv' as const }));
  } catch {
    /* KV down — seed-only */
  }

  return [...seed, ...kvEntries];
}

/**
 * Write a proposed collection to KV. Idempotent — re-proposing an
 * existing slug updates the fields in place (except `addedDate`).
 */
export async function upsertCollectionToKV(
  collection: Collection,
): Promise<void> {
  const existing = await kv.get<Collection>(kvKeyFor(collection.slug));
  const toWrite: Collection = existing
    ? { ...existing, ...collection, addedDate: existing.addedDate }
    : collection;

  await kv.set(kvKeyFor(collection.slug), toWrite);

  // Maintain a slug index so we can list all KV-added collections
  // without doing a KEYS scan (which is rate-limited on Upstash free).
  const index = (await kv.get<string[]>(KV_INDEX_KEY)) || [];
  if (!index.includes(collection.slug)) {
    index.push(collection.slug);
    await kv.set(KV_INDEX_KEY, index);
  }
}

// ─── URL builders ──────────────────────────────────────────

/** The public URL for a collection's buyer landing page. */
export function collectionBuyerUrl(
  collection: Pick<Collection, 'slug' | 'type'>,
  baseUrl = 'https://www.localroots.love',
): string {
  // Community gardens live at /garden/<slug>; other types can add their
  // own route prefixes here as they come online.
  if (collection.type === 'community-garden') {
    return `${baseUrl}/garden/${collection.slug}`;
  }
  return `${baseUrl}/c/${collection.slug}`;
}

/** The public URL for a collection's printable QR poster. */
export function collectionPosterUrl(
  collection: Collection,
  baseUrl = 'https://www.localroots.love',
): string {
  if (collection.type === 'community-garden') {
    return `${baseUrl}/garden/${collection.slug}/poster`;
  }
  // Fallback: generic poster with prefilled params
  const buyer = collectionBuyerUrl(collection, baseUrl);
  const qs = new URLSearchParams({
    url: buyer,
    title: collection.name,
    tagline: collection.tagline,
    accent: 'teal',
  });
  return `${baseUrl}/poster?${qs.toString()}`;
}

// ─── Slug generator (shared between API and scripts) ───────

const CITY_ABBR: Record<string, string> = {
  Atlanta: 'atl',
  Oakland: 'oak',
  'San Francisco': 'sf',
  'San Jose': 'sj',
  Richmond: 'rich',
  'Hilton Head Island': 'hhi',
  Charleston: 'chs',
  Georgetown: 'gtsc',
  Marietta: 'mar',
  Lafayette: 'laf',
  'College Park': 'cp',
  Napa: 'napa',
  Sebastopol: 'seb',
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function cityAbbr(city: string): string {
  return CITY_ABBR[city] || slugify(city);
}

export function baseSlugFromName(name: string): string {
  let s = slugify(name);
  const tokens = s.split('-');
  if (
    tokens.length > 2 &&
    (s.endsWith('-community-garden') || s.endsWith('-community-gardens'))
  ) {
    s = s.replace(/-community-gardens?$/, '');
  }
  return s;
}

/**
 * Generate a unique slug for a new collection, checking against a set
 * of taken slugs. Collision handling: append city abbr, then a hash
 * suffix as a last resort.
 */
export function generateUniqueSlug(
  name: string,
  city: string,
  takenSlugs: Set<string>,
): string {
  const base = baseSlugFromName(name);
  if (!takenSlugs.has(base)) return base;

  const withCity = `${base}-${cityAbbr(city)}`;
  if (!takenSlugs.has(withCity)) return withCity;

  // Fallback: append short hash of full name
  for (let i = 2; i < 100; i++) {
    const candidate = `${withCity}-${i}`;
    if (!takenSlugs.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate unique slug for "${name}" in ${city}`);
}
