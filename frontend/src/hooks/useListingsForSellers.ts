/**
 * Filter all active listings down to a specific set of seller IDs.
 *
 * Generic primitive — used by community garden pages, farmers-market
 * landing pages, seller cohort pages, or any "collection of sellers"
 * surface. Keeps the scary marketplace query in one place so callers
 * just get back filtered listings.
 */

import { useMemo } from 'react';
import { useAllListings } from './useListings';

export function useListingsForSellers(sellerIds: string[]) {
  const { listings, isLoading } = useAllListings();

  const filtered = useMemo(() => {
    if (!sellerIds || sellerIds.length === 0) return [];
    const set = new Set(sellerIds);
    return listings.filter(l => set.has(l.sellerId));
  }, [sellerIds, listings]);

  return { listings: filtered, isLoading };
}
