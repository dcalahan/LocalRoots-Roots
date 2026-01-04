'use client';

import Link from 'next/link';
import { getMultiplierInfo } from './PhaseConfig';

interface EarlyAdopterBannerProps {
  showLink?: boolean;
  className?: string;
}

export function EarlyAdopterBanner({ showLink = true, className = '' }: EarlyAdopterBannerProps) {
  const info = getMultiplierInfo();

  if (!info.isActive && info.multiplier === 1.0) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 ${className}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm md:text-base flex-wrap">
        <span className="text-xl">🔥</span>
        <span className="font-semibold">Early Adopter Bonus:</span>
        <span>
          Earn <strong>{info.multiplierDisplay} Seeds</strong> for the next{' '}
          <strong>{info.daysRemaining} days</strong>!
        </span>
        {showLink && (
          <Link href="/about/tokenomics" className="underline hover:no-underline ml-2">
            Learn more
          </Link>
        )}
      </div>
    </div>
  );
}
