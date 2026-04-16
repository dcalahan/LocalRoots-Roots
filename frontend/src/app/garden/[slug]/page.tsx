import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCollectionAsync } from '@/lib/collections';
import { GardenListings } from './GardenListings';

export const dynamic = 'force-dynamic';

export default async function CommunityGardenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionAsync(slug);
  const garden = collection?.type === 'community-garden' ? collection : null;

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
            <GardenListings sellerIds={garden.sellerIds} />
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
