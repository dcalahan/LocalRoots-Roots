'use client';

import { useListingsForSellers } from '@/hooks/useListingsForSellers';
import { ListingsGrid } from '@/components/buyer/ListingsGrid';

export function GardenListings({ sellerIds }: { sellerIds: string[] }) {
  const { listings, isLoading } = useListingsForSellers(sellerIds);

  return (
    <>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Available from this garden</h2>
        {listings.length > 0 && (
          <span className="text-sm text-roots-gray">
            {listings.length} item{listings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <ListingsGrid
        listings={listings}
        isLoading={isLoading}
        emptyMessage="Nothing is listed right now — check back tomorrow."
      />
    </>
  );
}
