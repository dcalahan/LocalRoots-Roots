'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export interface SellerCardData {
  sellerId: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  listingCount?: number;
  distance?: number; // in km
}

interface SellerCardProps {
  seller: SellerCardData;
  compact?: boolean;
}

export function SellerCard({ seller, compact = false }: SellerCardProps) {
  if (compact) {
    return (
      <Link href={`/buy/sellers/${seller.sellerId}`}>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white border hover:shadow-md transition-shadow cursor-pointer min-w-[200px]">
          <div className="w-12 h-12 rounded-full bg-roots-secondary/10 flex items-center justify-center flex-shrink-0">
            {seller.imageUrl ? (
              <img
                src={seller.imageUrl}
                alt={seller.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xl">🌱</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-medium truncate">{seller.name}</h3>
            {seller.distance !== undefined && (
              <p className="text-sm text-roots-gray">
                {seller.distance < 1 ? '<1' : seller.distance.toFixed(1)} km away
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/buy/sellers/${seller.sellerId}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
        <div className="h-32 bg-gradient-to-br from-roots-primary/20 to-roots-secondary/20 flex items-center justify-center">
          {seller.imageUrl ? (
            <img
              src={seller.imageUrl}
              alt={seller.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-5xl">🌱</span>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg">{seller.name}</h3>
          {seller.description && (
            <p className="text-sm text-roots-gray mt-1 line-clamp-2">
              {seller.description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-roots-gray">
              {seller.offersPickup && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Pickup
                </span>
              )}
              {seller.offersDelivery && (
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                  </svg>
                  Delivery
                </span>
              )}
            </div>
            {seller.distance !== undefined && (
              <span className="text-roots-gray">
                {seller.distance < 1 ? '<1' : seller.distance.toFixed(1)} km
              </span>
            )}
          </div>

          {seller.listingCount !== undefined && seller.listingCount > 0 && (
            <p className="mt-2 text-sm text-roots-secondary font-medium">
              {seller.listingCount} {seller.listingCount === 1 ? 'item' : 'items'} available
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export function SellerCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-32 bg-gray-200 animate-pulse" />
      <CardContent className="p-4 space-y-2">
        <div className="h-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
      </CardContent>
    </Card>
  );
}
