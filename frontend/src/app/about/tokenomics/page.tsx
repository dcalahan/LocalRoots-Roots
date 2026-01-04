'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function TokenomicsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-roots-primary to-roots-secondary text-white py-16">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Two-Phase Launch Strategy
          </h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Prove the marketplace first. Launch the token second.
            A battle-tested approach inspired by Uniswap, Blur, and OpenSea.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-12">

        {/* Phase Overview */}
        <section className="mb-16">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Phase 1 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-amber-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🌱</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Phase 1: Seeds</h2>
                  <p className="text-amber-600 font-medium">November 2026</p>
                </div>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#10003;</span>
                  <span>USDC-only marketplace (no token speculation)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#10003;</span>
                  <span>Earn Seeds for every transaction</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#10003;</span>
                  <span><Link href="/seeds/leaderboard" className="underline hover:text-amber-700">Public leaderboard</Link> tracks top contributors</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#10003;</span>
                  <span>2x Seeds multiplier for early adopters</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 mt-1">&#10003;</span>
                  <span>Build real transaction history</span>
                </li>
              </ul>
            </div>

            {/* Phase 2 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-t-4 border-roots-primary">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🌳</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Phase 2: $ROOTS</h2>
                  <p className="text-roots-primary font-medium">Q4 2028</p>
                </div>
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary mt-1">&#10003;</span>
                  <span>$ROOTS token launch on Base L2</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary mt-1">&#10003;</span>
                  <span>Seeds convert to $ROOTS via airdrop</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary mt-1">&#10003;</span>
                  <span>Ambassador commissions paid in $ROOTS</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary mt-1">&#10003;</span>
                  <span>DEX liquidity pool established</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary mt-1">&#10003;</span>
                  <span>Community governance activated</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Why Two Phases */}
        <section className="mb-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Why This Approach?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-4xl mb-3">🛡️</div>
              <h3 className="font-semibold mb-2">Prove Real Utility</h3>
              <p className="text-gray-600 text-sm">
                Transaction volume in USDC demonstrates actual demand before adding token complexity.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🐻</div>
              <h3 className="font-semibold mb-2">Avoid Bear Markets</h3>
              <p className="text-gray-600 text-sm">
                No token price chart to demoralize during market downturns. Focus on building.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="font-semibold mb-2">Reward Believers</h3>
              <p className="text-gray-600 text-sm">
                Early users who take a chance on an unproven platform get the biggest rewards.
              </p>
            </div>
          </div>
        </section>

        {/* Seeds Earning */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Earning Seeds (Phase 1)</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Sellers */}
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
              <div className="text-5xl mb-4">🧑‍🌾</div>
              <h3 className="text-xl font-bold mb-2">Sellers</h3>
              <div className="text-4xl font-bold text-roots-primary mb-2">500</div>
              <p className="text-gray-600">Seeds per $1 earned</p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">+ Milestone bonuses</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>50 Seeds - First listing</li>
                  <li>10,000 Seeds - First sale</li>
                  <li>25,000 Seeds - 5 sales</li>
                  <li>50,000 Seeds - 15 sales</li>
                </ul>
              </div>
            </div>

            {/* Buyers */}
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
              <div className="text-5xl mb-4">🛒</div>
              <h3 className="text-xl font-bold mb-2">Buyers</h3>
              <div className="text-4xl font-bold text-roots-secondary mb-2">50</div>
              <p className="text-gray-600">Seeds per $1 spent</p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Support local growers</p>
                <p className="text-xs text-gray-500 mt-2">
                  Every purchase helps build the local food economy and earns you Seeds for the airdrop.
                </p>
              </div>
            </div>

            {/* Ambassadors */}
            <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
              <div className="text-5xl mb-4">🌟</div>
              <h3 className="text-xl font-bold mb-2">Ambassadors</h3>
              <div className="text-4xl font-bold text-amber-500 mb-2">25%</div>
              <p className="text-gray-600">of recruited seller sales</p>
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">+ Recruitment bonus</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>2,500 Seeds per activated seller</li>
                  <li>80/20 split up the chain</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Early Adopter Bonus */}
          <div className="mt-8 bg-gradient-to-r from-amber-50 to-green-50 rounded-2xl p-6 border border-amber-200">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="text-center px-6">
                <div className="text-2xl font-bold text-amber-600">2.0x</div>
                <div className="text-sm text-gray-600">First 90 days</div>
              </div>
              <div className="text-2xl text-gray-300">→</div>
              <div className="text-center px-6">
                <div className="text-2xl font-bold text-amber-500">1.5x</div>
                <div className="text-sm text-gray-600">Days 91-180</div>
              </div>
              <div className="text-2xl text-gray-300">→</div>
              <div className="text-center px-6">
                <div className="text-2xl font-bold text-gray-500">1.0x</div>
                <div className="text-sm text-gray-600">After 180 days</div>
              </div>
            </div>
            <p className="text-center text-sm text-gray-600 mt-4">
              Early adopters earn bonus Seeds. The earlier you join, the more you earn.
            </p>
          </div>
        </section>

        {/* Token Allocation */}
        <section className="mb-16 bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-8 text-center">$ROOTS Token Allocation</h2>
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-roots-primary">1,000,000,000</div>
            <div className="text-gray-600">Total Supply (Fixed)</div>
          </div>

          {/* Visual Allocation Bar */}
          <div className="mb-8">
            <div className="h-12 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full" style={{ width: '40%' }} title="Treasury 40%"></div>
              <div className="bg-purple-500 h-full" style={{ width: '25%' }} title="Ambassador 25%"></div>
              <div className="bg-cyan-500 h-full" style={{ width: '15%' }} title="Liquidity 15%"></div>
              <div className="bg-amber-500 h-full" style={{ width: '10%' }} title="Airdrop 10%"></div>
              <div className="bg-green-500 h-full" style={{ width: '10%' }} title="Founders 10%"></div>
            </div>
          </div>

          {/* Allocation Details */}
          <div className="grid md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="w-4 h-4 bg-blue-500 rounded-full mx-auto mb-2"></div>
              <div className="font-bold">40%</div>
              <div className="text-sm text-gray-600">Treasury</div>
              <div className="text-xs text-gray-400">400M ROOTS</div>
            </div>
            <div>
              <div className="w-4 h-4 bg-purple-500 rounded-full mx-auto mb-2"></div>
              <div className="font-bold">25%</div>
              <div className="text-sm text-gray-600">Ambassador</div>
              <div className="text-xs text-gray-400">250M ROOTS</div>
            </div>
            <div>
              <div className="w-4 h-4 bg-cyan-500 rounded-full mx-auto mb-2"></div>
              <div className="font-bold">15%</div>
              <div className="text-sm text-gray-600">Liquidity</div>
              <div className="text-xs text-gray-400">150M ROOTS</div>
            </div>
            <div>
              <div className="w-4 h-4 bg-amber-500 rounded-full mx-auto mb-2"></div>
              <div className="font-bold">10%</div>
              <div className="text-sm text-gray-600">Airdrop</div>
              <div className="text-xs text-gray-400">100M ROOTS</div>
            </div>
            <div>
              <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2"></div>
              <div className="font-bold">10%</div>
              <div className="text-sm text-gray-600">Founders</div>
              <div className="text-xs text-gray-400">100M ROOTS</div>
            </div>
          </div>

          {/* Allocation Descriptions */}
          <div className="mt-8 grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Treasury (40%)</h4>
              <p className="text-gray-600">Community-governed fund for ecosystem development, grants, partnerships, and future initiatives.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Ambassador Rewards (25%)</h4>
              <p className="text-gray-600">Paid out as commissions to ambassadors who recruit sellers and build the network. Distributed over time based on activity.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Liquidity Pool (15%)</h4>
              <p className="text-gray-600">Seeds the Aerodrome DEX pool on Base at Phase 2 launch, establishing market price and enabling trading.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Airdrop (10%)</h4>
              <p className="text-gray-600">Distributed to Phase 1 participants based on Seeds earned. 365-day claim window after Phase 2 launch.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
              <h4 className="font-semibold mb-2">Founders (10%)</h4>
              <p className="text-gray-600">Team allocation with 6-month cliff and 3-year linear vesting starting at Phase 2 launch. Aligned with long-term success.</p>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 text-center">Roadmap</h2>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gray-200 hidden md:block"></div>

            <div className="space-y-8">
              {/* Now */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="md:w-1/2 md:text-right md:pr-8">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Now - Q3 2026</div>
                    <div className="font-bold">Development & Testing</div>
                    <p className="text-sm text-gray-600">Building Phase 1 contracts, frontend, and subgraph</p>
                  </div>
                </div>
                <div className="w-4 h-4 bg-gray-400 rounded-full z-10 hidden md:block"></div>
                <div className="md:w-1/2"></div>
              </div>

              {/* Phase 1 Launch */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="md:w-1/2"></div>
                <div className="w-4 h-4 bg-amber-500 rounded-full z-10 hidden md:block"></div>
                <div className="md:w-1/2 md:pl-8">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg shadow p-4">
                    <div className="text-sm text-amber-600 font-medium">November 2026</div>
                    <div className="font-bold">Phase 1 Launch</div>
                    <p className="text-sm text-gray-600">USDC marketplace goes live. Start earning Seeds!</p>
                  </div>
                </div>
              </div>

              {/* Growth */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="md:w-1/2 md:text-right md:pr-8">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">2027 - 2028</div>
                    <div className="font-bold">Community Growth</div>
                    <p className="text-sm text-gray-600">Build transaction history, expand to new regions</p>
                  </div>
                </div>
                <div className="w-4 h-4 bg-gray-400 rounded-full z-10 hidden md:block"></div>
                <div className="md:w-1/2"></div>
              </div>

              {/* Phase 2 */}
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="md:w-1/2"></div>
                <div className="w-4 h-4 bg-roots-primary rounded-full z-10 hidden md:block"></div>
                <div className="md:w-1/2 md:pl-8">
                  <div className="bg-green-50 border border-green-200 rounded-lg shadow p-4">
                    <div className="text-sm text-roots-primary font-medium">Q4 2028</div>
                    <div className="font-bold">Phase 2 Token Launch</div>
                    <p className="text-sm text-gray-600">$ROOTS token live. Seeds convert via airdrop.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Ready to Start Earning Seeds?</h2>
          <p className="text-gray-600 mb-6 max-w-xl mx-auto">
            Join the movement. Whether you grow food, buy local, or build community - there's a place for you.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/sell/register">
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
              <Button variant="outline" className="border-amber-500 text-amber-600 hover:bg-amber-50">
                Become an Ambassador
              </Button>
            </Link>
          </div>
          <div className="mt-4">
            <Link href="/seeds/leaderboard" className="text-sm text-roots-primary hover:underline">
              View Seeds Leaderboard
            </Link>
          </div>
        </section>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-roots-primary hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-500 text-sm">
          <p>Local Roots - Neighbors Feeding Neighbors</p>
          <p className="mt-1">Built on Base L2</p>
        </div>
      </footer>
    </div>
  );
}
