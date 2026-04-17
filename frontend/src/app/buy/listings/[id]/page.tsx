/**
 * /buy/listings/[id] — Listing detail page
 *
 * Server component with dynamic OG meta so Facebook shows the correct
 * listing photo when shared. Interactive UI is in ListingDetailClient.
 */

import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { fetchListingData, resolveOgImageUrl } from '@/lib/listingData';
import ListingDetailClient from './ListingDetailClient';

export const dynamic = 'force-dynamic';

const getListingCached = cache(async (id: string) => {
  try {
    return await fetchListingData(BigInt(id));
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingCached(id);
  if (!listing) return {};

  const title = `${listing.metadata.produceName} — Fresh from Your Neighbor | Local Roots`;
  const description = listing.metadata.description
    || `Fresh ${listing.metadata.produceName} from ${listing.seller.name}. Buy local on Local Roots.`;
  const image = resolveOgImageUrl(listing.metadata.imageUrl) || 'https://www.localroots.love/og-image.png';

  return {
    title,
    description,
    openGraph: {
      title: listing.metadata.produceName,
      description,
      url: `https://www.localroots.love/buy/listings/${id}`,
      siteName: 'Local Roots',
      images: [{ url: image, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: listing.metadata.produceName,
      description,
      images: [image],
    },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingCached(id);

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-semibold mb-2">Listing not found</h1>
        <p className="text-roots-gray mb-4">This listing may no longer be available</p>
        <Link href="/buy">
          <Button>Browse Listings</Button>
        </Link>
      </div>
    );
  }

  return <ListingDetailClient listing={listing} />;
}
