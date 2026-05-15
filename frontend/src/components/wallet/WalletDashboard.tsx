'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Loader2, Send } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useWalletBalances,
  formatBalance,
  formatUsdValue,
  type TokenBalance,
} from '@/hooks/useWalletBalances';
import { useOffchainRP } from '@/hooks/useOffchainRP';
import { ReceiveTokenSection } from './ReceiveTokenSection';
import { SendTokenModal } from './SendTokenModal';
import { SwapWidget } from './SwapWidget';
import { CashOutSection } from './CashOutSection';
import { BuyUsdcSection } from './BuyUsdcSection';

interface TokenRowProps {
  token: TokenBalance;
}

function TokenRow({ token }: TokenRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{token.icon}</span>
        <div>
          <p className="font-medium">{token.symbol}</p>
          <p className="text-sm text-roots-gray">{token.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium">{formatBalance(token.formattedBalance)}</p>
        <p className="text-sm text-roots-gray">{formatUsdValue(token.usdValue)}</p>
      </div>
    </div>
  );
}

/**
 * RootsPointsRow — shows the user's combined Roots Points total alongside
 * the ERC-20 tokens in the wallet. Visually distinct from tokens with a
 * "Pre-launch" badge so users don't think RP is tradeable yet.
 *
 * Click → /about/tokenomics for the conversion-to-$ROOTS explanation.
 *
 * Currently shows off-chain RP only (KV-stored engagement points). Future:
 * sum with on-chain RP from the subgraph once that hook is exposed.
 */
function RootsPointsRow({ userId }: { userId?: string }) {
  const { total, isLoading } = useOffchainRP(userId);
  if (!userId) return null;
  return (
    <Link
      href="/about/tokenomics"
      className="flex items-center justify-between py-3 border-b last:border-b-0 hover:bg-roots-secondary/5 -mx-3 px-3 rounded transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">🌱</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">RP</p>
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-roots-secondary/15 text-roots-secondary px-1.5 py-0.5 rounded">
              Pre-launch
            </span>
          </div>
          <p className="text-sm text-roots-gray">Roots Points</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-medium">
          {isLoading ? '…' : total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs text-roots-gray">Tap for tokenomics →</p>
      </div>
    </Link>
  );
}

function BalancesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            <div className="space-y-1">
              <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="w-20 h-4 bg-gray-200 rounded animate-pulse ml-auto" />
            <div className="w-16 h-3 bg-gray-200 rounded animate-pulse ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WalletDashboard() {
  const {
    balances,
    totalUsdValue,
    isLoading,
    refetch,
    walletAddress,
    isConnected,
  } = useWalletBalances();
  const { user: privyUser } = usePrivy();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (!isConnected) {
    return null; // Parent handles not-connected state
  }

  return (
    <div className="space-y-6">
      {/* Token Balances */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Token Balances</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <BalancesSkeleton />
          ) : (
            <>
              <div className="divide-y">
                <RootsPointsRow userId={privyUser?.id} />
                {balances.map((token) => (
                  <TokenRow key={token.symbol} token={token} />
                ))}
              </div>

              {/* Total Value */}
              <div className="mt-4 pt-4 border-t flex items-center justify-between">
                <span className="font-medium text-roots-gray">Total Value</span>
                <span className="text-lg font-bold">{formatUsdValue(totalUsdValue)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Receive Section */}
      <ReceiveTokenSection walletAddress={walletAddress} />

      {/* Buy USDC — Coinbase Onramp. Sits next to Receive because both
          are "ways to get USDC into your wallet"; this is the
          fund-with-card path that Coinbase asked us to surface as a
          decoupled wallet-funding action (May 5 2026). */}
      <BuyUsdcSection />

      {/* Send Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Send</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-roots-gray text-sm mb-4">
            Send tokens to another wallet address.
          </p>
          <Button
            onClick={() => setIsSendModalOpen(true)}
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Tokens
          </Button>
        </CardContent>
      </Card>

      {/* Send Token Modal */}
      <SendTokenModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Cash Out — Coinbase Offramp for sellers */}
      <CashOutSection />

      {/* Swap Section */}
      <SwapWidget />
    </div>
  );
}

