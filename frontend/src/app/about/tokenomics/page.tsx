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
            Roots Points
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto">
            Earn rewards for building your local food network. The more you
            participate, the more you earn.
          </p>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12">

        {/* Decentralized application — the structural truth before everything else */}
        <section className="mb-10">
          <Card className="bg-roots-secondary/5 border-roots-secondary/30">
            <CardContent className="pt-6">
              <h3 className="font-bold text-gray-900 mb-2">
                LocalRoots is a decentralized application, not a company.
              </h3>
              <p className="text-sm text-roots-gray">
                The marketplace runs on smart contracts. Sellers list directly,
                buyers transact directly, and the platform never custodies funds.
                Disputes are resolved by ambassadors voting on-chain — not by a
                support team. The codebase is open-source and could be run by
                anyone, anywhere. We&apos;re building infrastructure, not an
                operator. Roots Points and the future $ROOTS token follow the
                same principle: rewards go to the people doing the work, not to
                a corporate cap table.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* What Are Roots Points */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What Are Roots Points?</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              Roots Points are loyalty rewards you earn for participating in LocalRoots.
            </p>
            <p className="mb-4">
              Sell produce to a neighbor? You earn Roots Points. Buy from a local grower? Roots Points.
              Help someone sign up as a seller? More Roots Points.
            </p>
            <p>
              Think of them like frequent-flyer miles for local food. The people who show up
              early and help build this network earn the most.
            </p>
          </div>
        </section>

        {/* Status — what's live today */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">What&apos;s Live Today</h2>
          <Card className="border-t-4 border-roots-secondary">
            <CardContent className="pt-6">
              <div className="prose text-roots-gray">
                <p className="mb-3">
                  The LocalRoots marketplace is live. Real growers are listing real
                  produce. Real neighbors are buying it. Every transaction earns Roots Points
                  for the gardener, the buyer, and the ambassador who built that
                  corner of the network.
                </p>
                <p>
                  Roots Points are a record of your participation, kept on the Base
                  blockchain. They never expire and can&apos;t be taken away. Earlier
                  participants earn at higher rates — see the multipliers below.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Why Roots Points first */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Why Roots Points First?</h2>
          <div className="prose prose-lg text-roots-gray">
            <p className="mb-4">
              We&apos;re building the marketplace before anything else. Real growers, real
              produce, real payments to real neighbors. That&apos;s the foundation.
            </p>
            <p>
              Roots Points reward the people who show up early — the gardeners who list
              their first surplus, the buyers who try a new neighbor, the ambassadors
              who introduce their community. As the marketplace matures, we&apos;ll
              share more about how Roots Points evolve. For now: participate, earn,
              and we&apos;ll keep you in the loop as plans firm up.
            </p>
          </div>
        </section>

        {/* How You Earn Roots Points */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">How You Earn Roots Points</h2>
          <div className="prose prose-lg text-roots-gray mb-6">
            <p>
              There are three ways to participate. Each one earns Roots Points.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Sellers */}
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">🧑‍🌾</div>
                <h3 className="text-lg font-bold mb-2">Sell Produce</h3>
                <div className="text-3xl font-bold text-roots-primary mb-1">500</div>
                <p className="text-sm text-roots-gray mb-4">Roots Points per $1 earned</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Sell $20 of tomatoes, earn 10,000 Roots Points.
                    Plus milestones: 10,000 Roots Points for your first sale,
                    25,000 at five sales, 50,000 at fifteen.
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
                <p className="text-sm text-roots-gray mb-4">Roots Points per $1 spent</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Every purchase supports a neighbor who grows food
                    and earns you Roots Points.
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
                <p className="text-sm text-roots-gray mb-4">of each sale as Roots Points</p>
                <div className="border-t pt-3">
                  <p className="text-xs text-roots-gray">
                    Recruit a grower and earn Roots Points worth 25% of every sale they make for a full year.
                    You keep 80% — 20% goes to the ambassador who recruited you.
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

        {/* Token Allocation — kept on the page so ambassadors and serious
            participants (like Matt) can see how the network rewards are
            currently proposed to be split. PROPOSED, not final — these
            numbers may shift before token launch. */}
        <section className="mb-12">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-3xl font-bold text-gray-900">
              Proposed Allocation
            </h2>
            <span className="text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
              Subject to Change
            </span>
          </div>
          <div className="prose prose-lg text-roots-gray mb-6">
            <p className="mb-4">
              The proposed total supply is 1 billion tokens, with no future
              minting. The split below is a working draft — we&apos;re still
              gathering input from ambassadors, gardeners, and the broader
              community before locking these numbers in.
            </p>
            <div className="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 mb-2">
              <strong>Currently under review:</strong> the 40% Community Treasury
              slice. We&apos;re weighing whether some of that should shift to
              the people doing the actual work of growing the network —
              ambassadors and early users. Final numbers will be set before
              the token launches.
            </div>
          </div>

          {/* Visual Bar */}
          <div className="mb-6">
            <div className="h-10 rounded-full overflow-hidden flex">
              <div className="bg-roots-secondary h-full" style={{ width: '40%' }} />
              <div className="bg-roots-primary h-full" style={{ width: '25%' }} />
              <div className="bg-gray-800 h-full" style={{ width: '15%' }} />
              <div className="bg-roots-secondary/50 h-full" style={{ width: '10%' }} />
              <div className="bg-roots-primary/50 h-full" style={{ width: '10%' }} />
            </div>
          </div>

          {/* Allocation Details */}
          <div className="space-y-3">
            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-roots-secondary rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">Community Treasury</h4>
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        Under review
                      </span>
                    </div>
                    <span className="text-sm font-bold">40%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Governed by the community. Funds ecosystem development, grants,
                    and growing the network. We&apos;re considering reducing this
                    slice and reallocating to ambassadors and early users.
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
                    Paid to ambassadors who recruit gardeners and build local food networks. Earned over time based on activity.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-4 h-4 bg-gray-800 rounded-full flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between items-baseline">
                    <h4 className="font-semibold">Founding Team</h4>
                    <span className="text-sm font-bold">15%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Locked, then released gradually over 3 years. Vesting only
                    starts when the token launches — we only do well if the
                    community does well.
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
                    <span className="text-sm font-bold">10%</span>
                  </div>
                  <p className="text-sm text-roots-gray">
                    Makes the token tradeable when it launches. Paired with USDC on Aerodrome (Base&apos;s largest DEX).
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
                    Distributed to early participants based on Roots Points earned. This is the reward for being here early.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Where we are */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Where We Are</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-secondary rounded-full" />
                <div className="w-0.5 flex-1 bg-roots-gray/20" />
              </div>
              <div className="pb-6">
                <div className="text-sm text-roots-secondary font-medium">Today</div>
                <div className="font-bold text-gray-900">Marketplace Live</div>
                <p className="text-sm text-roots-gray mt-1">
                  Buy and sell local food with real payments. Every transaction
                  earns Roots Points. Early adopters earn 2x for the first 90 days.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-gray/50 rounded-full" />
                <div className="w-0.5 flex-1 bg-roots-gray/20" />
              </div>
              <div className="pb-6">
                <div className="text-sm text-roots-gray">Next</div>
                <div className="font-bold text-gray-900">Community Growth</div>
                <p className="text-sm text-roots-gray mt-1">
                  More neighborhoods, more growers, more transactions. Proving the
                  model works in real communities. Your Roots Points keep
                  accumulating as the network expands.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-roots-primary/50 rounded-full" />
              </div>
              <div>
                <div className="text-sm text-roots-gray">Beyond</div>
                <div className="font-bold text-gray-900">Community Ownership</div>
                <p className="text-sm text-roots-gray mt-1">
                  We&apos;re building toward a network that&apos;s genuinely
                  community-owned and -governed. More on what that looks like as
                  the marketplace matures.
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
                <h4 className="font-semibold mb-2">Do I need a crypto wallet to earn Roots Points?</h4>
                <p className="text-sm text-roots-gray">
                  No. When you sign up with your email or phone, we create an account for you
                  behind the scenes. You don't need to know anything about crypto to participate.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Are Roots Points worth money right now?</h4>
                <p className="text-sm text-roots-gray">
                  Not directly. Roots Points are a record of your participation,
                  recorded on the Base blockchain. The more you earn early, the
                  bigger your share of whatever future rewards the community decides
                  to share back. We&apos;ll communicate more as those plans firm up.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Can I lose my Roots Points?</h4>
                <p className="text-sm text-roots-gray">
                  No. Every Roots Points transaction is recorded on the Base blockchain as a permanent event.
                  They can't be altered or taken away.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Is there an early adopter bonus?</h4>
                <p className="text-sm text-roots-gray">
                  Yes! Early participants earn bonus Roots Points.
                  The first 90 days earn 2x Roots Points, days 91–180 earn 1.5x.
                  After that, it&apos;s 1x. The people who help build the network early get rewarded the most.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h4 className="font-semibold mb-2">Why focus on the marketplace first?</h4>
                <p className="text-sm text-roots-gray">
                  Most platforms in this space launch a token and hope something
                  useful gets built later. We&apos;re doing the opposite: build a
                  marketplace people actually use, with real growers and real
                  buyers. The rewards layer matters because it incentivizes the
                  right behavior — but the gardening companion and the
                  marketplace are the product, not a token.
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
                <Link href="/leaderboard" className="text-sm text-roots-primary hover:underline">
                  View Roots Points Leaderboard →
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
