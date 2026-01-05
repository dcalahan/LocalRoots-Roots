'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-primary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            The LocalRoots Vision
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            Building resilient communities through local food networks
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* The Problem */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Problem</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Our food system is fragile.
            </p>
            <p className="mb-4">
              Long supply chains. Just-in-time logistics. Concentrated production thousands of miles
              from where people eat. It's optimized for efficiency, not resilience.
            </p>
            <p className="mb-4">
              We saw glimpses of this fragility in 2020. Empty grocery shelves. Farmers dumping milk
              while families couldn't find any. A system that works perfectly — until it doesn't.
            </p>
            <p>
              Economists at ITR Economics have been warning for years that a significant economic
              disruption is coming in the 2030s (
              <a
                href="https://itreconomics.com/2030s-great-depression/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-roots-primary hover:underline"
              >
                learn more
              </a>
              ). Whether their timeline is exact or not, the underlying
              vulnerability is real. Communities that depend entirely on distant supply chains are exposed.
            </p>
          </div>
        </section>

        {/* The Opportunity */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Opportunity</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Here's what most people don't realize: there's enormous untapped food production
              capacity in every neighborhood.
            </p>
            <p className="mb-4">
              Millions of backyards grow nothing but grass. Millions of gardens produce surplus
              that gets composted or given away. The knowledge of how to grow food is fading
              with each generation.
            </p>
            <p className="mb-4 font-semibold text-gray-900">
              What if we could change that?
            </p>
            <p>
              What if every third house on your street grew something? What if your neighbor's
              tomato surplus became your Tuesday dinner? What if communities had local food
              networks that would keep functioning no matter what happened to global supply chains?
            </p>
          </div>
        </section>

        {/* What We're Building */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What We're Building</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              LocalRoots is a marketplace that connects backyard gardeners with neighbors who
              want fresh, local food.
            </p>
            <p className="mb-4">
              But the marketplace is just the mechanism. The mission is bigger.
            </p>
            <Card className="my-6 bg-roots-primary/5 border-roots-primary">
              <CardContent className="pt-6">
                <p className="text-xl font-bold text-roots-primary text-center">
                  We want more people growing food.
                </p>
              </CardContent>
            </Card>
            <p>
              Every new gardener makes their community more resilient. Every backyard that starts
              producing food is one less family entirely dependent on fragile systems. Every
              neighbor-to-neighbor transaction strengthens the social fabric that communities
              need to weather hard times.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">How It Works</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Sellers list what they're growing. Buyers browse what's available nearby.
              Transactions happen directly between neighbors.
            </p>
            <p className="mb-4">
              No middlemen taking massive cuts. No produce traveling thousands of miles.
              No anonymous corporate transactions.
            </p>
            <p className="font-semibold text-gray-900">
              Just neighbors helping neighbors.
            </p>
          </div>
        </section>

        {/* The Vision for 2030 */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Vision for 2030</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4 font-semibold text-gray-900">Imagine your neighborhood:</p>
            <p className="mb-4">
              The family three doors down has a backyard garden that produces more tomatoes,
              peppers, and squash than they can eat. They sell the extras through LocalRoots.
            </p>
            <p className="mb-4">
              The retired couple on the corner started beekeeping. Their honey sells out every
              time they list it.
            </p>
            <p className="mb-4">
              The young family across the street converted half their lawn to raised beds.
              Their kids help harvest and are learning where food actually comes from.
            </p>
            <p className="mb-4">
              When you want fresh produce, you check LocalRoots before driving to the store.
              Half the time, there's something available within walking distance.
            </p>
            <p className="mb-4">
              You know your neighbors better. There's a community garden nearby that sells
              through the platform. The local garden club has tripled in size.
            </p>
            <p className="mb-4">
              And when economic turbulence hits — because it will — your neighborhood has options.
              You're not entirely dependent on trucks from a thousand miles away. You have
              relationships with people who grow food. You might even grow some yourself.
            </p>
            <p className="font-semibold text-roots-primary">
              That's resilience. That's what we're building.
            </p>
          </div>
        </section>

        {/* Why Now */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Why Now</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4 font-semibold text-gray-900">
              The best time to build resilience is before you need it.
            </p>
            <p className="mb-4">
              Gardens take months to produce. Skills take seasons to develop. Trust networks
              take years to build.
            </p>
            <p>
              We're starting now so that when communities need local food infrastructure, it
              already exists. Not as a replacement for grocery stores, but as a complement.
              A backup. A strengthening of the local fabric.
            </p>
          </div>
        </section>

        {/* Join Us */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 border-roots-primary">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-6 text-center">Join Us</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl mb-2">🌱</div>
                  <p className="font-semibold mb-1">If you grow food</p>
                  <p className="text-sm text-roots-gray">
                    Sell on LocalRoots. Even small amounts matter.
                  </p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl mb-2">🏡</div>
                  <p className="font-semibold mb-1">If you don't grow yet</p>
                  <p className="text-sm text-roots-gray">
                    Start. Your backyard could be producing food within months.
                  </p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg">
                  <div className="text-3xl mb-2">🌟</div>
                  <p className="font-semibold mb-1">If you believe in this mission</p>
                  <p className="text-sm text-roots-gray">
                    Become an ambassador. Build the local food network in your community.
                  </p>
                </div>
              </div>
              <p className="text-center text-lg font-semibold text-roots-primary">
                The future is uncertain. But communities that grow together, weather storms together.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-12">
          <Link href="/buy">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Browse Local Produce
            </Button>
          </Link>
          <Link href="/sell">
            <Button variant="outline">
              Start Selling
            </Button>
          </Link>
          <Link href="/ambassador">
            <Button variant="outline">
              Become an Ambassador
            </Button>
          </Link>
        </div>

        {/* Read Founder Story Link */}
        <div className="text-center border-t pt-8">
          <p className="text-roots-gray mb-4">
            Want to know the story behind LocalRoots?
          </p>
          <Link href="/about/story">
            <Button variant="link" className="text-roots-primary">
              Read the Founder's Story →
            </Button>
          </Link>
        </div>

        {/* Tagline */}
        <p className="text-center text-roots-gray mt-12 italic">
          LocalRoots — Neighbors Feeding Neighbors
        </p>
      </main>
    </div>
  );
}
