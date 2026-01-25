'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PriceSummary } from '@/components/ui/PriceDisplay';
import { useCart } from '@/contexts/CartContext';
import { useCheckout } from '@/hooks/usePurchase';
import { useTokenApproval } from '@/hooks/useTokenApproval';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { baseSepolia } from 'wagmi/chains';
import { useChainValidation } from '@/hooks/useChainValidation';
import { formatRoots, rootsToFiat, formatFiat } from '@/lib/pricing';
import { uploadMetadata } from '@/lib/pinata';
import { PaymentTokenSelector } from '@/components/buyer/PaymentTokenSelector';
import { CreditCardCheckout } from '@/components/checkout/CreditCardCheckout';
import { BuyerWalletModal } from '@/components/BuyerWalletModal';
import { type PaymentToken, PAYMENT_TOKENS, rootsToStablecoin } from '@/lib/contracts/marketplace';
import { SeedsPreview } from '@/components/seeds/SeedsPreview';

type CheckoutMode = 'select' | 'wallet' | 'privy' | 'guest';
type CheckoutStep = 'review' | 'processing' | 'complete';

export default function CheckoutPage() {
  const router = useRouter();
  const { isConnected: wagmiConnected, chain } = useAccount();
  const { isCorrectChain, chainName, requestSwitch, isSwitching } = useChainValidation();

  // Privy authentication and wallet
  const { authenticated: privyAuthenticated, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const privyWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = privyWallet?.address;

  // User is connected if wagmi is connected OR Privy wallet is available
  const isConnected = wagmiConnected || (privyAuthenticated && privyAddress);
  const { items, getTotal, getSellerTotals, clearSellerItems, clearCart, removeItem } = useCart();
  const { checkout, isPurchasing, progress, results } = useCheckout();
  const { getBalance, checkAllowance, approve, isApproving } = useTokenApproval();

  // Checkout mode: select payment method, wallet checkout, or guest checkout
  const [mode, setMode] = useState<CheckoutMode>('select');
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Check if on correct network (use the hook for wagmi wallets)
  const isCorrectNetwork = wagmiConnected ? isCorrectChain : (chain?.id === baseSepolia.id);

  const [step, setStep] = useState<CheckoutStep>('review');
  const [balance, setBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [paymentToken, setPaymentToken] = useState<PaymentToken>('ROOTS');

  // Delivery info state
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');
  const [completedOrderTotal, setCompletedOrderTotal] = useState<bigint>(0n);

  const total = useMemo(() => getTotal(), [getTotal]);
  const sellerTotals = useMemo(() => getSellerTotals(), [getSellerTotals]);

  // Check if any items need delivery
  const hasDeliveryItems = useMemo(() => items.some(item => item.isDelivery), [items]);

  // Get the token address and required amount based on payment token selection
  const tokenAddress = PAYMENT_TOKENS[paymentToken].address;
  const requiredAmount = paymentToken === 'ROOTS' ? total : rootsToStablecoin(total);

  // Don't auto-switch - let user choose their payment method
  // They might be connected but still want to use credit card

  // Check balance and allowance (only when on correct network and in wallet/privy mode)
  useEffect(() => {
    async function check() {
      if (!isConnected || !isCorrectNetwork || (mode !== 'wallet' && mode !== 'privy')) return;
      try {
        const [bal, allow] = await Promise.all([
          getBalance(tokenAddress),
          checkAllowance(tokenAddress),
        ]);
        setBalance(bal);
        setAllowance(allow);
      } catch (err) {
        console.error('Failed to check balance/allowance:', err);
      }
    }
    check();
  }, [isConnected, isCorrectNetwork, getBalance, checkAllowance, tokenAddress, mode, paymentToken]);

  const hasEnoughBalance = balance >= requiredAmount;
  const hasEnoughAllowance = allowance >= requiredAmount;
  const hasDeliveryAddress = !hasDeliveryItems || deliveryAddress.trim().length > 0;

  // Empty cart handler
  if (items.length === 0 && step !== 'complete') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Your cart is empty</h1>
        <Link href="/buy">
          <Button className="bg-roots-primary">Browse Listings</Button>
        </Link>
      </div>
    );
  }

  // Guest/Credit Card checkout mode
  if (mode === 'guest') {
    return (
      <CreditCardCheckout
        items={items}
        total={total}
        onBack={() => setMode('select')}
        onComplete={(orderIds) => {
          clearCart();
          setStep('complete');
        }}
      />
    );
  }

  // Payment method selection (default mode)
  if (mode === 'select') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-heading font-bold mb-6">Checkout</h1>

        {/* Order Summary */}
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
                <span>{formatFiat(rootsToFiat(total))}</span>
              </div>
            </div>

            {/* Seeds Preview */}
            <SeedsPreview
              usdAmount={rootsToFiat(total)}
              isSeller={false}
              showBreakdown={true}
              className="mt-4"
            />
          </CardContent>
        </Card>

        {/* Payment Method Selection */}
        <h2 className="text-lg font-semibold mb-4">How would you like to pay?</h2>

        <div className="space-y-3 mb-6">
          {/* Credit Card Option */}
          <button
            onClick={() => setMode('guest')}
            className="w-full p-4 rounded-lg border-2 border-roots-primary bg-roots-primary/5 hover:bg-roots-primary/10 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-roots-primary rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold">Credit Card</div>
                <div className="text-sm text-roots-gray">
                  Visa, Mastercard, Apple Pay
                </div>
              </div>
              <span className="text-xs bg-roots-primary/10 text-roots-primary px-2 py-1 rounded font-medium">
                Recommended
              </span>
            </div>
          </button>

          {/* Privy Wallet Option - Show for authenticated Privy users */}
          {privyAuthenticated && privyAddress && (
            <button
              onClick={() => setMode('privy')}
              className="w-full p-4 rounded-lg border-2 border-purple-400 bg-purple-50 hover:bg-purple-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Your Account Wallet</div>
                  <div className="text-sm text-roots-gray">
                    {privyAddress.slice(0, 6)}...{privyAddress.slice(-4)} • Pay with USDC, USDT, or $ROOTS
                  </div>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                  Connected
                </span>
              </div>
            </button>
          )}

          {/* External Crypto Wallet Option */}
          {wagmiConnected ? (
            // Already connected - show pay button with switch option
            <div className="space-y-2">
              <button
                onClick={() => setMode('wallet')}
                className="w-full p-4 rounded-lg border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Connected Wallet</div>
                    <div className="text-sm text-roots-gray">
                      Pay with USDC, USDT, or $ROOTS tokens
                    </div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                    Connected
                  </span>
                </div>
              </button>
              <button
                onClick={() => setShowWalletModal(true)}
                className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Switch Wallet</div>
                    <div className="text-sm text-roots-gray">
                      Connect a different wallet instead
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            // Not connected - show connect button
            <button
              onClick={() => setShowWalletModal(true)}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{privyAuthenticated ? 'Different Wallet' : 'Crypto Wallet'}</div>
                  <div className="text-sm text-roots-gray">
                    {privyAuthenticated ? 'Connect browser or mobile wallet' : 'Pay with USDC, USDT, or $ROOTS tokens'}
                  </div>
                </div>
              </div>
            </button>
          )}
        </div>

        <Link href="/buy/cart" className="block">
          <Button variant="outline" className="w-full">
            Back to Cart
          </Button>
        </Link>

        {/* Wallet connection modal */}
        <BuyerWalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnect={() => setMode('wallet')}
          switchWallet={wagmiConnected}
        />
      </div>
    );
  }

  // Wallet/Privy checkout mode - check network
  if ((mode === 'wallet' || mode === 'privy') && !isCorrectNetwork && wagmiConnected) {
    const handleSwitchNetwork = async () => {
      const switched = await requestSwitch();
      if (switched) {
        // Network switched successfully, stay on this page
        console.log('[Checkout] Network switched successfully');
      }
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Wrong Network</h1>
        <p className="text-roots-gray mb-2">
          Your wallet is connected to <strong>{chain?.name || 'an unsupported network'}</strong>.
        </p>
        <p className="text-roots-gray mb-6">
          LocalRoots runs on <strong>{chainName}</strong>. Switch networks to continue.
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button
            onClick={handleSwitchNetwork}
            className="bg-roots-primary"
            disabled={isSwitching}
          >
            {isSwitching ? 'Switching...' : `Switch to ${chainName}`}
          </Button>
          <Button variant="outline" onClick={() => setMode('select')}>
            Use Different Payment Method
          </Button>
        </div>
        <p className="text-xs text-roots-gray mt-6">
          If switching doesn't work, open your wallet app and manually switch to {chainName}.
        </p>
      </div>
    );
  }

  // Wallet checkout - not connected (doesn't apply to privy mode since they're already authenticated)
  if (mode === 'wallet' && !wagmiConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Sign In Required</h1>
        <p className="text-roots-gray mb-6">
          Sign in to pay with your account balance
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setShowWalletModal(true)} className="bg-roots-primary">
            Sign In
          </Button>
          <Button variant="outline" onClick={() => setMode('select')}>
            Pay with Credit Card
          </Button>
        </div>
        <BuyerWalletModal
          isOpen={showWalletModal}
          onClose={() => setShowWalletModal(false)}
          onConnect={() => {}} // Stay on wallet mode, just close modal
        />
      </div>
    );
  }

  const handleCheckout = async () => {
    console.log('[Checkout] Starting checkout, mode:', mode, 'items:', items.length);
    console.log('[Checkout] Payment token:', paymentToken, 'balance:', balance.toString(), 'required:', requiredAmount.toString());
    setStep('processing');

    // First, check and handle approval if needed
    if (!hasEnoughAllowance) {
      setProcessingStatus(`Approving ${paymentToken} spending...`);
      const approved = await approve(requiredAmount, tokenAddress);
      if (!approved) {
        setProcessingStatus('Approval failed');
        setTimeout(() => setStep('review'), 2000);
        return;
      }
      setAllowance(requiredAmount);
    }

    setProcessingStatus('Processing purchases...');

    // Upload delivery info to IPFS if this is a delivery order
    let buyerInfoIpfs = '';
    if (hasDeliveryItems && deliveryAddress) {
      try {
        setProcessingStatus('Uploading delivery info...');
        const deliveryData = {
          address: deliveryAddress,
          phone: deliveryPhone || undefined,
          notes: deliveryNotes || undefined,
          uploadedAt: Date.now(),
        };
        const result = await uploadMetadata(deliveryData, 'delivery-info.json');
        buyerInfoIpfs = result.ipfsHash;
        console.log('[Checkout] Uploaded delivery info to IPFS:', buyerInfoIpfs);
      } catch (err) {
        console.error('[Checkout] Failed to upload delivery info:', err);
        setProcessingStatus('Failed to upload delivery info');
        setTimeout(() => setStep('review'), 2000);
        return;
      }
      setProcessingStatus('Processing purchases...');
    }

    const purchaseItems = items.map((item) => ({
      listingId: BigInt(item.listingId),
      quantity: BigInt(item.quantity),
      isDelivery: item.isDelivery,
      totalPrice: BigInt(item.pricePerUnit) * BigInt(item.quantity),
      buyerInfoIpfs: item.isDelivery ? buyerInfoIpfs : '',
      paymentToken,
    }));

    console.log('[Checkout] Calling checkout with', purchaseItems.length, 'items');
    const result = await checkout(purchaseItems);
    console.log('[Checkout] Checkout result:', result);

    // Store total for complete screen before clearing
    setCompletedOrderTotal(total);

    // Clear successful items from cart
    if (result.allSucceeded) {
      clearCart();
    } else if (result.successCount > 0) {
      const failedIds = new Set(result.failedListingIds.map(id => id.toString()));
      items.forEach(item => {
        if (!failedIds.has(item.listingId)) {
          removeItem(item.listingId);
        }
      });
    }

    setStep('complete');
  };

  // Complete screen
  if (step === 'complete') {
    const successCount = results.success.length;
    const failedCount = results.failed.length;

    // Debug: Log what happened
    console.log('[Checkout Complete]', { successCount, failedCount, results });
    // Calculate Seeds earned from the successful purchases (use stored total since cart is cleared)
    const totalUsdSpent = rootsToFiat(completedOrderTotal);

    // If no orders succeeded AND no orders failed, something went wrong
    if (successCount === 0 && failedCount === 0) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-heading font-bold mb-2">Something Went Wrong</h1>
          <p className="text-roots-gray mb-4">
            No orders were processed. Your cart may have been empty or there was a connection issue.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/buy/cart">
              <Button className="bg-roots-primary">Back to Cart</Button>
            </Link>
            <Link href="/buy">
              <Button variant="outline">Continue Shopping</Button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        {failedCount === 0 ? (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-heading font-bold mb-2">Order Complete!</h1>
            <p className="text-roots-gray mb-4">
              Your {successCount} {successCount === 1 ? 'order has' : 'orders have'} been placed successfully.
            </p>
            {/* Seeds earned confirmation */}
            <div className="inline-block bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-amber-900">
                <span className="text-2xl">🌱</span>
                <span className="font-semibold">Seeds Earned!</span>
              </div>
              <SeedsPreview
                usdAmount={totalUsdSpent}
                isSeller={false}
                showBreakdown={true}
                className="mt-2 border-0 bg-transparent p-0"
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-heading font-bold mb-2">Partial Success</h1>
            <p className="text-roots-gray mb-6">
              {successCount} succeeded, {failedCount} failed. Failed items remain in your cart.
            </p>
          </>
        )}
        <div className="flex gap-4 justify-center">
          <Link href="/buy/orders">
            <Button className="bg-roots-primary">View Orders</Button>
          </Link>
          <Link href="/buy">
            <Button variant="outline">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Processing screen
  if (step === 'processing') {
    const showProgress = progress.total > 0;
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4 animate-bounce">🛒</div>
        <h1 className="text-2xl font-heading font-bold mb-2">
          {processingStatus || 'Processing...'}
        </h1>
        {showProgress && (
          <>
            <p className="text-roots-gray mb-6">
              {progress.current} of {progress.total} purchases complete
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-roots-primary h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </>
        )}
        <p className="text-sm text-roots-gray">
          Please confirm each transaction in your wallet
        </p>
      </div>
    );
  }

  // Review screen (wallet mode)
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setMode('select')} className="text-roots-gray hover:text-roots-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-heading font-bold">Complete Purchase</h1>
      </div>

      {/* Order summary by seller */}
      <div className="space-y-4 mb-6">
        {Array.from(sellerTotals.entries()).map(([sellerId, { total: sellerTotal, items: sellerItems }]) => (
          <Card key={sellerId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                {sellerItems[0]?.metadata.sellerName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                {sellerItems.map((item) => (
                  <div key={item.listingId} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}× {item.metadata.produceName}
                      {item.isDelivery && <span className="ml-2 text-xs text-blue-600">(Delivery)</span>}
                    </span>
                    <div className="text-right">
                      <span>{formatFiat(rootsToFiat(BigInt(item.pricePerUnit) * BigInt(item.quantity)))}</span>
                      <div className="text-xs text-roots-gray">{formatRoots(BigInt(item.pricePerUnit) * BigInt(item.quantity))} ROOTS</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-2">
                <PriceSummary label="Subtotal" amount={sellerTotal} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delivery address form */}
      {hasDeliveryItems && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <span className="text-blue-600">🚚</span>
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="deliveryAddress">Street Address *</Label>
              <Input
                id="deliveryAddress"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="123 Main St, Apt 4B"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="deliveryPhone">Phone Number (optional)</Label>
              <Input
                id="deliveryPhone"
                type="tel"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                placeholder="(555) 123-4567"
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

      {/* Payment token selection */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <PaymentTokenSelector
            selected={paymentToken}
            onChange={setPaymentToken}
            rootsAmount={total}
            disabled={isPurchasing || isApproving}
          />
        </CardContent>
      </Card>

      {/* Total and Seeds Preview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <PriceSummary label="Total" amount={total} className="text-lg font-semibold" />

          {/* Seeds Preview */}
          <SeedsPreview
            usdAmount={rootsToFiat(total)}
            isSeller={false}
            showBreakdown={true}
            className="mt-4"
          />

          <div className="mt-4 pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-roots-gray">Your {paymentToken} Balance</span>
              <div className="text-right">
                <span className={hasEnoughBalance ? 'text-green-600' : 'text-red-600'}>
                  {paymentToken === 'ROOTS'
                    ? formatRoots(balance)
                    : `${(Number(balance) / 1e6).toFixed(2)}`
                  } {paymentToken}
                </span>
              </div>
            </div>
            {!hasEnoughBalance && (
              <p className="text-red-600 text-xs">
                Insufficient {paymentToken} balance. You need{' '}
                {paymentToken === 'ROOTS'
                  ? `${formatRoots(requiredAmount - balance)} ROOTS`
                  : `${((Number(requiredAmount) - Number(balance)) / 1e6).toFixed(2)} ${paymentToken}`
                } more.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          className="w-full bg-roots-primary hover:bg-roots-primary/90"
          size="lg"
          onClick={handleCheckout}
          disabled={!hasEnoughBalance || !hasDeliveryAddress || isPurchasing || isApproving}
        >
          {isPurchasing || isApproving ? 'Processing...' : `Complete Purchase (${items.length} items)`}
        </Button>

        {!hasDeliveryAddress && (
          <p className="text-amber-600 text-sm text-center">
            Please enter a delivery address for your delivery items.
          </p>
        )}

        <Button variant="outline" className="w-full" onClick={() => setMode('select')}>
          Change Payment Method
        </Button>
      </div>

      <p className="text-xs text-center text-roots-gray mt-4">
        {!hasEnoughAllowance && hasEnoughBalance
          ? 'You\'ll be asked to approve spending first, then confirm your purchase.'
          : 'Each purchase from a different listing requires a separate transaction.'}
      </p>
    </div>
  );
}
