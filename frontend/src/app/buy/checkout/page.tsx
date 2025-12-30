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
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { formatRoots, rootsToFiat, formatFiat } from '@/lib/pricing';
import { isTestWalletAvailable } from '@/lib/testWalletConnector';
import { uploadMetadata } from '@/lib/pinata';

type CheckoutStep = 'review' | 'processing' | 'complete';

export default function CheckoutPage() {
  const router = useRouter();
  const { address, isConnected, chain } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { items, getTotal, getSellerTotals, clearSellerItems, clearCart, removeItem } = useCart();
  const { checkout, isPurchasing, progress, results } = useCheckout();
  const { getBalance, checkAllowance, approve, isApproving } = useTokenApproval();

  // Find test wallet connector
  const testWalletConnector = connectors.find((c) => c.id === 'testWallet');
  const canUseTestWallet = isTestWalletAvailable() && testWalletConnector;

  const handleUseTestWallet = () => {
    if (testWalletConnector) {
      disconnect();
      setTimeout(() => {
        connect({ connector: testWalletConnector });
      }, 100);
    }
  };

  // Check if on correct network
  const isCorrectNetwork = chain?.id === baseSepolia.id;

  const [step, setStep] = useState<CheckoutStep>('review');
  const [balance, setBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);

  // Delivery info state
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const total = useMemo(() => getTotal(), [getTotal]);
  const sellerTotals = useMemo(() => getSellerTotals(), [getSellerTotals]);

  // Check if any items need delivery
  const hasDeliveryItems = useMemo(() => items.some(item => item.isDelivery), [items]);

  // Check balance and allowance (only when on correct network)
  useEffect(() => {
    async function check() {
      if (!isConnected || !isCorrectNetwork) return;
      try {
        const [bal, allow] = await Promise.all([getBalance(), checkAllowance()]);
        setBalance(bal);
        setAllowance(allow);
      } catch (err) {
        console.error('Failed to check balance/allowance:', err);
      }
    }
    check();
  }, [isConnected, isCorrectNetwork, getBalance, checkAllowance]);

  const hasEnoughBalance = balance >= total;
  const hasEnoughAllowance = allowance >= total;
  const hasDeliveryAddress = !hasDeliveryItems || deliveryAddress.trim().length > 0;

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Connect Your Wallet</h1>
        <p className="text-roots-gray mb-6">
          Connect your wallet to complete your purchase
        </p>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Wrong Network</h1>
        <p className="text-roots-gray mb-4">
          You're connected to <strong>{chain?.name || 'Unknown Network'}</strong>.
        </p>
        <p className="text-roots-gray mb-6">
          Local Roots uses Base Sepolia testnet for purchases.
        </p>
        {canUseTestWallet ? (
          <Button
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleUseTestWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Use Test Wallet (Base Sepolia)'}
          </Button>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 p-4 rounded-lg">
            Configure NEXT_PUBLIC_TEST_WALLET_PRIVATE_KEY in .env.local to use the test wallet.
          </p>
        )}
      </div>
    );
  }

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

  const [processingStatus, setProcessingStatus] = useState('');

  const handleCheckout = async () => {
    setStep('processing');

    // First, check and handle approval if needed
    if (!hasEnoughAllowance) {
      setProcessingStatus('Approving ROOTS spending...');
      const approved = await approve(total);
      if (!approved) {
        setProcessingStatus('Approval failed');
        // Go back to review step on failure
        setTimeout(() => setStep('review'), 2000);
        return;
      }
      setAllowance(total);
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

    const purchaseItems = items.map((item) => {
      console.log('[Checkout] Processing cart item:', {
        listingId: item.listingId,
        produceName: item.metadata.produceName,
        quantity: item.quantity,
        isDelivery: item.isDelivery,
        buyerInfoIpfs: item.isDelivery ? buyerInfoIpfs : '',
      });
      return {
        listingId: BigInt(item.listingId),
        quantity: BigInt(item.quantity),
        isDelivery: item.isDelivery,
        totalPrice: BigInt(item.pricePerUnit) * BigInt(item.quantity),
        // Include IPFS hash for delivery orders, empty string for pickup
        buyerInfoIpfs: item.isDelivery ? buyerInfoIpfs : '',
      };
    });

    const result = await checkout(purchaseItems);

    // Clear successful items from cart
    if (result.allSucceeded) {
      // All succeeded - clear entire cart
      clearCart();
    } else if (result.successCount > 0) {
      // Partial success - remove successful items, keep failed ones
      // We need to remove items that are NOT in the failed list
      const failedIds = new Set(result.failedListingIds.map(id => id.toString()));
      items.forEach(item => {
        if (!failedIds.has(item.listingId)) {
          removeItem(item.listingId);
        }
      });
    }
    // If all failed, keep everything in cart

    setStep('complete');
  };

  // Complete screen
  if (step === 'complete') {
    const successCount = results.success.length;
    const failedCount = results.failed.length;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        {failedCount === 0 ? (
          <>
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-heading font-bold mb-2">Order Complete!</h1>
            <p className="text-roots-gray mb-6">
              Your {successCount} {successCount === 1 ? 'order has' : 'orders have'} been placed successfully.
            </p>
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

  // Processing screen (handles both approval and purchase)
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

  // Review screen (default)
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold mb-6">Checkout</h1>

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
              <p className="text-xs text-roots-gray mt-1">For delivery coordination</p>
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

      {/* Total and balance check */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <PriceSummary label="Total" amount={total} className="text-lg font-semibold" />

          <div className="mt-4 pt-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-roots-gray">Your Balance</span>
              <div className="text-right">
                <span className={hasEnoughBalance ? 'text-green-600' : 'text-red-600'}>
                  {formatFiat(rootsToFiat(balance))}
                </span>
                <div className="text-xs text-roots-gray">{formatRoots(balance)} ROOTS</div>
              </div>
            </div>
            {!hasEnoughBalance && (
              <p className="text-red-600 text-xs">
                Insufficient balance. You need {formatFiat(rootsToFiat(total - balance))} ({formatRoots(total - balance)} ROOTS) more.
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

        <Link href="/buy/cart" className="block">
          <Button variant="outline" className="w-full">
            Back to Cart
          </Button>
        </Link>
      </div>

      <p className="text-xs text-center text-roots-gray mt-4">
        {!hasEnoughAllowance && hasEnoughBalance
          ? 'You\'ll be asked to approve ROOTS spending first, then confirm your purchase.'
          : 'Each purchase from a different listing requires a separate transaction.'}
      </p>
    </div>
  );
}
