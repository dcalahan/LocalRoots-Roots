'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function FounderStoryPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-primary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Why I Started LocalRoots
          </h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">
        {/* A Warning I Couldn't Shake */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">A Warning I Couldn't Shake</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              In 2008, I attended a presentation by economist Brian Beaulieu of ITR Economics.
              He and his identical twin brother Alan had built a reputation for remarkably accurate
              economic forecasting — their firm maintains a 94.7% accuracy rate at four quarters out.
            </p>
            <p className="mb-4">
              That day, Brian wasn't talking about the next quarter or even the next year.
              He was talking about the 2030s. He laid out the case that demographic trends,
              debt levels, and economic cycles were converging toward a global depression —
              not a recession, a depression — hitting around 2030.
            </p>
            <p>
              I walked out of that room unsettled. Not panicked, but changed. The question
              lodged in my mind: <em>If he's right, what should I be doing now?</em>
            </p>
          </div>
        </section>

        {/* The Idea That Wouldn't Leave */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Idea That Wouldn't Leave</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Over the years, I kept coming back to the same thought: communities with local
              food networks would be more resilient than those entirely dependent on global
              supply chains.
            </p>
            <p className="mb-4">
              It wasn't complicated. If your neighborhood has people who know how to grow food,
              and systems for trading that food with each other, you have options. If you're
              entirely dependent on trucks from a thousand miles away stocking shelves at a
              store you don't control, you're exposed.
            </p>
            <p className="mb-4">
              The 2020 pandemic gave everyone a glimpse of what supply chain disruption looks
              like. Empty shelves. Farmers dumping produce while families went without. A system
              optimized for efficiency, completely unprepared for shock.
            </p>
            <p className="font-semibold text-gray-900">
              But I'd been thinking about this for twelve years by then. And I'd already tried
              to build it once.
            </p>
          </div>
        </section>

        {/* The First Build */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The First Build</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Harry Weller was one of my best friends. We were roommates after college. Harry
              went on to become one of the most successful venture capitalists in the country —
              nine years on the Forbes Midas List, led NEA's East Coast practice, backed companies
              like Groupon. When I told him about LocalRoots, he got it immediately. He saw what
              I saw: this wasn't about building a company, it was about building resilience.
            </p>
            <p className="mb-4">
              Harry believed in it enough that NEA funded it.
            </p>
            <p className="mb-4">
              We built the first version as a centralized app — a marketplace connecting local
              growers with buyers. We gave it a real shot.
            </p>
            <p className="mb-4">
              But we couldn't quite make it work. The timing wasn't right, the model wasn't right,
              something wasn't clicking. We made the hard decision to shut it down.
            </p>
            <p className="font-semibold text-gray-900">
              Harry passed away unexpectedly in 2016. I think about him when I work on this.
            </p>
          </div>
        </section>

        {/* What I Learned */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What I Learned</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Shutting down that first attempt taught me a lot. The core idea was right — people
              want local food, and backyard gardeners have surplus to sell. But the execution
              needed to be different.
            </p>
            <p className="mb-4">
              This time, I'm building on blockchain. Not because crypto is trendy, but because
              it creates infrastructure that no single company controls. If LocalRoots disappeared
              tomorrow, the networks we've helped create should continue. That's the point.
            </p>
            <p className="mb-4">
              And I'm taking a deliberate approach:
            </p>
            <p className="mb-4">
              <strong>Right now:</strong> The marketplace is live in preview mode on a test network.
              Explore freely — buy, sell, try everything. Nothing costs real money. Seeds earned
              during this preview phase are just for testing and won't carry over.
            </p>
            <p className="mb-4">
              <strong>At launch:</strong> When we go live on mainnet, everyone starts fresh. That's
              when Seeds count for real. Your Seeds determine your share of the $ROOTS airdrop —
              the more you contribute to the network, the bigger your share.
            </p>
            <p>
              This version is built on Base (Coinbase's L2 network). Transactions are gasless for
              sellers — they don't need to understand crypto or hold ETH. Just log in with email,
              list your produce, and sell.
            </p>
          </div>
        </section>

        {/* What We're Building */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What We're Building</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              LocalRoots is a marketplace connecting backyard gardeners with neighbors who want
              local food. But the marketplace is just the mechanism.
            </p>
            <p>
              The real goal is getting more people growing. Every new gardener strengthens their
              community. Every backyard that produces food is resilience that didn't exist before.
            </p>
          </div>
        </section>

        {/* The Timeline */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Timeline</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Brian and Alan Beaulieu's forecast points to economic trouble in the early 2030s,
              with a bottom around 2036. ITR Economics has been consistent on this thesis since
              their 2014 book "Prosperity in the Age of Decline." You can learn more about their
              forecast at{' '}
              <a
                href="https://itreconomics.com/2030s-great-depression/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-roots-primary hover:underline"
              >
                itreconomics.com
              </a>.
            </p>
            <p>
              Whether they're exactly right or not, the preparation is the same. Build local
              food networks now. Get more people growing. Strengthen communities before they need it.
            </p>
            <p className="mt-4 font-semibold text-gray-900">
              I've already built this once. Now I'm building it better. And I'm looking for
              people who want to build it with me.
            </p>
          </div>
        </section>

        {/* Join Me */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 border-roots-primary">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4 text-center">Join Me</h2>
              <div className="prose prose-lg text-roots-gray text-center">
                <p className="mb-4">
                  If you grow food, sell on LocalRoots. If you don't grow yet, start — we'll
                  help you learn. If you believe in building resilient communities, become
                  an ambassador.
                </p>
                <p className="font-semibold text-roots-primary">
                  The future is uncertain. But neighbors who grow together, weather storms together.
                </p>
                <p className="mt-6 text-gray-900 font-medium">— Doug</p>
              </div>
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

        {/* Read Vision Link */}
        <div className="text-center border-t pt-8">
          <p className="text-roots-gray mb-4">
            Learn more about what we're building
          </p>
          <Link href="/about/vision">
            <Button variant="link" className="text-roots-primary">
              Read Our Vision →
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
