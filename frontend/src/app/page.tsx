'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Your Personal Gardening Companion
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto mb-8">
            AI-powered advice for your exact climate. A tracker that grows with your garden.
            And when harvest comes — your neighbors are waiting.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6">
            <Link href="/grow">
              <Button className="bg-roots-secondary hover:bg-roots-secondary/90 text-lg px-8 py-3 h-auto">
                Start Growing
              </Button>
            </Link>
            <Link href="/buy" className="text-roots-gray hover:text-roots-primary transition-colors underline underline-offset-4">
              Browse local food →
            </Link>
          </div>
          <p className="text-roots-gray/80 text-sm flex items-center justify-center gap-1.5">
            <span>🌱</span>
            <span className="italic">Neighbors Feeding Neighbors</span>
          </p>
        </div>

        {/* What can I help you with? */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">What can I help you with?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/grow" className="card text-center hover:shadow-lg transition-shadow group">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-roots-secondary transition-colors">Ask the Garden AI</h3>
              <p className="text-roots-gray text-sm">
                What should I plant right now? How do I fix yellow leaves? Snap a photo and I&apos;ll identify it.
              </p>
            </Link>
            <Link href="/grow/calendar" className="card text-center hover:shadow-lg transition-shadow group">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-roots-secondary transition-colors">Plan Your Season</h3>
              <p className="text-roots-gray text-sm">
                Personalized planting calendar for your exact zone and frost dates.
              </p>
            </Link>
            <Link href="/grow/my-garden" className="card text-center hover:shadow-lg transition-shadow group">
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-roots-secondary transition-colors">Track Your Garden</h3>
              <p className="text-roots-gray text-sm">
                Log what you planted, watch it grow, know when to harvest.
              </p>
            </Link>
          </div>
        </div>

        {/* Mission Bridge — Garden to Community */}
        <div className="card mb-16 bg-gradient-to-r from-roots-secondary/5 to-roots-primary/5 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">When your garden grows, so does your community</h2>
          {/* Journey Steps */}
          <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 mb-6 text-lg">
            <span className="flex items-center gap-1.5"><span className="text-2xl">🌱</span> Plant</span>
            <span className="text-roots-gray/40">→</span>
            <span className="flex items-center gap-1.5"><span className="text-2xl">🌿</span> Grow</span>
            <span className="text-roots-gray/40">→</span>
            <span className="flex items-center gap-1.5"><span className="text-2xl">🍅</span> Harvest</span>
            <span className="text-roots-gray/40">→</span>
            <span className="flex items-center gap-1.5"><span className="text-2xl">🤝</span> Share</span>
          </div>
          <p className="text-roots-gray max-w-xl mx-auto mb-6">
            Growing more than you can eat? Your neighbors want it.
            List your extras on LocalRoots — no fees, no fuss. 100% goes to you.
          </p>
          <Link href="/sell">
            <Button variant="outline" className="border-roots-primary text-roots-primary hover:bg-roots-primary hover:text-white">
              Learn about selling
            </Button>
          </Link>
        </div>

        {/* What's growing near you — marketplace teaser */}
        <div className="card mb-16 text-center">
          <div className="text-4xl mb-4">🥬</div>
          <h2 className="text-2xl font-bold mb-3">What&apos;s growing near you?</h2>
          <p className="text-roots-gray max-w-md mx-auto mb-6">
            Browse fresh, homegrown food from your neighbors. No middlemen — just real food from real people.
          </p>
          <Link href="/buy">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Browse Local Produce
            </Button>
          </Link>
        </div>

        {/* Ambassador soft pitch */}
        <div className="card mb-16 text-center bg-gradient-to-r from-roots-primary/5 to-roots-secondary/5">
          <div className="text-4xl mb-4">🌟</div>
          <h3 className="text-2xl font-bold mb-3">Help your community grow</h3>
          <p className="text-roots-gray max-w-xl mx-auto mb-6">
            Know someone with a garden? Help them share their harvest with neighbors and earn rewards for every sale they make.
          </p>
          <Link href="/ambassador">
            <Button variant="outline" className="border-roots-primary text-roots-primary hover:bg-roots-primary hover:text-white">
              Become an Ambassador
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-gray-50 to-gray-100 border-t">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌱</span>
                <span className="text-xl font-bold text-gray-900">Local Roots</span>
              </div>
              <p className="text-gray-600 text-sm max-w-md">
                Your gardening companion that connects you with your neighborhood.
                Grow food, share with neighbors, build community resilience — one harvest at a time.
              </p>
            </div>

            {/* Grow & Shop */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Grow</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/grow" className="text-gray-600 hover:text-roots-secondary transition-colors">Garden AI</Link></li>
                <li><Link href="/grow/my-garden" className="text-gray-600 hover:text-roots-secondary transition-colors">My Garden</Link></li>
                <li><Link href="/grow/calendar" className="text-gray-600 hover:text-roots-secondary transition-colors">Planting Calendar</Link></li>
                <li><Link href="/grow/guides" className="text-gray-600 hover:text-roots-secondary transition-colors">Growing Guides</Link></li>
                <li><Link href="/buy" className="text-gray-600 hover:text-roots-primary transition-colors">Browse Local Food</Link></li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Community</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/sell" className="text-gray-600 hover:text-roots-primary transition-colors">Sell Your Harvest</Link></li>
                <li><Link href="/ambassador" className="text-gray-600 hover:text-roots-primary transition-colors">Become an Ambassador</Link></li>
                <li><Link href="/seeds/leaderboard" className="text-gray-600 hover:text-roots-primary transition-colors">Seeds Leaderboard</Link></li>
                <li><Link href="/about/vision" className="text-gray-600 hover:text-roots-primary transition-colors">Our Vision</Link></li>
                <li><Link href="/about/story" className="text-gray-600 hover:text-roots-primary transition-colors">Our Story</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>No platform fees</span>
                <span className="text-gray-300">•</span>
                <span>100% goes to sellers</span>
                <span className="text-gray-300">•</span>
                <span>Community-owned</span>
              </div>
              <div className="text-sm text-gray-400 italic">
                🌱 Neighbors Feeding Neighbors
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
