'use client';

import { useMemo } from 'react';
import { notFound, useParams } from 'next/navigation';
import Link from 'next/link';
import { getCommunityGarden } from '@/lib/communityGardens';
import { useAllListings } from '@/hooks/useListings';
import { ListingsGrid } from '@/components/buyer/ListingsGrid';

export default function CommunityGardenPage() {
  const params = useParams<{ slug: string }>();
  const garden = params?.slug ? getCommunityGarden(params.slug) : null;

  const { listings, isLoading } = useAllListings();

  const gardenListings = useMemo(() => {
    if (!garden) return [];
    if (garden.sellerIds.length === 0) return [];
    const set = new Set(garden.sellerIds);
    return listings.filter(l => set.has(l.sellerId));
  }, [garden, listings]);

  if (!garden) {
    notFound();
  }

  const hasMembers = garden.sellerIds.length > 0;

  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-roots-secondary text-white">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
          <p className="text-sm uppercase tracking-wide text-roots-cream/80 mb-2">
            Community Garden
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{garden.name}</h1>
          <p className="text-roots-cream/90 text-lg mb-1">{garden.tagline}</p>
          <p className="text-roots-cream/70 text-sm">
            {garden.location.city}, {garden.location.state}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Description */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-gray-800 leading-relaxed">{garden.description}</p>
        </div>

        {/* Listings */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Available from this garden
            </h2>
            {gardenListings.length > 0 && (
              <span className="text-sm text-roots-gray">
                {gardenListings.length} item{gardenListings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {!hasMembers ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="text-4xl mb-3">🌻</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No sellers here yet
              </h3>
              <p className="text-roots-gray mb-5 max-w-md mx-auto">
                Do you garden at {garden.name}? Be the first to sell your extras
                to neighbors walking by.
              </p>
              <Link
                href="/sell/register"
                className="inline-block px-5 py-3 rounded-xl bg-roots-primary hover:bg-roots-primary/90 text-white font-semibold transition-colors"
              >
                Start selling from this garden
              </Link>
            </div>
          ) : (
            <ListingsGrid
              listings={gardenListings}
              isLoading={isLoading}
              emptyMessage={`Nothing is listed right now — check back tomorrow.`}
            />
          )}
        </div>

        {/* How it works */}
        <div className="bg-roots-secondary/10 border border-roots-secondary/30 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-900 mb-2">
            Buying from a community garden
          </h3>
          <ol className="text-sm text-roots-gray space-y-1 list-decimal list-inside">
            <li>Tap any item above to see details and reserve it.</li>
            <li>Pay by credit card — no app, no signup.</li>
            <li>Pick up from the gardener, or arrange delivery.</li>
          </ol>
        </div>

        <p className="text-xs text-roots-gray text-center pt-4">
          LocalRoots · Neighbors feeding neighbors
        </p>
      </div>
    </div>
  );
}
