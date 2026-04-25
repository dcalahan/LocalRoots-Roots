'use client';

import { useState } from 'react';
import { Banknote, ExternalLink, Info } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import {
  isCoinbaseOfframpConfigured,
  openCoinbaseOfframp,
} from '@/lib/coinbaseOfframp';

/**
 * Cash Out section — opens Coinbase Offramp in a new tab.
 *
 * The seller's USDC is converted to USD by Coinbase and ACHed to their
 * bank account. Coinbase handles KYC and the entire money-transmitter
 * leg; LocalRoots never touches fiat.
 *
 * Shows a "Coming soon" message if NEXT_PUBLIC_COINBASE_CDP_APP_ID isn't
 * set in env vars (so the UI works in dev/test before Coinbase setup is done).
 */
export function CashOutSection() {
  const { user } = usePrivy();
  const { walletAddress, balances } = useWalletBalances();
  const [isOpening, setIsOpening] = useState(false);

  const usdcBalance = balances.find(b => b.symbol === 'USDC');
  const hasUsdc = usdcBalance ? Number(usdcBalance.formattedBalance) > 0 : false;
  const usdcAmount = usdcBalance ? Number(usdcBalance.formattedBalance) : 0;

  const configured = isCoinbaseOfframpConfigured();

  const handleCashOut = () => {
    if (!walletAddress) return;
    setIsOpening(true);
    const opened = openCoinbaseOfframp({
      walletAddress,
      partnerUserId: user?.id || undefined,
      // Pre-fill the user's full USDC balance — they can edit on Coinbase
      presetCryptoAmount: usdcAmount > 0 ? usdcAmount : undefined,
      redirectUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/sell/dashboard`
          : undefined,
    });
    // Brief visual feedback even if the popup launches synchronously
    setTimeout(() => setIsOpening(false), 1500);
    if (!opened) {
      console.warn('[CashOutSection] Offramp not configured');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Banknote className="w-5 h-5 text-roots-secondary" />
          Cash Out to Bank
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-roots-gray text-sm mb-4">
          Convert your USDC earnings to dollars and deposit them in your bank account
          via Coinbase. Money lands in 1-3 business days.
        </p>

        {!configured && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Cash Out — coming with mainnet launch</p>
              <p className="text-xs mt-1">
                Bank deposit via Coinbase is being configured for launch.
                For now, you can send your USDC directly to a personal Coinbase
                account using the &ldquo;Send&rdquo; button below.
              </p>
            </div>
          </div>
        )}

        {configured && !hasUsdc && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-roots-gray">
            You don&apos;t have any USDC yet. Once you complete sales, your USDC
            will show up here and you&apos;ll be able to cash out.
          </div>
        )}

        {configured && hasUsdc && (
          <div className="mb-4 p-3 bg-roots-secondary/10 border border-roots-secondary/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-roots-gray">Available to cash out:</span>
              <span className="font-semibold text-roots-secondary">
                {usdcAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USDC
              </span>
            </div>
          </div>
        )}

        <Button
          onClick={handleCashOut}
          disabled={!configured || !walletAddress || !hasUsdc || isOpening}
          className="w-full bg-roots-secondary hover:bg-roots-secondary/90 disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {isOpening ? 'Opening Coinbase…' : 'Cash Out via Coinbase'}
        </Button>

        <p className="text-xs text-roots-gray mt-3 text-center">
          One-time KYC with Coinbase. Typical fee: ~2-3% of cash-out amount.
        </p>
      </CardContent>
    </Card>
  );
}
