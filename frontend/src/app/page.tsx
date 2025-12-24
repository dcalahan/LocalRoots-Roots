'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-roots-primary">Local Roots</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="/marketplace" className="text-roots-gray hover:text-roots-primary">
              Marketplace
            </Link>
            <Link href="/sell" className="text-roots-gray hover:text-roots-primary">
              Sell
            </Link>
            <Link href="/ambassador" className="text-roots-gray hover:text-roots-primary">
              Ambassadors
            </Link>
            <ConnectButton />
          </nav>
        </div>
      </header>

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
                <Link href="/marketplace" className="btn-primary">
                  Browse Produce
                </Link>
                <Link href="/sell" className="btn-secondary">
                  Start Selling
                </Link>
              </>
            ) : (
              <ConnectButton />
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
              <h4 className="font-semibold mb-2">Connect Wallet</h4>
              <p className="text-sm text-roots-gray">Connect your wallet to get started</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold mb-2">Find Sellers</h4>
              <p className="text-sm text-roots-gray">Browse growers in your area</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-roots-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold mb-2">Purchase with $ROOTS</h4>
              <p className="text-sm text-roots-gray">Pay with $ROOTS tokens</p>
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
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold text-roots-primary">100M</div>
            <div className="text-roots-gray">$ROOTS Total Supply</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-secondary">2.5%</div>
            <div className="text-roots-gray">Platform Fee (to Ambassadors)</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-roots-primary">Base</div>
            <div className="text-roots-gray">Built on Base L2</div>
          </div>
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
