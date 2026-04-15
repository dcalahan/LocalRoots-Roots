/**
 * Community Gardens registry — static for v1.
 *
 * Matt Hunt's Heritage Farm outreach is the first test. The pattern: a
 * community garden puts up a printable QR code at their entrance, a
 * visitor scans it, and lands on `/garden/<slug>` filtered to that
 * garden's member sellers.
 *
 * Future: move this to KV or an admin UI so garden managers can register
 * themselves. For now, hand-curated.
 */

import data from '@/data/community-gardens.json';

export interface CommunityGarden {
  slug: string;
  name: string;
  location: {
    city: string;
    state: string;
    address?: string;
  };
  description: string;
  tagline: string;
  heroImage: string | null;
  /** On-chain seller IDs whose listings appear on this garden's page. */
  sellerIds: string[];
  contactName?: string;
  active: boolean;
  addedDate: string;
}

interface RegistryFile {
  version: string;
  gardens: CommunityGarden[];
}

const registry = data as RegistryFile;

export function getAllCommunityGardens(): CommunityGarden[] {
  return registry.gardens.filter(g => g.active);
}

export function getCommunityGarden(slug: string): CommunityGarden | null {
  return registry.gardens.find(g => g.slug === slug) ?? null;
}

/** The public URL for a garden's buyer landing page. */
export function gardenBuyerUrl(slug: string, baseUrl = 'https://www.localroots.love'): string {
  return `${baseUrl}/garden/${slug}`;
}
