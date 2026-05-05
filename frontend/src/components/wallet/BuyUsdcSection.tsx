'use client';

/**
 * BuyUsdcSection — opens Coinbase Onramp in a new tab so the user can fund
 * their wallet with USDC via card / Apple Pay / Google Pay.
 *
 * Symmetric to CashOutSection (offramp). Sits on the /wallet page so users
 * can fund ahead of time and spend from balance at checkout, decoupling
 * the onramp from individual marketplace transactions. Coinbase asked us
 * for this architecture in the May 5 2026 approval review — they want
 * the onramp to be a wallet-funding action, not tied to a specific cart.
 *
 * Doug's product principle (May 5 2026): the checkout-integrated onramp
 * stays as a fallback for crypto-non-aware first-time buyers who don't
 * have a "fund first, spend later" mental model. Both paths route through
 * Coinbase Onramp, both flow through Coinbase's compliance + security.
 * This `/wallet` entry point is for repeat / crypto-aware buyers and the
 * approved primary path going forward.
 *
 * Reuses the existing `lib/coinbaseOnramp.ts` helpers — same JWT auth,
 * same session-token endpoint, same popup pattern. Only difference vs.
 * the checkout flow: no cart total to back-calculate, so we default to
 * $20 (well above the $5 guest-checkout floor) and let the user edit
 * inside Coinbase's hosted UI.
 */

import { useState } from 'react';
import { CreditCard, ExternalLink, Info } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useToast } from '@/hooks/use-toast';
import {
  isCoinbaseOnrampConfigured,
  openCoinbaseOnramp,
} from '@/lib/coinbaseOnramp';

/** Default USD pre-fill on the Buy USDC button. Above the $5 guest-checkout
 *  floor and gives the user a real balance to spend after. They can edit
 *  inside Coinbase's hosted UI. */
const DEFAULT_BUY_FIAT = 20;

export function BuyUsdcSection() {
  const { user } = usePrivy();
  const { walletAddress, balances } = useWalletBalances();
  const { toast } = useToast();
  const [isOpening, setIsOpening] = useState(false);

  const usdcBalance = balances.find(b => b.symbol === 'USDC');
  const usdcAmount = usdcBalance ? Number(usdcBalance.formattedBalance) : 0;

  const configured = isCoinbaseOnrampConfigured();

  const handleBuy = async () => {
    if (!walletAddress) return;
    setIsOpening(true);
    try {
      const result = await openCoinbaseOnramp({
        walletAddress,
        partnerUserId: user?.id || undefined,
        presetFiatAmount: DEFAULT_BUY_FIAT,
      });
      if (!result.ok) {
        toast({
          title: "Couldn't open Buy USDC",
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-roots-secondary" />
          Buy USDC
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-roots-gray text-sm mb-4">
          Fund your wallet with USDC using a credit card, Apple Pay, or Google Pay
          via Coinbase. Your USDC lands in this wallet on Base — ready to spend
          on LocalRoots whenever you&apos;re ready.
        </p>

        {!configured && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Buy USDC — not configured</p>
              <p className="text-xs mt-1">
                Coinbase Onramp credentials aren&apos;t set up in this environment.
                Reach out to support if you see this message in production.
              </p>
            </div>
          </div>
        )}

        {configured && (
          <div className="mb-4 p-3 bg-roots-secondary/10 border border-roots-secondary/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-roots-gray">Current USDC balance:</span>
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
          onClick={handleBuy}
          disabled={!configured || !walletAddress || isOpening}
          className="w-full bg-roots-secondary hover:bg-roots-secondary/90 disabled:opacity-50"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          {isOpening ? 'Opening Coinbase…' : `Buy USDC via Coinbase`}
        </Button>

        <p className="text-xs text-roots-gray mt-3 text-center">
          Default ${DEFAULT_BUY_FIAT}. You can change the amount inside Coinbase. $5 minimum per transaction.
        </p>
      </CardContent>
    </Card>
  );
}
