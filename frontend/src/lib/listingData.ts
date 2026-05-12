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

  // Multi-gateway race. The public Pinata gateway (gateway.pinata.cloud) is
  // hard rate-limited and routinely takes 4–7s for cold-cache reads —
  // empirically slower than our 5s abort timeout, which produced silent
  // "Unknown Product" fallbacks on /buy. ipfs.io serves the same CIDs in
  // ~150ms. Race both so a single-gateway hiccup doesn't blank the card.
  // Matches the working pattern in `lib/pinata.ts` getIpfsUrl().
  const cid = metadataUri.startsWith('ipfs://') ? metadataUri.slice(7) : metadataUri;
  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await Promise.any(
      gateways.map(async (url) => {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
      }),
    );
    clearTimeout(timeout);

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
