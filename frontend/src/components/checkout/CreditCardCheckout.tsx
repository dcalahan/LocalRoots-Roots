'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { type Address, formatUnits } from 'viem';
import { ACTIVE_CHAIN_ID } from '@/lib/chainConfig';
import { USDC_ADDRESS } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { isCoinbaseOnrampConfigured, openCoinbaseOnramp } from '@/lib/coinbaseOnramp';
import { usePrivyContact } from '@/hooks/usePrivyContact';
import { validateAddress, validateEmail } from '@/lib/addressValidation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rootsToFiat, formatFiat } from '@/lib/pricing';
import { CartItem } from '@/contexts/CartContext';

/**
 * CreditCardCheckout — Path B: Coinbase Onramp popup flow.
 *
 * History:
 * - Crossmint (failed; designed for NFT minting, not commerce)
 * - thirdweb Pay BuyWidget (failed; off-site Stripe Link redirect, 28%
 *   Transak markup, provider auction screen, never settled the order
 *   on-chain after payment)
 * - Coinbase Onramp via session-token URL (this) — Apr 28 2026
 *
 * Flow:
 *   1. Buyer enters email + delivery address (parity with Guest checkout —
 *      same shared validators, same Privy contact pre-fill)
 *   2. If not authenticated, Privy login (creates an embedded wallet)
 *   3. Open a Coinbase popup pre-filled with USDC on Base + the cart
 *      total in USD. Buyer pays via Apple Pay / Google Pay / card etc.
 *      Coinbase handles KYC and money transmission; LocalRoots never
 *      touches USD.
 *   4. We poll the Privy wallet for USDC balance every 3 seconds.
 *   5. Once funded, the parent page settles the marketplace order
 *      (handed off via onComplete with the buyer's wallet info).
 *
 * Reference plan: /Users/dougcalahan/LocalRoots/LocalRoots-Roots/.claude/worktrees/charming-lehmann/CLAUDE.md
 *  → "Buyer/Seller Parity" + "Zero Liability via Decentralization"
 */

interface CreditCardCheckoutProps {
  items: CartItem[];
  total: bigint;
  onBack: () => void;
  /**
   * Called once the Privy wallet has been funded with USDC and is ready
   * to settle the marketplace order. The parent (`/buy/checkout/page.tsx`)
   * handles the actual `marketplace.purchase(...)` call so this component
   * stays focused on the payment leg. The buyer wallet address is passed
   * so the parent can route the settlement to the correct connector.
   */
  onPaid: (info: { buyerAddress: Address; email: string; phone: string; deliveryAddress: string; deliveryNotes: string }) => void;
}

type Step = 'info' | 'auth' | 'pay' | 'awaiting-funds' | 'paid';

// Polling cadence — 3 seconds is fast enough that a buyer who paid quickly
// sees the success state without staring at a spinner. The 90-second
// timeout fires once the typical Coinbase settlement window has passed
// without funds arriving — at that point something is wrong (popup
// closed mid-flow, payment declined, fee mismatch) and the buyer needs
// a clearer recovery prompt instead of staring at a spinner indefinitely.
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 90 * 1_000;

export function CreditCardCheckout({ items, total, onBack, onPaid }: CreditCardCheckoutProps) {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const { email: privyEmail, phone: privyPhone } = usePrivyContact();

  // Privy embedded wallet — the buyer's destination for USDC.
  const privyWallet = wallets.find(w => w.walletClientType === 'privy') || wallets[0];
  const buyerAddress = privyWallet?.address as Address | undefined;

  // Form state (parity with GuestCheckout — same validators)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [step, setStep] = useState<Step>('info');
  const [error, setError] = useState<string | null>(null);
  const [popupRef, setPopupRef] = useState<Window | null>(null);
  const [usdcReceived, setUsdcReceived] = useState<bigint>(0n);
  const startingBalanceRef = useRef<bigint | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);

  const hasDeliveryItems = items.some(item => item.isDelivery);
  const totalUsd = Number(rootsToFiat(total));
  // Coinbase guest checkout has a $5 minimum — for orders under that we
  // ask Coinbase to deliver 5 USDC anyway and the leftover stays in the
  // account for next time. For orders >= $5 we ask for exactly the order
  // amount so polling matches with no rounding gap.
  const cryptoToBuy = Math.max(5, Math.ceil(totalUsd * 100) / 100);

  // Pre-fill from Privy when available
  useEffect(() => {
    if (privyEmail && !email) setEmail(privyEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyEmail]);
  useEffect(() => {
    if (privyPhone && !phone) setPhone(privyPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyPhone]);

  // Step transition: info → auth (if not logged in) → pay
  const handleContinue = () => {
    const emailCheck = validateEmail(email);
    if (!emailCheck.ok) {
      setError(emailCheck.error);
      return;
    }
    if (hasDeliveryItems) {
      const addressCheck = validateAddress(deliveryAddress, true);
      if (!addressCheck.ok) {
        setError(addressCheck.error);
        return;
      }
    }
    setError(null);

    if (!authenticated) {
      setStep('auth');
    } else {
      setStep('pay');
    }
  };

  // Once authenticated, advance from auth → pay automatically
  useEffect(() => {
    if (step === 'auth' && authenticated && buyerAddress) {
      setStep('pay');
    }
  }, [step, authenticated, buyerAddress]);

  // Poll Privy wallet's USDC balance once we're awaiting funds. Compares
  // against the starting balance so a buyer who already had some USDC
  // doesn't trigger a false-positive — we want to detect the *delta* from
  // the onramp, not their existing holdings.
  useEffect(() => {
    if (step !== 'awaiting-funds' || !buyerAddress) return;

    let cancelled = false;
    const client = createFreshPublicClient();

    async function readBalance(): Promise<bigint> {
      try {
        return await client.readContract({
          address: USDC_ADDRESS,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ] as const,
          functionName: 'balanceOf',
          args: [buyerAddress!],
        });
      } catch (err) {
        console.error('[CreditCardCheckout] balanceOf failed:', err);
        return startingBalanceRef.current ?? 0n;
      }
    }

    async function tick() {
      if (cancelled) return;

      const balance = await readBalance();
      const start = startingBalanceRef.current ?? 0n;
      const delta = balance > start ? balance - start : 0n;

      if (cancelled) return;

      setUsdcReceived(delta);

      // USDC has 6 decimals. Cart total is in ROOTS-equivalent (18 decimals)
      // representing $X — convert to USDC units (multiply by 1e6, divide
      // by 1e18 effectively). Use the Math-based totalUsd to avoid bigint
      // precision loss across the 10^12 ratio.
      const requiredUsdcUnits = BigInt(Math.floor(totalUsd * 1e6));

      if (delta >= requiredUsdcUnits) {
        cancelled = true;
        setStep('paid');
        if (popupRef && !popupRef.closed) popupRef.close();
        // Hand off to the parent to settle the order on-chain.
        onPaid({
          buyerAddress: buyerAddress!,
          email: email.trim(),
          phone: phone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
        });
        return;
      }

      // Timeout: 90 seconds without funds arriving. At this point either
      // the buyer closed the popup without paying, the payment was
      // declined, or something else went wrong. Stop polling and surface
      // a clear recovery prompt.
      const elapsed = Date.now() - (pollStartedAtRef.current ?? Date.now());
      if (elapsed > POLL_TIMEOUT_MS) {
        cancelled = true;
        setError("We didn't see your payment arrive. If you completed it, refresh the page to retry — your order is still in the cart.");
      }
    }

    // Snapshot starting balance before the first delta-check
    (async () => {
      const initial = await readBalance();
      if (cancelled) return;
      startingBalanceRef.current = initial;
      pollStartedAtRef.current = Date.now();
      tick(); // Immediate first read so the buyer doesn't wait 3s
    })();

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, buyerAddress, totalUsd, popupRef, onPaid, email, phone, deliveryAddress, deliveryNotes]);

  // Detect when the popup closes early (user closed it without paying).
  // We can't read the popup's URL because of cross-origin policy, but we
  // can check `closed`. If it closes while still in awaiting-funds and
  // we haven't received enough USDC, prompt the user to retry.
  useEffect(() => {
    if (!popupRef || step !== 'awaiting-funds') return;
    const interval = setInterval(() => {
      if (popupRef.closed) {
        clearInterval(interval);
        // Don't immediately error — the popup might have closed because
        // payment succeeded and Coinbase auto-closed it. Give the balance
        // poll one more cycle to detect funds.
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [popupRef, step]);

  // Open Coinbase Onramp popup — but first check whether the buyer's
  // account already has enough USDC to settle (e.g. a previous attempt
  // left funds behind). If so, skip the popup entirely and go straight
  // to settlement so the buyer doesn't pay twice.
  const startPayment = useCallback(async () => {
    if (!buyerAddress) {
      setError('Account not ready. Please try again in a moment.');
      return;
    }

    setError(null);

    const requiredUsdcUnits = BigInt(Math.floor(totalUsd * 1e6));
    try {
      const client = createFreshPublicClient();
      const existingBalance = await client.readContract({
        address: USDC_ADDRESS,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          },
        ] as const,
        functionName: 'balanceOf',
        args: [buyerAddress],
      });
      if (existingBalance >= requiredUsdcUnits) {
        setStep('paid');
        onPaid({
          buyerAddress,
          email: email.trim(),
          phone: phone.trim(),
          deliveryAddress: deliveryAddress.trim(),
          deliveryNotes: deliveryNotes.trim(),
        });
        return;
      }
    } catch (err) {
      // Balance check failed — fall through to the Coinbase popup so the
      // buyer isn't blocked. Worst case they pay and the next poll picks
      // up the funds correctly.
      console.warn('[CreditCardCheckout] pre-payment balance check failed:', err);
    }

    const result = await openCoinbaseOnramp({
      walletAddress: buyerAddress,
      presetCryptoAmount: cryptoToBuy,
      partnerUserId: user?.id || undefined,
    });

    if (!result.ok) {
      setError(result.error || 'Could not open the payment window. Please try again.');
      return;
    }

    setPopupRef(result.popup ?? null);
    setStep('awaiting-funds');
  }, [buyerAddress, cryptoToBuy, totalUsd, user?.id, onPaid, email, phone, deliveryAddress, deliveryNotes]);

  if (!isCoinbaseOnrampConfigured()) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl mb-3">🚧</div>
            <p className="text-amber-800 font-medium mb-2">Credit Card Coming Soon</p>
            <p className="text-sm text-amber-700 mb-4">
              We&apos;re finishing the credit card setup. For now, please choose a different payment option to complete your purchase.
            </p>
            <Button onClick={onBack} className="bg-roots-primary hover:bg-roots-primary/90">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: collect contact + delivery info
  if (step === 'info') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBack} className="text-roots-gray hover:text-roots-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold">Pay with Credit Card</h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Powered by Coinbase.</strong> Pay with Apple Pay, Google Pay, or any major card. Your payment opens in a secure window.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {items.map((item) => (
                <div key={item.listingId} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}× {item.metadata.produceName}
                    {item.isDelivery && <span className="ml-2 text-xs text-blue-600">(Delivery)</span>}
                  </span>
                  <span>{formatFiat(rootsToFiat(BigInt(item.pricePerUnit) * BigInt(item.quantity)))}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatFiat(totalUsd)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@example.com"
                className="mt-1"
              />
              <p className="text-xs text-roots-gray mt-1">
                {privyEmail && email === privyEmail
                  ? 'From your login — change this if you want order updates sent to a different inbox.'
                  : "We'll send order confirmation and tracking here."}
              </p>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="mt-1"
              />
              {privyPhone && phone === privyPhone && (
                <p className="text-xs text-roots-gray mt-1">
                  From your login — change this if you want delivery texts sent to a different number.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {hasDeliveryItems && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Delivery Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="deliveryAddress">Street Address *</Label>
                <Input
                  id="deliveryAddress"
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="123 Main St, City, State ZIP"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="deliveryNotes">Delivery Notes (optional)</Label>
                <Textarea
                  id="deliveryNotes"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Gate code, leave at door, etc."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          className="w-full bg-roots-primary hover:bg-roots-primary/90"
          size="lg"
          onClick={handleContinue}
        >
          Continue to Payment
        </Button>
      </div>
    );
  }

  // Step 2: Privy login if needed
  if (step === 'auth') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-heading font-bold mb-4">Quick Sign In</h1>
        <p className="text-roots-gray mb-6">
          We&apos;ll set up your account so we can send you order updates. Email or social login — takes a few seconds.
        </p>

        {!authenticated ? (
          <Button
            className="bg-roots-primary hover:bg-roots-primary/90"
            size="lg"
            onClick={() => login({ prefill: email ? { type: 'email', value: email } : undefined })}
          >
            Continue
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-roots-primary border-t-transparent rounded-full" />
            <span>Setting up your account…</span>
          </div>
        )}

        <button onClick={onBack} className="block mx-auto mt-6 text-sm text-roots-gray hover:text-roots-primary">
          Cancel
        </button>
      </div>
    );
  }

  // Step 3: ready to pay — show order summary + open-Coinbase button
  if (step === 'pay') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep('info')} className="text-roots-gray hover:text-roots-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold">Confirm & Pay</h1>
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between mb-2">
              <span className="text-roots-gray">Email</span>
              <span className="text-sm">{email}</span>
            </div>
            {hasDeliveryItems && (
              <div className="flex justify-between mb-2">
                <span className="text-roots-gray">Delivery</span>
                <span className="text-sm text-right max-w-[200px]">{deliveryAddress}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>{formatFiat(totalUsd)}</span>
              </div>
              {cryptoToBuy !== totalUsd && (
                <p className="text-xs text-roots-gray mt-1">
                  Our payment processor has a $5 minimum, so we&apos;ll add ${cryptoToBuy.toFixed(2)} to your account. The leftover stays as credit for your next order.
                </p>
              )}
              <p className="text-xs text-roots-gray mt-2">
                A small card processing fee will be added at checkout — your seller still receives the full {formatFiat(totalUsd)}.
              </p>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <Button
          className="w-full bg-roots-primary hover:bg-roots-primary/90"
          size="lg"
          onClick={startPayment}
          disabled={!buyerAddress}
        >
          {buyerAddress ? `Pay ${formatFiat(totalUsd)} with Credit Card` : 'Setting up your account…'}
        </Button>

        <p className="text-xs text-center text-roots-gray mt-4">
          A secure payment window will open. You can pay with Apple Pay, Google Pay, or any major debit/credit card.
        </p>

        <Button variant="ghost" className="w-full mt-2" onClick={() => setStep('info')}>
          Edit Order Details
        </Button>
      </div>
    );
  }

  // Step 4: waiting for the payment to settle
  if (step === 'awaiting-funds') {
    const receivedDisplay = formatUnits(usdcReceived, 6);
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4 animate-pulse">💳</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Waiting for payment</h1>
        <p className="text-roots-gray mb-6">
          Complete your purchase in the payment window. We&apos;ll confirm automatically — usually takes 5–15 seconds.
        </p>

        <div className="max-w-sm mx-auto bg-gray-50 rounded-lg p-4 mb-4">
          <div className="text-sm text-roots-gray mb-1">Payment received</div>
          <div className="text-2xl font-semibold">${Number(receivedDisplay).toFixed(2)}</div>
          <div className="text-xs text-roots-gray mt-1">
            of {formatFiat(totalUsd)} expected
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-roots-gray text-sm">
          <div className="animate-spin w-4 h-4 border-2 border-roots-primary border-t-transparent rounded-full" />
          <span>Confirming your payment…</span>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 max-w-md mx-auto">
            <p className="text-sm text-amber-800">{error}</p>
          </div>
        )}

        <button
          onClick={() => {
            if (popupRef && !popupRef.closed) popupRef.close();
            setStep('pay');
            setError(null);
          }}
          className="mt-6 text-sm text-roots-gray hover:text-roots-primary underline"
        >
          Cancel and go back
        </button>
      </div>
    );
  }

  // Step 5: paid — parent took over for settlement
  if (step === 'paid') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Payment received</h1>
        <p className="text-roots-gray">Placing your order on-chain…</p>
        <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mt-6" />
      </div>
    );
  }

  return null;
}
