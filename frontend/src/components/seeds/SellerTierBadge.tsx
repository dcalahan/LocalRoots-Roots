'use client';

import { getSellerTier, getNextSellerTier, SELLER_TIERS, type SellerTier } from './PhaseConfig';

interface SellerTierBadgeProps {
  completedSales: number;
  showProgress?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SellerTierBadge({
  completedSales,
  showProgress = false,
  size = 'md',
  className = ''
}: SellerTierBadgeProps) {
  const tier = getSellerTier(completedSales);
  const nextTier = getNextSellerTier(completedSales);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  const emojiSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  // Calculate progress to next tier
  const progress = nextTier
    ? ((completedSales - tier.minSales) / (nextTier.minSales - tier.minSales)) * 100
    : 100;

  return (
    <div className={className}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border ${tier.bgColor} ${tier.borderColor} ${tier.color} ${sizeClasses[size]}`}
      >
        <span className={emojiSizes[size]}>{tier.emoji}</span>
        <span className="font-medium">{tier.name}</span>
      </div>

      {showProgress && nextTier && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{completedSales} sales</span>
            <span>Next: {nextTier.name} ({nextTier.minSales})</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${tier.bgColor} transition-all`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface SellerTierCardProps {
  completedSales: number;
  className?: string;
}

export function SellerTierCard({ completedSales, className = '' }: SellerTierCardProps) {
  const tier = getSellerTier(completedSales);
  const nextTier = getNextSellerTier(completedSales);

  const progress = nextTier
    ? ((completedSales - tier.minSales) / (nextTier.minSales - tier.minSales)) * 100
    : 100;

  const salesToNext = nextTier ? nextTier.minSales - completedSales : 0;

  return (
    <div className={`rounded-xl border-2 ${tier.borderColor} ${tier.bgColor} p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">{tier.emoji}</span>
        <div>
          <div className={`text-lg font-bold ${tier.color}`}>{tier.name}</div>
          <div className="text-sm text-gray-600">{tier.description}</div>
        </div>
      </div>

      {nextTier ? (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{completedSales} sales completed</span>
            <span className={tier.color}>{salesToNext} more to {nextTier.name}</span>
          </div>
          <div className="h-3 bg-white rounded-full overflow-hidden border">
            <div
              className={`h-full bg-gradient-to-r from-green-400 to-green-500 transition-all`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="text-center text-sm text-amber-700 font-medium">
          You've reached the highest tier!
        </div>
      )}
    </div>
  );
}

interface SellerTierProgressProps {
  completedSales: number;
  className?: string;
}

export function SellerTierProgress({ completedSales, className = '' }: SellerTierProgressProps) {
  const currentTier = getSellerTier(completedSales);

  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <span>🏆</span> Seller Tiers
      </h3>
      <div className="space-y-3">
        {SELLER_TIERS.map((tier, index) => {
          const isAchieved = completedSales >= tier.minSales;
          const isCurrent = tier.name === currentTier.name;
          const isNext = index === SELLER_TIERS.findIndex(t => t.name === currentTier.name) + 1;

          return (
            <div
              key={tier.name}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                isCurrent
                  ? `${tier.bgColor} ${tier.borderColor} border-2`
                  : isAchieved
                  ? 'bg-gray-50'
                  : 'opacity-50'
              }`}
            >
              <span className="text-xl">{tier.emoji}</span>
              <div className="flex-1">
                <div className={`font-medium ${isAchieved ? tier.color : 'text-gray-400'}`}>
                  {tier.name}
                </div>
                <div className="text-xs text-gray-500">
                  {tier.minSales === 0 ? 'Start here' : `${tier.minSales}+ sales`}
                </div>
              </div>
              {isAchieved && !isCurrent && (
                <span className="text-green-500 text-sm">✓</span>
              )}
              {isCurrent && (
                <span className="text-xs bg-white px-2 py-0.5 rounded-full border">Current</span>
              )}
              {isNext && !isAchieved && (
                <span className="text-xs text-amber-600">
                  {tier.minSales - completedSales} to go
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
