'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateListing } from '@/hooks/useUpdateListing';
import { useToast } from '@/hooks/use-toast';
import type { SellerListing } from '@/hooks/useSellerListings';
import { rootsToStablecoin, stablecoinToRoots } from '@/lib/contracts/marketplace';

interface EditListingModalProps {
  listing: SellerListing;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditListingModal({ listing, onClose, onSuccess }: EditListingModalProps) {
  const { toast } = useToast();
  const { updateListing, isPending, isSuccess, error, reset } = useUpdateListing();

  // Listing prices live on-chain in ROOTS units (18 decimals, where 100 ROOTS
  // = $1). Sellers should never see "ROOTS" — they think in dollars. Convert
  // to USD for display + editing; convert back to ROOTS on save. Doug,
  // Apr 28 2026.
  const initialUsd = Number(rootsToStablecoin(BigInt(listing.pricePerUnit))) / 1_000_000;
  const [priceUsd, setPriceUsd] = useState(initialUsd.toFixed(2));
  const [quantity, setQuantity] = useState(listing.quantityAvailable);
  const [active, setActive] = useState(listing.active);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Listing updated!',
        description: 'Your changes have been saved.',
      });
      onSuccess();
      onClose();
    }
  }, [isSuccess, toast, onSuccess, onClose]);

  // Handle errors
  useEffect(() => {
    if (error) {
      let message = 'Something went wrong. Please try again.';
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('user rejected') || errorMsg.includes('user denied')) {
        message = 'Transaction was cancelled.';
      } else if (errorMsg.includes('not listing owner')) {
        message = 'You can only edit your own listings.';
      }

      toast({
        title: 'Update failed',
        description: message,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const usd = parseFloat(priceUsd);
    if (isNaN(usd) || usd <= 0) {
      toast({
        title: 'Invalid price',
        description: 'Please enter a valid price greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    if (quantity < 0) {
      toast({
        title: 'Invalid quantity',
        description: 'Quantity cannot be negative.',
        variant: 'destructive',
      });
      return;
    }

    // Convert USD → ROOTS base units for the on-chain write.
    // Math.round on (usd * 1e6) avoids floating-point edge cases like
    // 4.50 × 1e6 = 4499999.999999999. Result is in USDC base units (6
    // decimals), which stablecoinToRoots upcasts to ROOTS (18 decimals
    // × the 100:1 USD-to-ROOTS ratio). For $4.50 → 4_500_000n →
    // 450_000_000_000_000_000_000n (450 ROOTS).
    const usdcUnits = BigInt(Math.round(usd * 1_000_000));
    const rootsUnits = stablecoinToRoots(usdcUnits);

    try {
      await updateListing({
        listingId: BigInt(listing.listingId),
        metadataIpfs: listing.metadataIpfs,
        pricePerUnit: rootsUnits,
        quantityAvailable: quantity,
        active,
      });
    } catch (err) {
      console.error('Update listing error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-heading font-bold">
              Edit {listing.metadata?.produceName || 'Listing'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isPending}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="price">Price ($)</Label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-500 pointer-events-none">
                  $
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  disabled={isPending}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Per {listing.metadata?.unit || 'unit'}
              </p>
            </div>

            <div>
              <Label htmlFor="quantity">Quantity Available</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="mt-1"
                disabled={isPending}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Active</p>
                <p className="text-sm text-roots-gray">
                  {active ? 'Visible to buyers' : 'Hidden from marketplace'}
                </p>
              </div>
              <Switch
                checked={active}
                onCheckedChange={setActive}
                disabled={isPending}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
              >
                {isPending ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
