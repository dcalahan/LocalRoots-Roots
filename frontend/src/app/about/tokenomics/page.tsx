'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function TokenomicsPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-gradient-to-b from-roots-secondary/10 to-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Seeds & $ROOTS
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            Earn rewards for building your local food network.
            The more you participate, the more you earn.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">

        {/* What Are Seeds */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What Are Seeds?</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Seeds are loyalty rewards you earn for participating in LocalRoots.
            </p>
            <p className="mb-4">
              Sell produce to a neighbor? You earn Seeds. Buy from a local grower? Seeds.
              Help someone sign up as a seller? More Seeds.
            </p>
            <p>
              Think of them like frequent-flyer miles for local food. The people who show up
              early and help build this network earn the most.
            </p>
          </div>
        </section>

        {/* Two Phases */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Plan: Prove It, Then Share It</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              We're doing this in two phases. The idea is simple: build something real first,
              then reward everyone who helped.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {/* Phase 1 */}
            <Card className="border-t-4 border-roots-secondary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-roots-secondary/10 rounded-full flex items-center justify-center">
                    <span className="text-xl">🌱</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Phase 1: Seeds</h3>
                    <p className="text-roots-secondary font-medium text-sm">November 2026</p>
                  </div>
                </div>
                <div className="prose text-roots-gray text-sm">
                  <p className="mb-3">
                    The marketplace launches. You buy and sell with regular currency (USDC).
                    Every transaction earns Seeds.
                  </p>
                  <p>
                    No token to worry about. No price chart. Just a community of neighbors
                    trading food and earning rewards for being part of it.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Phase 2 */}
            <Card className="border-t-4 border-roots-primary">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-roots-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-xl">🌳</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Phase 2: $ROOTS</h3>
                    <p className="text-roots-primary font-medium text-sm">When the community is ready</p>
                  </div>
                </div>
                <div className="prose text-roots-gray text-sm">
                  <p className="mb-3">
                    Once the marketplace has real traction — real sellers, real buyers, real
                    transactions — we launch the $ROOTS token.
                  </p>
                  <p>
                    Your Seeds convert to $ROOTS tokens. The more Seeds you earned,
                    the more $ROOTS you receive. Early believers get rewarded.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Why This Way */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Why Do It This Way?</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Most crypto projects launch a token first and hope something useful gets built later.
              We're doing the opposite.
            </p>
            <p className="mb-4">
              Build the marketplace. Get real people growing food and selling to neighbors.
              Prove it works. <em>Then</em> launch the token.
            </p>
            <p className="font-semibold text-gray-900">
              That way, when $ROOTS launches, it represents something real — an actual community
              of people feeding their neighbors.
            </p>
          </div>
        </section>

        {/* How You Earn Seeds */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">How You Earn Seeds</h2>
          <div className="prose prose-lg text-roots-gray mb-6">
            <p>
              There are three ways to participate. Each one earns Seeds.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sellers */}
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🧑‍🌾</div>
                <h3 className="text-lg font-bold mb-2">Sell Produce</h3>
                <div className="text-3xl font-bold text-roots-primary mb-1">500</div>
                <p className="text-sm text-roots-gray mb-4">Seeds per $1 earned</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Sell $20 of tomatoes, earn 10,000 Seeds.
                    Plus bonus Seeds for milestones like your first sale.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Buyers */}
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🛒</div>
                <h3 className="text-lg font-bold mb-2">Buy Local</h3>
                <div className="text-3xl font-bold text-roots-secondary mb-1">50</div>
                <p className="text-sm text-roots-gray mb-4">Seeds per $1 spent</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Every purchase supports a neighbor who grows food
                    and earns you Seeds toward the airdrop.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ambassadors */}
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🌟</div>
                <h3 className="text-lg font-bold mb-2">Build the Network</h3>
                <div className="text-3xl font-bold text-roots-primary mb-1">25%</div>
                <p className="text-sm text-roots-gray mb-4">of your sellers' Seeds</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Ambassadors recruit growers and earn a share
                    of every sale their sellers make for a full year.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Early Adopter Bonus */}
          <Card className="mt-6 bg-roots-primary/5 border-roots-primary/20">
            <CardContent className="pt-6">
              <h3 className="font-bold text-center mb-4">Early Adopter Bonus</h3>
              <p className="text-sm text-roots-gray text-center mb-4">
                The earlier you join, the more you earn. This is our way of saying thank you
                to the people who take a chance on something new.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-roots-primary">2x</div>
                  <div className="text-xs text-roots-gray">First 90 days</div>
                </div>
                <div className="text-xl text-roots-gray/30">→</div>
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-roots-primary/70">1.5x</div>
                  <div className="text-xs text-roots-gray">Days 91–180</div>
                </div>
                <div className="text-xl text-roots-gray/30">→</div>
                <div className="text-center px-4">
                  <div className="text-2xl font-bold text-roots-gray">1x</div>
                  <div className="text-xs text-roots-gray">After 180 days</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Token Allocation */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Where $ROOTS Tokens Go</h2>
          <div className="prose prose-lg text-roots-gray mb-6">
            <p className="mb-4">
              There will be 1 billion $ROOTS tokens. That's it — no more will ever be created.
              Here's how they're allocated:
            </p>
          </div>

          {/* Visual Bar */}
          <div className="mb-6">
            <div className="h-10 rounded-full overflow-hidden flex">
              <div className="bg-roots-secondary h-full" style={{ width: '40%' }} />
              <div className="bg-roots-primary h-full" style={{ width: '25%' }} />
              <div className="bg-roots-secondary/50 h-full" style={{ width: '15%' }} />
              <div className="bg-roots-primary/50 h-full" style={{ width: '10%' }} />
              <div className="bg-roots-gray/50 h-full" style={{ width: '10%' }} />
            </div>
          </div>

          {/* Allocation Details */}
          <div className="space-y-3">
            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-secondary rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Community Treasury</h4>
                    <span className="text-sm font-bold">40%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Governed by the community. Used for ecosystem development, grants, and growing the network.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-primary rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Ambassador Rewards</h4>
                    <span className="text-sm font-bold">25%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Paid to ambassadors who recruit sellers and build local food networks. Earned over time based on activity.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-secondary/50 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Liquidity</h4>
                    <span className="text-sm font-bold">15%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Makes $ROOTS tradeable when Phase 2 launches. This is what establishes a market price.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-primary/50 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Airdrop to Early Users</h4>
                    <span className="text-sm font-bold">10%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Distributed to Phase 1 participants based on Seeds earned. This is your reward for being here early.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-gray/50 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Founding Team</h4>
                    <span className="text-sm font-bold">10%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Locked for 6 months, then released gradually over 3 years. We only do well if the community does well.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Roadmap */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">The Roadmap</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-gray rounded-full" />
                <div className="w-0.5 flex-1 bg-roots-gray/20" />
              </div>
              <div className="pb-6">
                <div className="text-sm text-roots-gray">Now – Q3 2026</div>
                <div className="font-bold text-gray-900">Building & Testing</div>
                <p className="text-sm text-roots-gray mt-1">
                  Smart contracts, frontend, and growing tools. Getting it right before launch.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-secondary rounded-full" />
                <div className="w-0.5 flex-1 bg-roots-gray/20" />
              </div>
              <div className="pb-6">
                <div className="text-sm text-roots-secondary font-medium">November 2026</div>
                <div className="font-bold text-gray-900">Phase 1 Launch</div>
                <p className="text-sm text-roots-gray mt-1">
                  Marketplace goes live. Start buying, selling, and earning Seeds.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-gray/50 rounded-full" />
                <div className="w-0.5 flex-1 bg-roots-gray/20" />
              </div>
              <div className="pb-6">
                <div className="text-sm text-roots-gray">2027 – 2028</div>
                <div className="font-bold text-gray-900">Community Growth</div>
                <p className="text-sm text-roots-gray mt-1">
                  More neighborhoods, more growers, more transactions. Proving the model works.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-primary rounded-full" />
              </div>
              <div>
                <div className="text-sm text-roots-primary font-medium">When the community is ready</div>
                <div className="font-bold text-gray-900">Phase 2: $ROOTS Token</div>
                <p className="text-sm text-roots-gray mt-1">
                  Token launches. Seeds convert to $ROOTS. The people who helped build
                  the network get their share of it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Common Questions</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Do I need a crypto wallet to earn Seeds?</h4>
                <p className="text-sm text-roots-gray">
                  No. When you sign up with your email or phone, we create an account for you
                  behind the scenes. You don't need to know anything about crypto to participate.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Are Seeds worth money right now?</h4>
                <p className="text-sm text-roots-gray">
                  Not today. Seeds are loyalty rewards that track your contributions.
                  When $ROOTS launches in Phase 2, your Seeds will convert to real tokens.
                  The more Seeds you've earned, the more $ROOTS you'll receive.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Can I lose my Seeds?</h4>
                <p className="text-sm text-roots-gray">
                  No. Seeds are recorded on the blockchain. They're yours.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Why earn 2x Seeds now instead of waiting?</h4>
                <p className="text-sm text-roots-gray">
                  The early adopter bonus is our way of rewarding the people who take a chance on something
                  new. The first 90 days after launch earn 2x Seeds, days 91–180 earn 1.5x.
                  After that, it's 1x. If you believe in what we're building, now is the time.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">What is $ROOTS exactly?</h4>
                <p className="text-sm text-roots-gray">
                  $ROOTS is a token on the Base network (built by Coinbase). When Phase 2 launches,
                  it will be tradeable and used for ambassador commissions, community governance,
                  and marketplace rewards. But we're not launching it until the marketplace has
                  real traction — real neighbors buying and selling real food.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-12">
          <Card className="bg-gradient-to-r from-roots-primary/5 to-roots-secondary/5 border-roots-primary/20">
            <CardContent className="pt-6 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Start Earning?</h2>
              <p className="text-roots-gray max-w-lg mx-auto mb-6">
                Whether you grow food, buy local, or help build the community — there's
                a place for you. And the earlier you start, the more you earn.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/sell">
                  <Button className="bg-roots-primary hover:bg-roots-primary/90">
                    Start Selling
                  </Button>
                </Link>
                <Link href="/buy">
                  <Button variant="outline">
                    Browse Produce
                  </Button>
                </Link>
                <Link href="/ambassador">
                  <Button variant="outline" className="border-roots-secondary text-roots-secondary hover:bg-roots-secondary hover:text-white">
                    Become an Ambassador
                  </Button>
                </Link>
              </div>
              <div className="mt-4">
                <Link href="/seeds/leaderboard" className="text-sm text-roots-primary hover:underline">
                  View Seeds Leaderboard →
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Navigation */}
        <div className="text-center border-t pt-8">
          <p className="text-roots-gray mb-4">
            Learn more about what we're building
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/about/vision">
              <Button variant="link" className="text-roots-primary">
                Our Vision →
              </Button>
            </Link>
            <Link href="/about/story">
              <Button variant="link" className="text-roots-primary">
                Founder's Story →
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
