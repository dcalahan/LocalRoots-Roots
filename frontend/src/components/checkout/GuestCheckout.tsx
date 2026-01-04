'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatRoots, rootsToFiat, formatFiat } from '@/lib/pricing';
import { CartItem } from '@/contexts/CartContext';

interface GuestCheckoutProps {
  items: CartItem[];
  total: bigint;
  sellerTotals: Map<string, { total: bigint; items: CartItem[] }>;
  onBack: () => void;
  onComplete: (orderIds: string[]) => void;
}

type CheckoutStep = 'info' | 'payment' | 'processing' | 'complete' | 'error';

export function GuestCheckout({
  items,
  total,
  sellerTotals,
  onBack,
  onComplete,
}: GuestCheckoutProps) {
  const [step, setStep] = useState<CheckoutStep>('info');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [crossmintOrderId, setCrossmintOrderId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const hasDeliveryItems = items.some(item => item.isDelivery);
  const totalUsd = Number(rootsToFiat(total));

  const handleContinueToPayment = async () => {
    // Validate required fields
    if (!email.trim()) {
      setError('Email is required for order confirmation');
      return;
    }
    if (hasDeliveryItems && !deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }
    setError(null);

    // Credit card payments are coming soon - skip API call and show message
    // Crossmint is designed for NFT minting, not general e-commerce
    // TODO: Integrate Stripe for proper credit card payment support
    setStep('payment');
  };

  const handleOpenCheckout = () => {
    if (checkoutUrl) {
      // Open Crossmint checkout in a new window
      window.open(checkoutUrl, '_blank', 'width=500,height=700');
    }
  };

  // Info collection step
  if (step === 'info') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={onBack} className="text-roots-gray hover:text-roots-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold">Guest Checkout</h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>No wallet needed!</strong> Pay with credit card and we'll handle the crypto for you.
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
              <p className="text-xs text-roots-gray mt-1">For order confirmation and tracking</p>
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
              <CardTitle className="text-lg flex items-center gap-2">
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
                  placeholder="123 Main St, Apt 4B, City, State ZIP"
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
          onClick={handleContinueToPayment}
        >
          Continue to Payment
        </Button>
      </div>
    );
  }

  // Payment step
  if (step === 'payment') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setStep('info')} className="text-roots-gray hover:text-roots-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-heading font-bold">Payment</h1>
        </div>

        {/* Order summary */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex justify-between mb-2">
              <span className="text-roots-gray">Sending receipt to</span>
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
                <span>{formatFiat(rootsToFiat(total))}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Payment options */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Secure Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
    {checkoutUrl ? (
              <div className="text-center py-4">
                <p className="text-roots-gray mb-4">
                  Click below to complete your payment securely via Crossmint.
                </p>
                <Button
                  className="w-full bg-roots-primary hover:bg-roots-primary/90"
                  size="lg"
                  onClick={handleOpenCheckout}
                >
                  Pay {formatFiat(rootsToFiat(total))} with Credit Card
                </Button>
                <p className="text-xs text-roots-gray mt-4">
                  A secure payment window will open. After payment, return here for confirmation.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <div className="text-4xl mb-3">🚧</div>
                <p className="text-amber-800 font-medium mb-2">Credit Card Payments Coming Soon!</p>
                <p className="text-sm text-amber-700 mb-4">
                  We're integrating secure credit card processing and it will be available shortly.
                  In the meantime, you can pay with a crypto wallet - it's fast and easy!
                </p>
                <Button
                  onClick={onBack}
                  className="bg-roots-primary hover:bg-roots-primary/90 text-white"
                >
                  Pay with Crypto Wallet Instead
                </Button>
                <p className="text-xs text-amber-600 mt-3">
                  Don't have a wallet? We'll help you set one up - it only takes a minute.
                </p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-4 text-gray-400">
              <span className="text-sm">Accepted:</span>
              <div className="flex gap-2">
                <div className="w-10 h-6 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">VISA</div>
                <div className="w-10 h-6 bg-red-500 rounded text-white text-xs flex items-center justify-center font-bold">MC</div>
                <div className="w-10 h-6 bg-gray-800 rounded text-white text-xs flex items-center justify-center">Pay</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => setStep('info')}>
          Edit Order Details
        </Button>

        <p className="text-xs text-center text-roots-gray mt-4">
          Credit card payments powered by Stripe coming soon.
        </p>
      </div>
    );
  }

  // Processing step
  if (step === 'processing') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4 animate-pulse">💳</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Setting Up Payment</h1>
        <p className="text-roots-gray">Please wait while we prepare your checkout...</p>
        <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mt-6" />
      </div>
    );
  }

  // Error step
  if (step === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Payment Failed</h1>
        <p className="text-roots-gray mb-6">{error || 'Something went wrong with your payment.'}</p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => setStep('info')} className="bg-roots-primary">
            Try Again
          </Button>
          <Button variant="outline" onClick={onBack}>
            Use Different Payment
          </Button>
        </div>
      </div>
    );
  }

  // Complete step
  if (step === 'complete') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Order Placed!</h1>
        <p className="text-roots-gray mb-6">
          A confirmation email has been sent to {email}.
        </p>
        <Button onClick={() => onComplete([])} className="bg-roots-primary">
          Done
        </Button>
      </div>
    );
  }

  return null;
}
