'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { GardenPlant } from '@/types/my-garden';
import type { SellerListing } from '@/hooks/useSellerListings';
import { getCatalogItem } from '@/lib/produce';
import { getCropDisplayName } from '@/lib/gardenStatus';
import { getCropEmoji } from '@/lib/cropEmoji';
import { Button } from '@/components/ui/button';

interface ListFromGardenSheetProps {
  isOpen: boolean;
  onClose: () => void;
  plants: GardenPlant[];
  existingListings: SellerListing[];
}

/**
 * V1 of the Sell + My Garden + Sage Unification (per CLAUDE.md plan).
 *
 * Bottom sheet shown when the seller clicks "Add Listing" on the dashboard
 * AND has plants in their My Garden. Displays inventory as a quick-pick
 * grid: tap a plant → routes to the existing listing form with crop +
 * quantity pre-filled (uses the `?source=garden&crop=...&qty=...` contract
 * already supported by CreateListingForm).
 *
 * Falls through to "List something else" → routes to /sell/listings/new
 * clean for crops not in My Garden (e.g. surplus from a friend's garden,
 * a crop they grow but don't track).
 *
 * Already-listed plants are dimmed with an "Already listed" badge but
 * remain tappable — a seller might list a second batch.
 *
 * Skipped entirely (sheet doesn't open) if `plants` is empty.
 */
export function ListFromGardenSheet({
  isOpen,
  onClose,
  plants,
  existingListings,
}: ListFromGardenSheetProps) {
  const router = useRouter();

  // Lock body scroll while open (mobile sheet UX)
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Active plants only — exclude harvested/removed
  const activePlants = plants.filter(
    (p) => !p.removedDate && !p.harvestedDate && p.manualStatus !== 'done',
  );

  // V1 dropped the "already listed" badge — useSellerListings's local
  // ListingMetadata interface doesn't expose produceId (it's in the
  // IPFS metadata but not surfaced on the type). Cleanest path is to
  // surface it on the type as a follow-up; for V1 we just let users
  // tap any plant. If they double-list, the contract's per-listing
  // model handles that fine (each listing is independent).
  const listedCropIds = new Set<string>();
  void existingListings;

  const handlePlantClick = (plant: GardenPlant) => {
    const params = new URLSearchParams({
      source: 'garden',
      crop: plant.cropId,
      qty: String(plant.quantity || 1),
    });
    onClose();
    router.push(`/sell/listings/new?${params.toString()}`);
  };

  const handleListSomethingElse = () => {
    onClose();
    router.push('/sell/listings/new');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-xl font-bold">List from your garden</h2>
            <p className="text-xs text-roots-gray mt-0.5">
              Tap a plant to create a listing — we&apos;ll prefill the details.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-roots-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inventory grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {activePlants.length === 0 ? (
            <div className="text-center py-10 text-roots-gray">
              <p className="text-sm">No active plants in your garden right now.</p>
              <p className="text-xs mt-1">Tap &ldquo;List something else&rdquo; below to add a listing the regular way.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activePlants.map((plant) => {
                const catalog = getCatalogItem(plant.cropId);
                const displayName = getCropDisplayName(plant.cropId, plant.customVarietyName);
                const alreadyListed = listedCropIds.has(plant.cropId);
                const emoji = getCropEmoji(plant.cropId);

                return (
                  <button
                    key={plant.id}
                    type="button"
                    onClick={() => handlePlantClick(plant)}
                    className={`text-left rounded-lg border-2 transition-colors overflow-hidden ${
                      alreadyListed
                        ? 'border-gray-200 bg-gray-50 hover:border-roots-secondary/40'
                        : 'border-gray-200 hover:border-roots-primary bg-white'
                    }`}
                  >
                    {/* Photo or emoji fallback */}
                    <div className="aspect-square bg-roots-cream relative">
                      {catalog?.image ? (
                        <img
                          src={catalog.image}
                          alt={displayName}
                          className={`w-full h-full object-cover ${alreadyListed ? 'opacity-60' : ''}`}
                        />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center text-5xl ${alreadyListed ? 'opacity-60' : ''}`}>
                          {emoji}
                        </div>
                      )}
                      {alreadyListed && (
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold uppercase tracking-wide bg-roots-secondary text-white px-2 py-0.5 rounded-full">
                          Listed
                        </span>
                      )}
                    </div>
                    {/* Name + qty */}
                    <div className="p-2.5">
                      <p className="font-semibold text-sm text-gray-900 leading-tight">
                        {displayName}
                      </p>
                      <p className="text-xs text-roots-gray mt-0.5">
                        {plant.quantity} plant{plant.quantity !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — always shows the escape hatch */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-200 bg-roots-cream/50">
          <Button
            type="button"
            onClick={handleListSomethingElse}
            variant="outline"
            className="w-full border-roots-gray/40 hover:border-roots-primary hover:text-roots-primary"
          >
            List something else (not in your garden) →
          </Button>
        </div>
      </div>
    </div>
  );
}
