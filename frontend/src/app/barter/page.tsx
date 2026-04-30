'use client';

/**
 * /barter — Coming Soon page.
 *
 * Doug, Apr 30 2026: add a Barter menu item with a Coming Soon page.
 *
 * Barter fits LocalRoots's "neighbors feeding neighbors" soul without
 * adding token, fee, or platform-fee mechanics — it's the most pure
 * version of the network. No promises about timing or specific
 * features in copy yet; this page is a placeholder that signals
 * direction without overcommitting.
 *
 * Lives under /barter (not /about/barter or /sell/barter) so it can
 * eventually be its own first-class flow alongside Shop and Sell.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BarterPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-secondary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="inline-block bg-roots-secondary/10 text-roots-secondary text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full mb-4">
            Coming Soon
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Barter with your neighbors
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            Trade your surplus harvest for what your neighbors are growing — no money, no fees, just neighbors helping neighbors.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">The idea</h2>
            <p className="text-roots-gray mb-4">
              Most gardens grow more than one family can use. Maybe you have basil overflowing while a
              neighbor down the street has tomatoes piling up. Barter is the most natural answer:
              swap.
            </p>
            <p className="text-roots-gray">
              We&apos;re working on a way to make it as easy as listing for sale — except instead of
              setting a price, you&apos;re posting what you&apos;d like in return. Match with neighbors
              nearby, agree on a fair trade, and meet up.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-8 bg-roots-secondary/5 border-roots-secondary/30">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-roots-secondary mb-3">Until then</h2>
            <p className="text-sm text-roots-gray mb-4">
              You can already do this informally on LocalRoots — list something for sale, message
              the buyer, work out a trade. The Barter feature will just make it the default path
              instead of a workaround.
            </p>
            <p className="text-sm text-roots-gray">
              Got thoughts on how it should work?{' '}
              <a
                href="mailto:feedback@localroots.love?subject=Barter feedback"
                className="text-roots-primary hover:underline font-medium"
              >
                Tell us
              </a>
              . We&apos;re building this with you.
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/buy">
              <Button variant="outline">Browse the marketplace</Button>
            </Link>
            <Link href="/grow">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Plan your garden
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
