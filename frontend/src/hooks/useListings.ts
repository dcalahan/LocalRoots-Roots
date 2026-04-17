'use client';

import { useEffect, useState, useCallback } from 'react';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { fetchListingData } from '@/lib/listingData';
import type { ListingCardData } from '@/components/buyer/ListingCard';

export function useAllListings() {
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      const nextListingId = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'nextListingId',
      }) as bigint;

      const checkUpTo = nextListingId + 5n;

      const listingPromises: Promise<ListingCardData | null>[] = [];
      for (let i = 1n; i < checkUpTo; i++) {
        listingPromises.push(fetchListingData(i, client));
      }

      const results = await Promise.all(listingPromises);
      const validListings = results.filter((l): l is ListingCardData => l !== null && l.quantityAvailable > 0);

      setListings(validListings);
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError('Failed to load listings. Make sure you are on Base Sepolia network.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, isLoading, error, refetch: fetchListings };
}

export function useListingDetail(listingId: string) {
  const [listing, setListing] = useState<ListingCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!listingId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchListingData(BigInt(listingId));
        if (data) {
          setListing(data);
        } else {
          setError('Listing not found');
        }
      } catch (err) {
        console.error('Error fetching listing detail:', err);
        setError('Failed to load listing');
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, [listingId]);

  return { listing, isLoading, error };
}
