'use client';

import { useEffect, useState, useCallback } from 'react';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { getIpfsUrl } from '@/lib/pinata';
import type { ListingCardData } from '@/components/buyer/ListingCard';

interface ListingMetadata {
  produceName: string;
  description: string;
  imageUrl: string | null;
  unit: string;
  category: string;
}

interface SellerMetadata {
  name: string;
  description: string;
  imageUrl: string | null;
}

// Test metadata for development (when IPFS metadata is not available)
const TEST_METADATA: Record<string, ListingMetadata> = {
  'test-tomatoes': {
    produceName: 'Heirloom Tomatoes',
    description: 'Freshly picked Cherokee Purple and Brandywine heirloom tomatoes. Organically grown, no pesticides.',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop',
    unit: 'lb',
    category: 'vegetables',
  },
  'test-peppers': {
    produceName: 'Bell Peppers',
    description: 'Mix of red, yellow, and green bell peppers. Sweet and crunchy, perfect for salads or cooking.',
    imageUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=300&fit=crop',
    unit: 'each',
    category: 'vegetables',
  },
  'test-basil': {
    produceName: 'Fresh Basil',
    description: 'Aromatic Genovese basil, freshly cut. Great for pesto, caprese, or Italian dishes.',
    imageUrl: 'https://images.unsplash.com/photo-1618164435735-413d3b066c9a?w=400&h=300&fit=crop',
    unit: 'bunch',
    category: 'herbs',
  },
};

const TEST_SELLER_METADATA: SellerMetadata = {
  name: 'Hilton Head Garden',
  description: 'Fresh organic vegetables from my backyard garden in Hilton Head Island.',
  imageUrl: null,
};

// Convert an image reference to a displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

async function fetchIpfsMetadata<T>(metadataUri: string): Promise<T | null> {
  // Check for test metadata first
  if (metadataUri.startsWith('test-')) {
    const testData = TEST_METADATA[metadataUri] || TEST_SELLER_METADATA;
    return testData as T;
  }

  // Check for test seller metadata
  if (metadataUri === 'test-seller-hiltonhead') {
    return TEST_SELLER_METADATA as T;
  }

  // Handle data URIs (used during MVP before IPFS upload)
  if (metadataUri.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(metadataUri.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      // Transform to expected format for listings
      return {
        produceName: data.produceName || 'Unknown',
        description: data.description || '',
        imageUrl: resolveImageUrl(data.images?.[0]),
        unit: data.unitName || data.unitId || 'unit',
        category: data.category || '',
        // Also include seller metadata fields in case this is a seller
        name: data.name || 'Local Seller',
      } as T;
    } catch (err) {
      console.error('Error parsing data URI metadata:', err);
      return null;
    }
  }

  try {
    // Convert IPFS hash to gateway URL
    const url = metadataUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataUri.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${metadataUri}`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    // Convert image hash to URL and return normalized metadata
    return {
      produceName: data.produceName || 'Unknown',
      description: data.description || '',
      imageUrl: resolveImageUrl(data.images?.[0]),
      unit: data.unitName || data.unitId || 'unit',
      category: data.category || '',
      // Also include seller metadata fields in case this is a seller
      name: data.name || 'Local Seller',
    } as T;
  } catch {
    return null;
  }
}

export function useAllListings() {
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchListings = useCallback(async () => {
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

      const listingPromises: Promise<ListingCardData | null>[] = [];

      // Fetch all listings (starting from 1)
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

async function fetchListingData(listingId: bigint, client?: ReturnType<typeof createFreshPublicClient>): Promise<ListingCardData | null> {
  const publicClient = client || createFreshPublicClient();
  try {
    // Fetch listing from contract
    const listing = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'listings',
      args: [listingId],
    }) as [bigint, string, bigint, bigint, boolean];

    const [sellerId, metadataIpfs, pricePerUnit, quantityAvailable, active] = listing;

    if (!active) return null;

    // Fetch seller info
    const seller = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellers',
      args: [sellerId],
    }) as [string, string, string, boolean, boolean, bigint, bigint, boolean];

    const [, , storefrontIpfs, offersDelivery, offersPickup, , , sellerActive] = seller;

    if (!sellerActive) return null;

    // Fetch metadata from IPFS
    const [listingMeta, sellerMeta] = await Promise.all([
      fetchIpfsMetadata<ListingMetadata>(metadataIpfs),
      fetchIpfsMetadata<SellerMetadata>(storefrontIpfs),
    ]);

    return {
      listingId: listingId.toString(),
      sellerId: sellerId.toString(),
      pricePerUnit: pricePerUnit.toString(),
      quantityAvailable: Number(quantityAvailable),
      metadata: {
        produceName: listingMeta?.produceName || 'Unknown Product',
        description: listingMeta?.description,
        imageUrl: listingMeta?.imageUrl || null,
        unit: listingMeta?.unit || 'unit',
        category: listingMeta?.category,
      },
      seller: {
        name: sellerMeta?.name || 'Local Seller',
        offersDelivery,
        offersPickup,
      },
    };
  } catch (err) {
    console.error(`Error fetching listing ${listingId}:`, err);
    return null;
  }
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
