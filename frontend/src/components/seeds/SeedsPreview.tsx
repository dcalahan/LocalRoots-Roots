'use client';

import { calculateSeeds, formatSeeds, getMultiplierInfo, getRewardLabel, SEEDS_PER_DOLLAR_BUYER, SEEDS_PER_DOLLAR_SELLER } from './PhaseConfig';

interface SeedsPreviewProps {
  usdAmount: number;
  isSeller?: boolean;
  showBreakdown?: boolean;
  className?: string;
  /** Whether we're in Phase 2 ($ROOTS token economy). If undefined, shows Seeds (Phase 1 default). */
  isPhase2?: boolean;
}

export function SeedsPreview({ usdAmount, isSeller = false, showBreakdown = false, className = '', isPhase2 = false }: SeedsPreviewProps) {
  const info = getMultiplierInfo();
  const baseRate = isSeller ? SEEDS_PER_DOLLAR_SELLER : SEEDS_PER_DOLLAR_BUYER;
  const baseSeeds = Math.floor(usdAmount * baseRate);
  const totalSeeds = calculateSeeds(usdAmount, isSeller);
  const rewardLabel = getRewardLabel(isPhase2);

  if (usdAmount <= 0) {
    return null;
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
