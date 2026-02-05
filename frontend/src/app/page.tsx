'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Phase 1 launch date (November 1, 2026)
const PHASE1_LAUNCH = new Date('2026-11-01T00:00:00Z');
const DAY_90 = new Date(PHASE1_LAUNCH.getTime() + 90 * 24 * 60 * 60 * 1000);
const DAY_180 = new Date(PHASE1_LAUNCH.getTime() + 180 * 24 * 60 * 60 * 1000);

function getMultiplierInfo(): { multiplier: string; daysRemaining: number; period: string } | null {
  const now = new Date();
  if (now < PHASE1_LAUNCH) {
    const daysUntilLaunch = Math.ceil((PHASE1_LAUNCH.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { multiplier: '2x', daysRemaining: daysUntilLaunch + 90, period: 'at launch' };
  }
  if (now < DAY_90) {
    const daysRemaining = Math.ceil((DAY_90.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { multiplier: '2x', daysRemaining, period: 'first 90 days' };
  }
  if (now < DAY_180) {
    const daysRemaining = Math.ceil((DAY_180.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return { multiplier: '1.5x', daysRemaining, period: 'days 91-180' };
  }
  return null;
}

export default function Home() {
  const multiplierInfo = getMultiplierInfo();

  return (
    <div className="min-h-screen">
      {/* Early Adopter Banner */}
      {multiplierInfo && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm md:text-base">
            <span className="text-xl">🔥</span>
            <span className="font-semibold">Early Adopter Bonus:</span>
            <span>Earn <strong>{multiplierInfo.multiplier} Seeds</strong> for the next <strong>{multiplierInfo.daysRemaining} days</strong>!</span>
            <Link href="/about/tokenomics" className="underline hover:no-underline ml-2">
              Learn more
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Neighbors Feeding Neighbors
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto mb-8">
            A community marketplace for buying and selling homegrown produce.
            Build local food resilience by growing and sharing with your neighbors.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/buy">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Browse Produce
              </Button>
            </Link>
            <Link href="/sell">
              <Button variant="outline">
                Start Selling
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="card text-center">
            <div className="text-4xl mb-4">🥬</div>
            <h3 className="text-xl font-semibold mb-2">Fresh & Local</h3>
            <p className="text-roots-gray">
              Buy produce grown right in your neighborhood. Know exactly where your food comes from.
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">🌱</div>
            <h3 className="text-xl font-semibold mb-2">Earn Rewards</h3>
            <p className="text-roots-gray">
              Earn Seeds loyalty points with every sale and purchase. Redeem for rewards when our community program launches.
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="text-xl font-semibold mb-2">Community-Owned</h3>
            <p className="text-roots-gray">
              No middlemen taking a cut. Local Roots is owned and governed by the community.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="card mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold mb-2">Set Your Location</h4>
              <p className="text-sm text-roots-gray">Find growers in your area</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2">Browse Local Produce</h4>
              <p className="text-sm text-roots-gray">Shop fresh, homegrown goods</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2">Pay Securely</h4>
              <p className="text-sm text-roots-gray">Credit card or account balance</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h4 className="font-semibold mb-2">Pickup or Delivery</h4>
              <p className="text-sm text-roots-gray">Get your fresh produce</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-8 text-center mb-16">
          <div>
            <div className="text-4xl font-bold text-roots-primary">0%</div>
            <div className="text-roots-gray">Platform Fees</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-secondary">100%</div>
            <div className="text-roots-gray">Goes to Sellers</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-primary">🔒</div>
            <div className="text-roots-gray">Secure Payments</div>
          </div>
        </div>

        {/* Ambassador CTA */}
        <div className="card mb-16 bg-gradient-to-r from-roots-primary/5 to-roots-secondary/5 text-center">
          <div className="text-4xl mb-4">🌟</div>
          <h3 className="text-2xl font-bold mb-2">Build Community Resilience</h3>
          <p className="text-roots-gray max-w-xl mx-auto mb-4">
            Ambassadors inspire neighbors to grow food, help them share their harvest, and earn Seeds
            from every sale in their network. <strong className="text-roots-primary">The more your community grows, the more you earn.</strong>
          </p>
          <Link href="/ambassador">
            <Button variant="outline" className="border-roots-primary text-roots-primary hover:bg-roots-primary hover:text-white">
              Become an Ambassador
            </Button>
          </Link>
        </div>

        {/* Growing Guides Section */}
        <div className="card bg-gradient-to-br from-roots-secondary/5 to-roots-secondary/10 border-roots-secondary/30">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">📅</div>
            <h2 className="text-3xl font-bold mb-3">Know What to Plant & When</h2>
            <p className="text-roots-gray max-w-2xl mx-auto">
              Our free Growing Guides help you plan your garden for maximum harvest.
              Personalized planting calendars based on your location, plus expert techniques for natural growing.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🗓️</div>
              <h4 className="font-semibold mb-2">Planting Calendar</h4>
              <p className="text-sm text-roots-gray">
                See exactly when to start seeds, transplant, and harvest based on your frost dates.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🌱</div>
              <h4 className="font-semibold mb-2">25+ Crop Guides</h4>
              <p className="text-sm text-roots-gray">
                Detailed growing info for popular vegetables, herbs, and fruits.
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">🌿</div>
              <h4 className="font-semibold mb-2">Natural Growing</h4>
              <p className="text-sm text-roots-gray">
                Learn organic techniques - composting, companion planting, natural pest control.
              </p>
            </div>
          </div>
          {/* Garden Assistant Highlight */}
          <div className="bg-white rounded-lg p-6 mb-8 shadow-sm border border-roots-secondary/30 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-16 h-16 rounded-full bg-roots-secondary flex items-center justify-center shadow-md">
                <span className="text-3xl">🌱</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="font-semibold text-lg mb-1">Garden Assistant</h4>
              <p className="text-sm text-roots-gray">
                Not sure what to plant? Have a pest problem? Ask our AI-powered Garden Assistant anything about growing.
                It knows your zone, frost dates, and growing season.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link href="/grow">
                <Button variant="outline" className="border-roots-secondary text-roots-secondary hover:bg-roots-secondary hover:text-white">
                  Try It Free
                </Button>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link href="/grow">
              <Button className="bg-roots-secondary hover:bg-roots-secondary/90">
                Explore Growing Guides
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-gray-50 to-gray-100 border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Footer Grid */}
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌱</span>
                <span className="text-xl font-bold text-gray-900">Local Roots</span>
              </div>
              <p className="text-gray-600 text-sm max-w-md">
                A decentralized marketplace connecting neighbors who grow food with neighbors who want to eat local. Building community resilience, one harvest at a time.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Marketplace</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/buy" className="text-gray-600 hover:text-roots-primary transition-colors">Browse Produce</Link></li>
                <li><Link href="/sell" className="text-gray-600 hover:text-roots-primary transition-colors">Start Selling</Link></li>
                <li><Link href="/ambassador" className="text-gray-600 hover:text-roots-primary transition-colors">Become an Ambassador</Link></li>
              </ul>
            </div>

            {/* Learn */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Learn</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/grow" className="text-gray-600 hover:text-roots-primary transition-colors">Growing Guides</Link></li>
                <li><Link href="/about/tokenomics" className="text-gray-600 hover:text-roots-primary transition-colors">How Seeds Work</Link></li>
                <li><Link href="/seeds/leaderboard" className="text-gray-600 hover:text-roots-primary transition-colors">Seeds Leaderboard</Link></li>
                <li><Link href="/about/vision" className="text-gray-600 hover:text-roots-primary transition-colors">Our Vision</Link></li>
                <li><Link href="/about/story" className="text-gray-600 hover:text-roots-primary transition-colors">Founder's Story</Link></li>
              </ul>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              {/* Tagline */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Secure payments</span>
                <span className="text-gray-300">•</span>
                <span>No platform fees</span>
                <span className="text-gray-300">•</span>
                <span>Community-owned</span>
              </div>

              {/* Phase Badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  🌱 Earn Seeds with every transaction
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
