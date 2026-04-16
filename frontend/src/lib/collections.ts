/**
 * Collections registry — groups of sellers that share a surface.
 *
 * A "collection" is any bucket of sellers we want to show together on
 * a landing page: a community garden, a farmers market booth roster,
 * an ambassador cohort, a pop-up market weekend. The `type` field
 * discriminates them so UIs can render the right framing.
 *
 * Future: move to KV or an admin UI. For now, hand-curated.
 */

import data from '@/data/collections.json';

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
  active: boolean;
  addedDate: string;
}

interface RegistryFile {
  version: string;
  collections: Collection[];
}

const registry = data as RegistryFile;

export function getAllCollections(type?: CollectionType): Collection[] {
  return registry.collections.filter(
    c => c.active && (!type || c.type === type),
  );
}

export function getCollection(slug: string): Collection | null {
  return registry.collections.find(c => c.slug === slug) ?? null;
}

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
