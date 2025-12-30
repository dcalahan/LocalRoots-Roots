'use client';

import { useEffect, useState, useCallback } from 'react';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { useSellerStatus } from './useSellerStatus';
import { getIpfsUrl } from '@/lib/pinata';

interface ListingMetadata {
  produceName: string;
  description: string;
  imageUrl: string | null;
  unit: string;
  category: string;
}

export interface SellerListing {
  listingId: string;
  metadataIpfs: string;
  pricePerUnit: string;
  quantityAvailable: number;
  active: boolean;
  metadata?: ListingMetadata;
}

// Convert an image reference to a displayable URL
function getImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

async function fetchIpfsMetadata(metadataUri: string): Promise<ListingMetadata | null> {
  try {
    // Handle data URIs (used during MVP before IPFS upload)
    if (metadataUri.startsWith('data:application/json,')) {
      const jsonStr = decodeURIComponent(metadataUri.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        produceName: data.produceName || 'Unknown',
        description: data.description || '',
        imageUrl: getImageUrl(data.images?.[0]),
        unit: data.unitName || data.unitId || 'unit',
        category: data.category || '',
      };
    }

    // Handle IPFS hashes
    const url = metadataUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataUri.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${metadataUri}`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    // Convert image hash to URL
    return {
      produceName: data.produceName || 'Unknown',
      description: data.description || '',
      imageUrl: getImageUrl(data.images?.[0]),
      unit: data.unitName || data.unitId || 'unit',
      category: data.category || '',
    };
  } catch (err) {
    console.error('Error parsing metadata:', err);
    return null;
  }
}

export function useSellerListings() {
  const { sellerId } = useSellerStatus();
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
    if (!sellerId) {
      setListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create fresh client for each fetch to avoid caching issues
      const client = createFreshPublicClient();

      // Get next listing ID to know how many listings exist
      const nextListingId = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'nextListingId',
      }) as bigint;

      // Add buffer to catch listings the RPC might be behind on
      const checkUpTo = nextListingId + 5n;

      console.log('[useSellerListings] nextListingId:', nextListingId.toString(), 'checking up to:', checkUpTo.toString(), 'sellerId:', sellerId?.toString());

      const sellerListings: SellerListing[] = [];

      // Iterate through all listings and filter by seller
      for (let i = 1n; i < checkUpTo; i++) {
        try {
          const listing = await client.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'listings',
            args: [i],
          }) as [bigint, string, bigint, bigint, boolean];

          const [listingSellerId, metadataIpfs, pricePerUnit, quantityAvailable, active] = listing;

          console.log(`[useSellerListings] Listing ${i}: sellerId=${listingSellerId.toString()}, matches=${listingSellerId === sellerId}`);

          // Only include listings for this seller
          if (listingSellerId === sellerId) {
            const metadata = await fetchIpfsMetadata(metadataIpfs);

            sellerListings.push({
              listingId: i.toString(),
              metadataIpfs,
              pricePerUnit: pricePerUnit.toString(),
              quantityAvailable: Number(quantityAvailable),
              active,
              metadata: metadata || undefined,
            });
          }
        } catch (err) {
          console.error(`Error fetching listing ${i}:`, err);
        }
      }

      setListings(sellerListings);
    } catch (err) {
      console.error('Error fetching seller listings:', err);
      setError('Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  return { listings, isLoading, error, refetch: fetchListings };
}
