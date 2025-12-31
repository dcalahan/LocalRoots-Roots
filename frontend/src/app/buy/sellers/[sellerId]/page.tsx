'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListingsGrid } from '@/components/buyer/ListingsGrid';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { publicClient } from '@/lib/viemClient';
import { getIpfsUrl } from '@/lib/pinata';
import type { ListingCardData } from '@/components/buyer/ListingCard';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

interface SellerInfo {
  owner: string;
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  active: boolean;
}

interface SellerMetadata {
  name: string;
  description: string;
  imageUrl: string | null;
  email?: string;
  phone?: string;
}

// Test metadata fallback
const TEST_SELLER_METADATA: SellerMetadata = {
  name: 'Hilton Head Garden',
  description: 'Fresh organic vegetables from my backyard garden in Hilton Head Island.',
  imageUrl: null,
};

async function fetchIpfsMetadata(metadataUri: string): Promise<SellerMetadata | null> {
  if (metadataUri.startsWith('test-')) {
    return TEST_SELLER_METADATA;
  }

  // Handle data URIs (used during MVP before IPFS upload)
  if (metadataUri.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(metadataUri.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        name: data.name || 'Local Seller',
        description: data.description || '',
        imageUrl: resolveImageUrl(data.profileImage || data.imageUrl),
        email: data.email,
        phone: data.phone,
      };
    } catch (err) {
      console.error('Error parsing seller metadata:', err);
      return null;
    }
  }

  try {
    const url = metadataUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataUri.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${metadataUri}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      name: data.name || 'Local Seller',
      description: data.description || '',
      imageUrl: resolveImageUrl(data.imageUrl),
      email: data.email,
      phone: data.phone,
    };
  } catch {
    return null;
  }
}

export default function SellerProfilePage() {
  const params = useParams();
  const sellerId = params.sellerId as string;

  const [seller, setSeller] = useState<SellerInfo | null>(null);
  const [metadata, setMetadata] = useState<SellerMetadata | null>(null);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSellerData() {
      if (!sellerId) return;

      setIsLoading(true);
      setError(null);

      try {
        // Fetch seller info
        const sellerData = await publicClient.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'sellers',
          args: [BigInt(sellerId)],
        }) as [string, string, string, boolean, boolean, bigint, bigint, boolean];

        const [owner, geohash, storefrontIpfs, offersDelivery, offersPickup, deliveryRadiusKm, , active] = sellerData;

        if (!active) {
          setError('This seller is no longer active');
          setIsLoading(false);
          return;
        }

        setSeller({
          owner,
          geohash,
          storefrontIpfs,
          offersDelivery,
          offersPickup,
          deliveryRadiusKm: Number(deliveryRadiusKm),
          active,
        });

        // Fetch metadata
        const meta = await fetchIpfsMetadata(storefrontIpfs);
        setMetadata(meta || { name: 'Local Seller', description: '', imageUrl: null });

        // Fetch all listings and filter by this seller
        const nextListingId = await publicClient.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'nextListingId',
        }) as bigint;

        const sellerListings: ListingCardData[] = [];

        for (let i = 1n; i < nextListingId; i++) {
          try {
            const listing = await publicClient.readContract({
              address: MARKETPLACE_ADDRESS,
              abi: marketplaceAbi,
              functionName: 'listings',
              args: [i],
            }) as [bigint, string, bigint, bigint, boolean];

            const [listingSellerId, metadataIpfs, pricePerUnit, quantityAvailable, listingActive] = listing;

            if (listingSellerId.toString() === sellerId && listingActive && quantityAvailable > 0n) {
              // Fetch listing metadata
              const listingMeta = await fetchListingMetadata(metadataIpfs);

              sellerListings.push({
                listingId: i.toString(),
                sellerId: sellerId,
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
                  name: meta?.name || 'Local Seller',
                  offersDelivery,
                  offersPickup,
                  geohash,
                  deliveryRadiusKm: Number(deliveryRadiusKm),
                },
              });
            }
          } catch (err) {
            console.error(`Error fetching listing ${i}:`, err);
          }
        }

        setListings(sellerListings);
      } catch (err) {
        console.error('Error fetching seller:', err);
        setError('Failed to load seller profile');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSellerData();
  }, [sellerId]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2">Seller Not Found</h1>
        <p className="text-roots-gray mb-4">{error}</p>
        <Link href="/buy">
          <Button>Back to Shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Back button */}
      <Link href="/buy" className="inline-flex items-center text-roots-gray hover:text-roots-primary mb-6">
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Shop
      </Link>

      {/* Seller header */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Profile image */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl bg-roots-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {metadata?.imageUrl ? (
                <img
                  src={metadata.imageUrl}
                  alt={metadata.name || 'Seller'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl md:text-5xl font-bold text-roots-primary">
                  {metadata?.name?.charAt(0).toUpperCase() || 'S'}
                </span>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-heading font-bold mb-3">{metadata?.name || 'Local Seller'}</h1>

              {metadata?.description && (
                <p className="text-roots-gray mb-4 text-base leading-relaxed">{metadata.description}</p>
              )}

              <div className="flex flex-wrap gap-2 md:gap-3">
                {seller?.offersPickup && (
                  <span className="inline-flex items-center gap-1.5 text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Pickup Available
                  </span>
                )}
                {seller?.offersDelivery && (
                  <span className="inline-flex items-center gap-1.5 text-sm bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                    </svg>
                    Delivers ({Math.round(seller?.deliveryRadiusKm * 0.621)} mi)
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-sm bg-roots-primary/10 text-roots-primary px-3 py-1.5 rounded-full font-medium">
                  {listings.length} {listings.length === 1 ? 'item' : 'items'} available
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seller's listings */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Available from this Seller</h2>
        <ListingsGrid
          listings={listings}
          isLoading={false}
          emptyMessage="This seller has no active listings right now."
        />
      </section>
    </div>
  );
}

// Helper to fetch listing metadata
interface ListingMetadata {
  produceName: string;
  description?: string;
  imageUrl: string | null;
  unit: string;
  category?: string;
}

const TEST_LISTING_METADATA: Record<string, ListingMetadata> = {
  'test-tomatoes': {
    produceName: 'Heirloom Tomatoes',
    description: 'Freshly picked Cherokee Purple and Brandywine heirloom tomatoes.',
    imageUrl: null,
    unit: 'lb',
    category: 'vegetables',
  },
  'test-peppers': {
    produceName: 'Bell Peppers',
    description: 'Mix of red, yellow, and green bell peppers.',
    imageUrl: null,
    unit: 'each',
    category: 'vegetables',
  },
  'test-basil': {
    produceName: 'Fresh Basil',
    description: 'Aromatic Genovese basil, freshly cut.',
    imageUrl: null,
    unit: 'bunch',
    category: 'herbs',
  },
};

async function fetchListingMetadata(metadataUri: string): Promise<ListingMetadata | null> {
  if (metadataUri.startsWith('test-')) {
    return TEST_LISTING_METADATA[metadataUri] || null;
  }

  // Handle data URIs (used during MVP before IPFS upload)
  if (metadataUri.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(metadataUri.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        produceName: data.produceName || 'Unknown',
        description: data.description || '',
        imageUrl: resolveImageUrl(data.images?.[0]),
        unit: data.unitName || data.unitId || 'unit',
        category: data.category || '',
      };
    } catch (err) {
      console.error('Error parsing listing metadata:', err);
      return null;
    }
  }

  try {
    const url = metadataUri.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataUri.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${metadataUri}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      produceName: data.produceName || 'Unknown',
      description: data.description || '',
      imageUrl: resolveImageUrl(data.images?.[0] || data.imageUrl),
      unit: data.unitName || data.unitId || 'unit',
      category: data.category || '',
    };
  } catch {
    return null;
  }
}
