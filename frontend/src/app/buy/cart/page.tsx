'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriceDisplay, PriceSummary } from '@/components/ui/PriceDisplay';
import { useCart } from '@/contexts/CartContext';
import { getIpfsUrl } from '@/lib/pinata';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, getTotal, getSellerTotals, clearCart } = useCart();

  // Debug: Log cart items
  console.log('[Cart] Items in cart:', items.map(i => ({ listingId: i.listingId, name: i.metadata.produceName, qty: i.quantity })));

  const sellerTotals = useMemo(() => getSellerTotals(), [getSellerTotals]);
  const total = useMemo(() => getTotal(), [getTotal]);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Your cart is empty</h1>
        <p className="text-roots-gray mb-6">
          Discover fresh produce from your neighbors
        </p>
        <Link href="/buy">
          <Button className="bg-roots-primary">Start Shopping</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold">Your Cart</h1>
        <Button variant="ghost" onClick={clearCart} className="text-red-600">
          Clear All
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Cart items */}
        <div className="md:col-span-2 space-y-4">
          {Array.from(sellerTotals.entries()).map(([sellerId, { items: sellerItems }]) => (
            <Card key={sellerId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium">
                  {sellerItems[0]?.metadata.sellerName || 'Seller'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sellerItems.map((item) => (
                  <div key={item.listingId} className="flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                      {resolveImageUrl(item.metadata.imageUrl) ? (
                        <img
                          src={resolveImageUrl(item.metadata.imageUrl)!}
                          alt={item.metadata.produceName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          🌱
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{item.metadata.produceName}</h3>
                      <div className="text-sm text-roots-gray">
                        <PriceDisplay amount={BigInt(item.pricePerUnit)} size="sm" />
                        <span> / {item.metadata.unit}</span>
                      </div>
                      <div className="text-xs text-roots-gray mt-1">
                        {item.isDelivery ? 'Delivery' : 'Pickup'}
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.listingId, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.listingId, Number(e.target.value))}
                          className="w-12 h-8 text-center p-0"
                          min={1}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => updateQuantity(item.listingId, item.quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order summary */}
        <div>
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-roots-gray">Items ({items.length})</span>
                  <span>{items.reduce((sum, i) => sum + i.quantity, 0)} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-roots-gray">Sellers</span>
                  <span>{sellerTotals.size}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <PriceSummary label="Total" amount={total} />
              </div>

              <Button
                className="w-full bg-roots-primary hover:bg-roots-primary/90"
                size="lg"
                onClick={() => router.push('/buy/checkout')}
              >
                Proceed to Checkout
              </Button>

              <p className="text-xs text-center text-roots-gray">
                You&apos;ll confirm each purchase separately
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
