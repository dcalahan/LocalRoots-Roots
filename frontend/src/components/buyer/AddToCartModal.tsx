'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { getIpfsUrl } from '@/lib/pinata';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  return getIpfsUrl(imageRef);
}

interface AddToCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: {
    listingId: string;
    sellerId: string;
    pricePerUnit: string;
    quantityAvailable: number;
    metadata: {
      produceName: string;
      imageUrl: string | null;
      unit: string;
    };
    seller: {
      name: string;
      offersDelivery: boolean;
      offersPickup: boolean;
    };
  };
}

export function AddToCartModal({ isOpen, onClose, listing }: AddToCartModalProps) {
  const { addItem } = useCart();
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [isDelivery, setIsDelivery] = useState(listing.seller.offersDelivery);

  if (!isOpen) return null;

  const totalPrice = BigInt(listing.pricePerUnit) * BigInt(quantity);
  const canDelivery = listing.seller.offersDelivery;
  const canPickup = listing.seller.offersPickup;

  const handleAddToCart = () => {
    console.log('[AddToCart] Adding item:', {
      listingId: listing.listingId,
      produceName: listing.metadata.produceName,
      quantity,
    });

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

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-heading font-semibold">Add to Cart</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Product info */}
        <div className="p-4 border-b">
          <div className="flex gap-4">
            <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
              {resolveImageUrl(listing.metadata.imageUrl) ? (
                <img
                  src={resolveImageUrl(listing.metadata.imageUrl)!}
                  alt={listing.metadata.produceName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl">🌱</span>
              )}
            </div>
            <div>
              <h3 className="font-semibold">{listing.metadata.produceName}</h3>
              <p className="text-sm text-roots-gray">from {listing.seller.name}</p>
              <div className="mt-1">
                <PriceDisplay amount={BigInt(listing.pricePerUnit)} size="sm" />
                <span className="text-sm text-roots-gray"> / {listing.metadata.unit}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="p-4 space-y-4">
          {/* Quantity */}
          <div>
            <Label className="text-sm font-medium">Quantity</Label>
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.min(listing.quantityAvailable, quantity + 1))}
                disabled={quantity >= listing.quantityAvailable}
              >
                +
              </Button>
              <span className="text-sm text-roots-gray">
                of {listing.quantityAvailable} available
              </span>
            </div>
          </div>

          {/* Fulfillment method */}
          {(canDelivery || canPickup) && (
            <div>
              <Label className="text-sm font-medium">How would you like to get it?</Label>
              <div className="flex flex-col gap-2 mt-2">
                {canPickup && (
                  <button
                    onClick={() => setIsDelivery(false)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      !isDelivery
                        ? 'border-roots-primary bg-roots-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !isDelivery ? 'border-roots-primary' : 'border-gray-300'
                      }`}>
                        {!isDelivery && <div className="w-2 h-2 rounded-full bg-roots-primary" />}
                      </div>
                      <span className="font-medium">Pickup</span>
                    </div>
                    <p className="text-xs text-roots-gray mt-1 ml-6">
                      Coordinate pickup time with seller
                    </p>
                  </button>
                )}
                {canDelivery && (
                  <button
                    onClick={() => setIsDelivery(true)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isDelivery
                        ? 'border-roots-primary bg-roots-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isDelivery ? 'border-roots-primary' : 'border-gray-300'
                      }`}>
                        {isDelivery && <div className="w-2 h-2 rounded-full bg-roots-primary" />}
                      </div>
                      <span className="font-medium">Delivery</span>
                    </div>
                    <p className="text-xs text-roots-gray mt-1 ml-6">
                      Seller will deliver to your location
                    </p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total</span>
              <PriceDisplay amount={totalPrice} size="md" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
            onClick={handleAddToCart}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </div>
  );
}
