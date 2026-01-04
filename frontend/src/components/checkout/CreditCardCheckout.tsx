'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ThirdwebProvider, BuyWidget } from 'thirdweb/react';
import { useThirdwebPrivy, thirdwebClient, baseSepolia } from '@/hooks/useThirdwebPrivy';
import { USDC_ADDRESS } from '@/lib/contracts/marketplace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRoots, rootsToFiat, formatFiat } from '@/lib/pricing';
import { CartItem } from '@/contexts/CartContext';

interface CreditCardCheckoutProps {
  items: CartItem[];
  total: bigint;
  onBack: () => void;
  onComplete: (orderIds: string[]) => void;
}

// Inner component that uses thirdweb hooks (must be inside ThirdwebProvider)
function CreditCardCheckoutInner({
  items,
  total,
  onBack,
  onComplete,
}: CreditCardCheckoutProps) {
  const { ready, authenticated, login, user } = usePrivy();
  const { isReady, isConnected, isBridged, error: bridgeError, bridgeWallet } = useThirdwebPrivy();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [step, setStep] = useState<'info' | 'auth' | 'payment' | 'processing' | 'complete'>('info');
  const [error, setError] = useState<string | null>(null);

  const hasDeliveryItems = items.some(item => item.isDelivery);
  const totalUsd = rootsToFiat(total);

  // Check if thirdweb is configured
  if (!thirdwebClient) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">
              Credit card payments are not configured. Please contact support.
            </p>
            <Button variant="outline" onClick={onBack} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Collect info
  const handleContinue = () => {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (hasDeliveryItems && !deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }
    setError(null);

    if (!authenticated) {
      setStep('auth');
    } else {
      setStep('payment');
    }
  };

  // Step 2: After Privy login, bridge to thirdweb
  useEffect(() => {
    if (step === 'auth' && authenticated && isConnected) {
      if (!isBridged) {
        bridgeWallet().then(success => {
          if (success) {
            setStep('payment');
          } else {
            setError('Failed to initialize payment. Please try again.');
          }
        });
      } else {
        setStep('payment');
      }
    }
  }, [step, authenticated, isConnected, isBridged, bridgeWallet]);

  // Render based on step
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
            <strong>Secure checkout powered by thirdweb.</strong> Your payment is processed securely.
          </p>
        </div>

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
                    {item.quantity}x {item.metadata.produceName}
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

        {/* Contact Info */}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1"
              />
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
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
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
                  onChange={(e) => setDeliveryAddress(e.target.value)}
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

  if (step === 'auth') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-heading font-bold mb-4">Quick Sign In Required</h1>
        <p className="text-roots-gray mb-6">
          To process your payment securely, we need to verify your email.
          This only takes a moment.
        </p>

        {!authenticated ? (
          <Button
            className="bg-roots-primary hover:bg-roots-primary/90"
            size="lg"
            onClick={login}
          >
            Continue with Email
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin w-5 h-5 border-2 border-roots-primary border-t-transparent rounded-full" />
            <span>Setting up secure payment...</span>
          </div>
        )}

        <button
          onClick={onBack}
          className="mt-4 text-sm text-roots-gray hover:text-roots-primary"
        >
          Cancel and go back
        </button>
      </div>
    );
  }

  if (step === 'payment') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep('info')} className="text-roots-gray hover:text-roots-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold">Complete Payment</h1>
        </div>

        {/* Order summary */}
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
            </div>
          </CardContent>
        </Card>

        {bridgeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{bridgeError}</p>
          </div>
        )}

        {/* thirdweb BuyWidget for funding wallet */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Enter Payment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-roots-gray mb-4">
              Enter your card details below to complete your purchase.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <BuyWidget
                client={thirdwebClient}
                chain={baseSepolia}
                tokenAddress={USDC_ADDRESS as `0x${string}`}
                amount={totalUsd.toString()}
                title="Add Funds"
                theme="light"
                paymentMethods={["card", "crypto"]}
                onSuccess={(data) => {
                  console.log('[CreditCardCheckout] Purchase success:', data);
                  // After funding, they would need to complete the order
                  // For now, show success and guide them to complete
                  setStep('complete');
                }}
                onError={(error) => {
                  console.error('[CreditCardCheckout] Purchase error:', error);
                  setError(error.message || 'Payment failed. Please try again.');
                }}
                onCancel={() => {
                  console.log('[CreditCardCheckout] Purchase cancelled');
                }}
              />
            </div>

            <p className="text-xs text-roots-gray mt-4 text-center">
              Powered by thirdweb and Stripe. Your payment is secure.
            </p>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setStep('info')}>
          Edit Order Details
        </Button>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Payment Received!</h1>
        <p className="text-roots-gray mb-6">
          Your account has been funded. Click below to finalize your order.
        </p>
        <Button
          className="bg-roots-primary hover:bg-roots-primary/90"
          onClick={() => onComplete([])}
        >
          Complete Purchase
        </Button>
      </div>
    );
  }

  return null;
}

// Main component that wraps with ThirdwebProvider
export function CreditCardCheckout(props: CreditCardCheckoutProps) {
  // Only render if thirdweb is configured
  if (!thirdwebClient) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center">
            <div className="text-4xl mb-3">🚧</div>
            <p className="text-amber-800 font-medium mb-2">Credit Card Coming Soon</p>
            <p className="text-sm text-amber-700 mb-4">
              Credit card payments are being configured. Please use an alternative payment method.
            </p>
            <Button onClick={props.onBack} className="bg-roots-primary hover:bg-roots-primary/90">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ThirdwebProvider>
      <CreditCardCheckoutInner {...props} />
    </ThirdwebProvider>
  );
}
