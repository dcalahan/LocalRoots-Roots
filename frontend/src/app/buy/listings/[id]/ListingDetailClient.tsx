'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PriceDisplay, PriceSummary } from '@/components/ui/PriceDisplay';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import type { ListingCardData } from '@/components/buyer/ListingCard';

// Helper to get next delivery date (next Saturday or Sunday)
function getNextDeliveryDate(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const nextDelivery = new Date(today);
  nextDelivery.setDate(today.getDate() + daysUntilSaturday);
  return nextDelivery.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface ListingDetailClientProps {
  listing: ListingCardData;
}

export default function ListingDetailClient({ listing }: ListingDetailClientProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [isDelivery, setIsDelivery] = useState(false);
  const [shareLabel, setShareLabel] = useState('Share');

  const handleShareListing = useCallback(async () => {
    const url = `${window.location.origin}/buy/listings/${listing.listingId}`;
    const shareData = {
      title: listing.metadata.produceName,
      text: `Fresh ${listing.metadata.produceName} from a neighbor on Local Roots`,
      url,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied!');
      setTimeout(() => setShareLabel('Share'), 2000);
    } catch { /* silent */ }
  }, [listing]);

  const totalPrice = BigInt(listing.pricePerUnit) * BigInt(quantity);
  const canDelivery = listing.seller.offersDelivery;
  const canPickup = listing.seller.offersPickup;

  const handleAddToCart = () => {
    addItem({
      listingId: listing.listingId,
      sellerId: listing.sellerId,
      quantity,
      pricePerUnit: listing.pricePerUnit,
      isDelivery: isDelivery && canDelivery,
      metadata: {
        produceName: listing.metadata.produceName,
        imageUrl: listing.metadata.imageUrl,
        sellerName: listing.seller.name,
        unit: listing.metadata.unit,
      },
    });

    toast({
      title: 'Added to cart',
      description: `${quantity} × ${listing.metadata.produceName}`,
    });

    router.push('/buy/cart');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-roots-gray mb-6">
        <Link href="/buy" className="hover:text-roots-primary">Home</Link>
        {' / '}
        <Link href="/buy/listings" className="hover:text-roots-primary">Listings</Link>
        {' / '}
        <span>{listing.metadata.produceName}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
          {listing.metadata.imageUrl ? (
            <img
              src={listing.metadata.imageUrl}
              alt={listing.metadata.produceName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl">
              🌱
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h1 className="text-3xl font-heading font-bold">
              {listing.metadata.produceName}
            </h1>
            <button
              onClick={handleShareListing}
              className="flex items-center gap-1 text-roots-gray hover:text-roots-primary transition-colors shrink-0 mt-2"
              title="Share this listing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-xs">{shareLabel}</span>
            </button>
          </div>

          <Link
            href={`/buy/sellers/${listing.sellerId}`}
            className="text-roots-gray hover:text-roots-primary mb-4 block"
          >
            by {listing.seller.name} →
          </Link>

          <div className="mb-4">
            <PriceDisplay amount={BigInt(listing.pricePerUnit)} size="lg" />
            <span className="text-roots-gray ml-1">/ {listing.metadata.unit}</span>
          </div>

          {listing.metadata.description && (
            <p className="text-roots-gray mb-6">{listing.metadata.description}</p>
          )}

          {/* Availability */}
          <div className="mb-6">
            {listing.quantityAvailable > 0 ? (
              <p className="text-roots-secondary font-medium">
                {listing.quantityAvailable} {listing.metadata.unit}s available
              </p>
            ) : (
              <p className="text-red-600 font-medium">Out of stock</p>
            )}
          </div>

          {/* Order options */}
          <Card className="mb-6">
            <CardContent className="p-4 space-y-4">
              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    -
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.min(listing.quantityAvailable, Number(e.target.value))))}
                    className="w-20 text-center"
                    min={1}
                    max={listing.quantityAvailable}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.min(listing.quantityAvailable, quantity + 1))}
                    disabled={quantity >= listing.quantityAvailable}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Fulfillment method */}
              <div>
                <Label className="text-base font-medium">How would you like to get it?</Label>
                <div className="flex flex-col gap-3 mt-3">
                  {canPickup && (
                    <div
                      onClick={() => setIsDelivery(false)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        !isDelivery
                          ? 'border-roots-primary bg-roots-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          !isDelivery ? 'border-roots-primary' : 'border-gray-300'
                        }`}>
                          {!isDelivery && <div className="w-2.5 h-2.5 rounded-full bg-roots-primary" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span className="font-medium">Pickup</span>
                          </div>
                          <div className="mt-2 text-sm text-roots-gray space-y-1">
                            <p className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              Near Hilton Head Island, SC
                            </p>
                            <p className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Available: Sat-Sun 9am-12pm
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {canDelivery && (
                    <div
                      onClick={() => setIsDelivery(true)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        isDelivery
                          ? 'border-roots-primary bg-roots-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          isDelivery ? 'border-roots-primary' : 'border-gray-300'
                        }`}>
                          {isDelivery && <div className="w-2.5 h-2.5 rounded-full bg-roots-primary" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                            <span className="font-medium">Delivery</span>
                          </div>
                          <div className="mt-2 text-sm text-roots-gray space-y-1">
                            <p className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Estimated: {getNextDeliveryDate()}
                            </p>
                            <p className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                              </svg>
                              You&apos;ll be notified when delivered
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <PriceSummary label="Total" amount={totalPrice} />
              </div>
            </CardContent>
          </Card>

          {/* Add to cart button */}
          <Button
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
            size="lg"
            onClick={handleAddToCart}
            disabled={listing.quantityAvailable === 0}
          >
            {listing.quantityAvailable === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </div>
    </div>
  );
}
