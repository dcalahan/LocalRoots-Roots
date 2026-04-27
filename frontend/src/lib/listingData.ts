/**
 * Server-safe listing data fetcher.
 *
 * Reads listing + seller data from the marketplace contract and IPFS.
 * No browser APIs — works in both server components and client hooks.
 */

import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { getIpfsUrl } from '@/lib/pinata';
import { resolveListingImage } from '@/lib/produce';
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

// Test metadata for development
const TEST_METADATA: Record<string, ListingMetadata> = {
  'test-tomatoes': {
    produceName: 'Heirloom Tomatoes',
    description: 'Freshly picked Cherokee Purple and Brandywine heirloom tomatoes.',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop',
    unit: 'lb',
    category: 'vegetables',
  },
  'test-peppers': {
    produceName: 'Bell Peppers',
    description: 'Mix of red, yellow, and green bell peppers.',
    imageUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400&h=300&fit=crop',
    unit: 'each',
    category: 'vegetables',
  },
  'test-basil': {
    produceName: 'Fresh Basil',
    description: 'Aromatic Genovese basil, freshly cut.',
    imageUrl: 'https://images.unsplash.com/photo-1618164435735-413d3b066c9a?w=400&h=300&fit=crop',
    unit: 'bunch',
    category: 'herbs',
  },
};

const TEST_SELLER_METADATA: SellerMetadata = {
  name: 'Hilton Head Garden',
  description: 'Fresh organic vegetables from my backyard garden.',
  imageUrl: null,
};

function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) return imageRef;
  return getIpfsUrl(imageRef);
}

/**
 * Resolve an image reference to a URL suitable for OG meta tags.
 * Prefers Pinata gateway (more reliable for crawlers) over ipfs.io.
 */
export function resolveOgImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) return imageRef;
  if (imageRef.startsWith('ipfs://')) imageRef = imageRef.replace('ipfs://', '');
  return `https://gateway.pinata.cloud/ipfs/${imageRef}`;
}

export async function fetchIpfsMetadata<T>(metadataUri: string): Promise<T | null> {
  if (metadataUri.startsWith('test-')) {
    const testData = TEST_METADATA[metadataUri] || TEST_SELLER_METADATA;
    return testData as T;
  }
  if (metadataUri === 'test-seller-hiltonhead') {
    return TEST_SELLER_METADATA as T;
  }

  if (metadataUri.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(metadataUri.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        produceName: data.produceName || 'Unknown',
        description: data.description || '',
        imageUrl: resolveListingImage(data, resolveImageUrl),
        unit: data.unitName || data.unitId || 'unit',
        category: data.category || '',
        name: data.name || 'Local Seller',
      } as T;
    } catch {
      return null;
    }
  }

  try {
    const url = metadataUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataUri.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${metadataUri}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();

    return {
      produceName: data.produceName || 'Unknown',
      description: data.description || '',
      imageUrl: resolveListingImage(data, resolveImageUrl),
      unit: data.unitName || data.unitId || 'unit',
      category: data.category || '',
      name: data.name || 'Local Seller',
    } as T;
  } catch {
    return null;
  }
}

/**
 * Fetch a single listing's full data from the contract + IPFS.
 * Works server-side (no browser APIs).
 */
export async function fetchListingData(
  listingId: bigint,
  client?: ReturnType<typeof createFreshPublicClient>,
): Promise<ListingCardData | null> {
  const publicClient = client || createFreshPublicClient();
  try {
    const listing = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'listings',
      args: [listingId],
    }) as [bigint, string, bigint, bigint, boolean];

    const [sellerId, metadataIpfs, pricePerUnit, quantityAvailable, active] = listing;
    if (!active) return null;

    const seller = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellers',
      args: [sellerId],
    }) as [string, string, string, boolean, boolean, bigint, bigint, boolean];

    const [, sellerGeohash, storefrontIpfs, offersDelivery, offersPickup, deliveryRadiusKm, , sellerActive] = seller;
    if (!sellerActive) return null;

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
        geohash: sellerGeohash,
        deliveryRadiusKm: Number(deliveryRadiusKm),
      },
    };
  } catch (err) {
    console.error(`[listingData] Error fetching listing ${listingId}:`, err);
    return null;
  }
}
