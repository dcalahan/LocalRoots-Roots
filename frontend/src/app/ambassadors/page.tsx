'use client';

/**
 * /ambassadors — public directory of LocalRoots ambassadors.
 *
 * Surfaces the people who are growing the network — gives them
 * deserved visibility AND creates a recruiting hook for visitors who
 * see what their region's ambassadors look like and think "I could
 * do that."
 *
 * Sorted by recruited-seller count (top performers first), then
 * registration date. Tier badges via the existing AMBASSADOR_TIERS
 * config. Filtered to active, non-suspended only.
 *
 * Pre-launch: few ambassadors, iterating all is fine. When this scales,
 * needs subgraph + pagination.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAllAmbassadors } from '@/hooks/useAllAmbassadors';
import { AmbassadorDirectoryCard } from '@/components/ambassador/AmbassadorDirectoryCard';

export default function AmbassadorsDirectoryPage() {
  const { data, isLoading, error } = useAllAmbassadors();

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="font-heading text-4xl font-bold text-gray-900 mb-3">
            Meet the Ambassadors
          </h1>
          <p className="text-roots-gray max-w-2xl mx-auto mb-6">
            Ambassadors are the community organizers who grow LocalRoots.
            They recruit gardeners in their neighborhoods and earn 25%
            commission on every sale those gardeners make. They&apos;re
            the reason new regions come online.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ambassador">
              <Button variant="outline" className="border-roots-secondary text-roots-secondary hover:bg-roots-secondary hover:text-white">
                Learn how it works
              </Button>
            </Link>
            <Link href="/ambassador/register">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Become an Ambassador
              </Button>
            </Link>
          </div>
        </header>

        {/* Body */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-2xl border border-gray-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-roots-gray">
              Couldn&apos;t load the ambassador list right now. Try again in a moment.
            </p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🌟</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              The first ambassadors are coming
            </h2>
            <p className="text-sm text-roots-gray max-w-md mx-auto mb-6">
              We&apos;re onboarding the first wave now. Want to be one of them?
              You&apos;ll be visible right here once you register.
            </p>
            <Link href="/ambassador/register">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Become an Ambassador
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="text-xs text-roots-gray mb-3 text-center">
              {data.length} active ambassador{data.length === 1 ? '' : 's'} —
              ranked by gardeners recruited
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.map((entry) => (
                <AmbassadorDirectoryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
