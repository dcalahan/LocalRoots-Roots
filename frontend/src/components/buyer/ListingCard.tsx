'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { AddToCartModal } from './AddToCartModal';
import { getIpfsUrl } from '@/lib/pinata';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  return getIpfsUrl(imageRef);
}

export interface ListingCardData {
  listingId: string;
  sellerId: string;
  pricePerUnit: string;
  quantityAvailable: number;
  metadata: {
    produceName: string;
    description?: string;
    imageUrl: string | null;
    unit: string;
    category?: string;
  };
  seller: {
    name: string;
    offersDelivery: boolean;
    offersPickup: boolean;
  };
}

interface ListingCardProps {
  listing: ListingCardData;
  showAddToCart?: boolean;
}

export function ListingCard({ listing, showAddToCart = true }: ListingCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const handleSellerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = `/buy/sellers/${listing.sellerId}`;
  };

  return (
    <>
      <AddToCartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        listing={listing}
      />
      <Link href={`/buy/listings/${listing.listingId}`}>
        <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
          {/* Seller header - clickable to seller profile */}
        <div
          onClick={handleSellerClick}
          className="px-3 py-2 bg-roots-primary/5 border-b flex items-center gap-2 hover:bg-roots-primary/10 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-roots-primary/20 flex items-center justify-center text-xs font-medium text-roots-primary">
            {listing.seller.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-roots-primary truncate flex-1">
            {listing.seller.name}
          </span>
          <svg className="w-4 h-4 text-roots-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Product image */}
        <div className="aspect-[4/3] relative bg-gray-100">
          {resolveImageUrl(listing.metadata.imageUrl) ? (
            <img
              src={resolveImageUrl(listing.metadata.imageUrl)!}
              alt={listing.metadata.produceName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              {getCategoryEmoji(listing.metadata.category)}
            </div>
          )}
          {listing.quantityAvailable < 5 && listing.quantityAvailable > 0 && (
            <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
              Only {listing.quantityAvailable} left
            </div>
          )}
        </div>

        {/* Product details - 1 item per line */}
        <CardContent className="p-4 space-y-2">
          {/* Product name */}
          <h3 className="font-semibold text-lg leading-tight">{listing.metadata.produceName}</h3>

          {/* Price */}
          <div className="flex items-baseline gap-1">
            <PriceDisplay amount={BigInt(listing.pricePerUnit)} size="sm" />
            <span className="text-sm text-roots-gray">/ {listing.metadata.unit}</span>
          </div>

          {/* Availability */}
          <div className="text-sm text-roots-gray">
            {listing.quantityAvailable} {listing.metadata.unit}s available
          </div>

          {/* Fulfillment options */}
          <div className="flex flex-col gap-1 text-xs text-roots-gray pt-1 border-t">
            {listing.seller.offersPickup && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pickup available
              </span>
            )}
            {listing.seller.offersDelivery && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Delivery available
              </span>
            )}
          </div>

          {showAddToCart && (
            <Button
              className="w-full mt-2 bg-roots-primary hover:bg-roots-primary/90"
              size="sm"
              onClick={handleAddToCart}
              disabled={listing.quantityAvailable === 0}
            >
              {listing.quantityAvailable === 0 ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          )}
        </CardContent>
        </Card>
      </Link>
    </>
  );
}

function getCategoryEmoji(category?: string): string {
  const emojiMap: Record<string, string> = {
    vegetables: '🥬',
    fruits: '🍎',
    herbs: '🌿',
    eggs: '🥚',
    honey: '🍯',
    flowers: '💐',
    preserves: '🫙',
    baked: '🍞',
    dairy: '🧀',
    meat: '🥩',
  };
  return emojiMap[category || ''] || '🌱';
}

export function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-square bg-gray-200 animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
      </CardContent>
    </Card>
  );
}
