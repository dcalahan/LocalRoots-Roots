'use client';

import { calculateSeeds, formatSeeds, getMultiplierInfo, getRewardLabel, SEEDS_PER_DOLLAR_BUYER, SEEDS_PER_DOLLAR_SELLER } from './PhaseConfig';

interface SeedsPreviewProps {
  usdAmount: number;
  isSeller?: boolean;
  showBreakdown?: boolean;
  className?: string;
  /** Whether we're in Phase 2 ($ROOTS token economy). If undefined, shows Seeds (Phase 1 default). */
  isPhase2?: boolean;
  /**
   * When true, the viewer is the seller of this listing — they can't buy
   * their own listing (contract reverts at marketplace.purchase line 372).
   * Renders a "no rewards" notice instead of the usual preview to avoid
   * misleading them about earnings. Doug hit this Apr 28 2026.
   */
  isOwnListing?: boolean;
}

export function SeedsPreview({ usdAmount, isSeller = false, showBreakdown = false, className = '', isPhase2 = false, isOwnListing = false }: SeedsPreviewProps) {
  const info = getMultiplierInfo();
  const baseRate = isSeller ? SEEDS_PER_DOLLAR_SELLER : SEEDS_PER_DOLLAR_BUYER;
  const baseSeeds = Math.floor(usdAmount * baseRate);
  const totalSeeds = calculateSeeds(usdAmount, isSeller);
  const rewardLabel = getRewardLabel(isPhase2);

  if (usdAmount <= 0) {
    return null;
  }

  // Viewer is the seller — show that they can't buy their own listing rather
  // than a misleading reward preview. This is the Doug-Apr-28 case: he saw
  // "500 Roots Points" on his own basil because the preview didn't know
  // the connected wallet was the seller. The contract was always going to
  // revert. Now the UI matches reality.
  if (isOwnListing) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 ${className}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">ℹ️</span>
          <span>You can&apos;t buy your own listing.</span>
        </div>
      </div>
    );
  }

  // In Phase 2, no early adopter multipliers
  const showMultiplier = !isPhase2 && info.isActive;

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌱</span>
          <span className="text-sm text-amber-800">You&apos;ll earn</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-amber-900 text-lg">
            {formatSeeds(totalSeeds)} {rewardLabel}
          </div>
          {showBreakdown && info.multiplier > 1 && !isPhase2 && (
            <div className="text-xs text-amber-700">
              {formatSeeds(baseSeeds)} base × {info.multiplierDisplay}
            </div>
          )}
        </div>
      </div>
      {showMultiplier && (
        <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
          <span>🔥</span>
          <span>Early adopter bonus: {info.multiplierDisplay} multiplier active!</span>
        </div>
      )}
    </div>
  );
}

/**
 * SeedsPreview helper note for callers:
 * - Sellers earn at SEEDS_PER_DOLLAR_SELLER (currently 500 RP/$).
 * - Buyers earn at SEEDS_PER_DOLLAR_BUYER (currently 10 RP/$).
 * - 50:1 ratio reflects the value chain — sellers grow food, buyers consume.
 * - The displayed rate is what the airdrop merkle script applies at
 *   snapshot. The on-chain SeedsEarned event may emit at a different
 *   numerical rate (the deployed mainnet contract is hardcoded at the
 *   pre-Apr-28 buyer rate of 50/$); the merkle script reconciles.
 * - See ~/.claude/plans/localroots-buyer-rate-and-self-purchase.md
 *   for the full reasoning.
 */
