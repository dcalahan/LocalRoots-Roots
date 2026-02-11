'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WalletDashboard } from '@/components/wallet/WalletDashboard';
import { UnifiedWalletButton } from '@/components/UnifiedWalletButton';
import { Wallet } from 'lucide-react';

export default function WalletPage() {
  const { authenticated, login, ready: privyReady } = usePrivy();
  const { isConnected: isWagmiConnected } = useAccount();

  const isConnected = authenticated || isWagmiConnected;
  const isLoading = !privyReady;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-heading font-bold mb-6">Your Wallet</h1>
          <Card>
            <CardContent className="py-12">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
                <div className="h-32 bg-gray-200 rounded" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Not connected - show connect prompt
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Wallet</h1>
            <p className="text-roots-gray">
              View balances, send tokens, and receive payments
            </p>
          </div>

          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-roots-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-roots-gray mb-6 max-w-sm mx-auto">
                Sign in with Google, Apple, or email to access your LocalRoots wallet.
                Or connect an external wallet to view its balances.
              </p>

              <div className="space-y-3">
                <Button
                  onClick={login}
                  className="bg-roots-primary hover:bg-roots-primary/90 w-full max-w-xs"
                >
                  Sign In
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-roots-gray">or</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <UnifiedWalletButton />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Section */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="py-4">
                <h4 className="font-medium mb-1">For Sellers & Ambassadors</h4>
                <p className="text-sm text-roots-gray">
                  Sign in with the same email you used to register. Your $ROOTS and earnings
                  will appear automatically.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <h4 className="font-medium mb-1">For Crypto Buyers</h4>
                <p className="text-sm text-roots-gray">
                  Connect your external wallet to view balances and manage tokens
                  on Base network.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Connected - show wallet dashboard
  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Wallet</h1>
          <p className="text-roots-gray">
            Manage your $ROOTS tokens and other assets
          </p>
        </div>

        <WalletDashboard />

        {/* Network Info */}
        <div className="mt-6 text-center text-sm text-roots-gray">
          <p>
            Connected to Base {process.env.NEXT_PUBLIC_CHAIN_ID === '8453' ? 'Mainnet' : 'Sepolia Testnet'}
          </p>
        </div>
      </div>
    </div>
  );
}
