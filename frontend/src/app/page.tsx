'use client';

import { useAccount } from 'wagmi';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/WalletButton';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Neighbors Feeding Neighbors
          </h1>
          <p className="text-xl text-roots-gray max-w-2xl mx-auto mb-8">
            A decentralized marketplace for buying and selling homegrown produce.
            Build community resilience by growing and sharing food locally.
          </p>
          <div className="flex justify-center gap-4">
            {isConnected ? (
              <>
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
              </>
            ) : (
              <WalletButton />
            )}
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
            <h3 className="text-xl font-semibold mb-2">Earn $ROOTS</h3>
            <p className="text-roots-gray">
              Growers earn $ROOTS tokens for every sale. Build community wealth together.
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="text-xl font-semibold mb-2">Decentralized</h3>
            <p className="text-roots-gray">
              No middlemen, no central servers. The community owns and governs Local Roots.
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
              <h4 className="font-semibold mb-2">Pay Your Way</h4>
              <p className="text-sm text-roots-gray">Credit card or $ROOTS tokens</p>
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
            <div className="text-4xl font-bold text-roots-primary">1B</div>
            <div className="text-roots-gray">$ROOTS Total Supply</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-secondary">0%</div>
            <div className="text-roots-gray">Platform Fees</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-primary">Base</div>
            <div className="text-roots-gray">Built on Base L2</div>
          </div>
        </div>

        {/* Ambassador CTA */}
        <div className="card bg-gradient-to-r from-roots-primary/5 to-roots-secondary/5 text-center">
          <div className="text-4xl mb-4">🌟</div>
          <h3 className="text-2xl font-bold mb-2">Build Community Resilience</h3>
          <p className="text-roots-gray max-w-xl mx-auto mb-4">
            Ambassadors inspire neighbors to grow food, help them share their harvest, and earn $ROOTS
            as local food production flourishes. <strong className="text-roots-primary">The more your community grows, the more you earn.</strong>
          </p>
          <Link href="/ambassador">
            <Button variant="outline" className="border-roots-primary text-roots-primary hover:bg-roots-primary hover:text-white">
              Become an Ambassador
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-roots-gray">
          <p>Local Roots - A decentralized community marketplace</p>
          <p className="text-sm mt-2">Powered by $ROOTS on Base</p>
        </div>
      </footer>
    </div>
  );
}
