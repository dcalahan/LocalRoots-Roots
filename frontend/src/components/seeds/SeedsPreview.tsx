'use client';

import { calculateSeeds, formatSeeds, getMultiplierInfo, SEEDS_PER_DOLLAR_BUYER, SEEDS_PER_DOLLAR_SELLER } from './PhaseConfig';

interface SeedsPreviewProps {
  usdAmount: number;
  isSeller?: boolean;
  showBreakdown?: boolean;
  className?: string;
}

export function SeedsPreview({ usdAmount, isSeller = false, showBreakdown = false, className = '' }: SeedsPreviewProps) {
  const info = getMultiplierInfo();
  const baseRate = isSeller ? SEEDS_PER_DOLLAR_SELLER : SEEDS_PER_DOLLAR_BUYER;
  const baseSeeds = Math.floor(usdAmount * baseRate);
  const totalSeeds = calculateSeeds(usdAmount, isSeller);

  if (usdAmount <= 0) {
    return null;
  }

  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌱</span>
          <span className="text-sm text-amber-800">You'll earn</span>
        </div>
        <div className="text-right">
          <div className="font-bold text-amber-900 text-lg">
            {formatSeeds(totalSeeds)} Seeds
          </div>
          {showBreakdown && info.multiplier > 1 && (
            <div className="text-xs text-amber-700">
              {formatSeeds(baseSeeds)} base × {info.multiplierDisplay}
            </div>
          )}
        </div>
      </div>
      {info.isActive && (
        <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
          <span>🔥</span>
          <span>Early adopter bonus: {info.multiplierDisplay} multiplier active!</span>
        </div>
      )}
    </div>
  );
}
