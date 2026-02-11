'use client';

import React, { useState } from 'react';
import { RefreshCw, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useWalletBalances,
  formatBalance,
  formatUsdValue,
  type TokenBalance,
} from '@/hooks/useWalletBalances';
import { ReceiveTokenSection } from './ReceiveTokenSection';
import { SendTokenModal } from './SendTokenModal';
import { SwapWidget } from './SwapWidget';

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

      {/* Swap Section */}
      <SwapWidget />
    </div>
  );
}

