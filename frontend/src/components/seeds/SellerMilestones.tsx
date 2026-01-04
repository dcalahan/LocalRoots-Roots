'use client';

import { SELLER_MILESTONES, formatSeeds, getMultiplierInfo } from './PhaseConfig';

interface SellerMilestonesProps {
  completedSales?: number;
  hasFirstListing?: boolean;
  showMultiplier?: boolean;
  compact?: boolean;
  className?: string;
}

export function SellerMilestones({
  completedSales = 0,
  hasFirstListing = false,
  showMultiplier = true,
  compact = false,
  className = ''
}: SellerMilestonesProps) {
  const info = getMultiplierInfo();

  const getMilestoneStatus = (milestone: typeof SELLER_MILESTONES[0]): 'completed' | 'active' | 'locked' => {
    if (milestone.name === 'First listing' && hasFirstListing) return 'completed';
    if (milestone.name === 'First sale' && completedSales >= 1) return 'completed';
    if (milestone.name === '5 sales' && completedSales >= 5) return 'completed';
    if (milestone.name === '15 sales' && completedSales >= 15) return 'completed';

    // Find the next milestone
    if (milestone.name === 'First listing' && !hasFirstListing) return 'active';
    if (milestone.name === 'First sale' && hasFirstListing && completedSales < 1) return 'active';
    if (milestone.name === '5 sales' && completedSales >= 1 && completedSales < 5) return 'active';
    if (milestone.name === '15 sales' && completedSales >= 5 && completedSales < 15) return 'active';

    return 'locked';
  };

  if (compact) {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🎯</span>
          <h3 className="font-semibold">Seller Milestones</h3>
          {showMultiplier && info.isActive && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {info.multiplierDisplay} bonus
            </span>
          )}
        </div>
        <div className="space-y-2">
          {SELLER_MILESTONES.map((milestone) => {
            const status = getMilestoneStatus(milestone);
            const adjustedSeeds = Math.floor(milestone.seeds * info.multiplier);

            return (
              <div
                key={milestone.name}
                className={`flex items-center justify-between text-sm ${
                  status === 'completed' ? 'text-green-600' :
                  status === 'active' ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {status === 'completed' ? (
                    <span className="text-green-500">✓</span>
                  ) : status === 'active' ? (
                    <span className="text-amber-500">○</span>
                  ) : (
                    <span className="text-gray-300">○</span>
                  )}
                  <span>{milestone.name}</span>
                </div>
                <span className="font-medium">
                  {formatSeeds(showMultiplier && info.isActive ? adjustedSeeds : milestone.seeds)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🎯</span>
        <h3 className="text-xl font-bold">Seller Milestones</h3>
      </div>
      <p className="text-gray-600 text-sm mb-4">
        Earn bonus Seeds as you grow your seller journey
      </p>
      {showMultiplier && info.isActive && (
        <div className="mb-4 p-2 bg-amber-100 rounded-lg text-sm text-amber-800">
          🔥 Early adopter bonus: All milestones earn {info.multiplierDisplay} Seeds!
        </div>
      )}
      <div className="space-y-3">
        {SELLER_MILESTONES.map((milestone) => {
          const status = getMilestoneStatus(milestone);
          const adjustedSeeds = Math.floor(milestone.seeds * info.multiplier);

          return (
            <div
              key={milestone.name}
              className={`flex items-center justify-between p-3 rounded-lg ${
                status === 'completed' ? 'bg-green-50 border border-green-200' :
                status === 'active' ? 'bg-white border border-amber-300' : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  status === 'completed' ? 'bg-green-500 text-white' :
                  status === 'active' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {status === 'completed' ? '✓' : status === 'active' ? '!' : '?'}
                </div>
                <div>
                  <div className={`font-medium ${status === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>
                    {milestone.name}
                  </div>
                  <div className={`text-xs ${status === 'locked' ? 'text-gray-300' : 'text-gray-500'}`}>
                    {milestone.requirement}
                  </div>
                </div>
              </div>
              <div className={`text-right ${status === 'locked' ? 'text-gray-400' : 'text-gray-900'}`}>
                <div className="font-bold">
                  {formatSeeds(showMultiplier && info.isActive ? adjustedSeeds : milestone.seeds)}
                </div>
                <div className="text-xs">Seeds</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
