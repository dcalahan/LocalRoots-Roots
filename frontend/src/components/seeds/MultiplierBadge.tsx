'use client';

import { getMultiplierInfo } from './PhaseConfig';

interface MultiplierBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showDays?: boolean;
  className?: string;
}

export function MultiplierBadge({ size = 'md', showDays = true, className = '' }: MultiplierBadgeProps) {
  const info = getMultiplierInfo();

  if (!info.isActive && info.multiplier === 1.0) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white ${sizeClasses[size]} ${className}`}
    >
      <span>🔥</span>
      <span>{info.multiplierDisplay} Seeds</span>
      {showDays && info.daysRemaining > 0 && (
        <span className="opacity-90">({info.daysRemaining}d left)</span>
      )}
    </span>
  );
}
