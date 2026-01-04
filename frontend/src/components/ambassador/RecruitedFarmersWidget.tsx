'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSeeds, useSeedsHistory, formatSeeds, type SeedsEvent } from '@/hooks/useSeeds';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorOrders, formatOrderStatus, calculateCommission } from '@/hooks/useAmbassadorOrders';
import { AMBASSADOR_COMMISSION_PERCENT } from '@/components/seeds/PhaseConfig';
import { formatUnits } from 'viem';
import type { Address } from 'viem';

interface RecruitedFarmersWidgetProps {
  address: Address | undefined;
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(parseInt(timestamp) * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatRoots(amount: bigint): string {
  const formatted = formatUnits(amount, 18);
  const num = parseFloat(formatted);
  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function RecruitedFarmersWidget({ address }: RecruitedFarmersWidgetProps) {
  const { ambassador, ambassadorId } = useAmbassadorStatus();
  const { data: seedsData, isLoading: isSeedsLoading } = useSeeds(address);
  const { data: seedsHistory, isLoading: isHistoryLoading } = useSeedsHistory(address, 50);
  const { data: ordersData, isLoading: isOrdersLoading } = useAmbassadorOrders(ambassadorId?.toString());
  const [showAllOrders, setShowAllOrders] = useState(false);

  // Filter to only referral/recruitment events (matches subgraph reason values)
  const referralEvents = (seedsHistory || []).filter(
    (e: SeedsEvent) => e.reason === 'referral' || e.reason === 'recruitment'
  );

  // Calculate totals
  const totalReferralSeeds = seedsData?.referrals || '0';
  const totalRecruitmentSeeds = seedsData?.recruitments || '0';
  const recruitedSellersCount = Number(ambassador?.recruitedSellers || 0n);

  // Orders from recruited sellers
  const recruitedOrders = ordersData?.orders || [];
  const displayOrders = showAllOrders ? recruitedOrders : recruitedOrders.slice(0, 5);

  // Calculate potential commissions from pending orders
  const pendingCommission = recruitedOrders
    .filter(o => o.status !== 'Completed' && o.status !== 'Refunded' && o.status !== 'Cancelled')
    .reduce((sum, o) => sum + calculateCommission(o.totalPrice), 0n);

  // Pending $ROOTS from ambassador contract (for Phase 2)
  const pendingRoots = ambassador?.totalPending || 0n;
  const earnedRoots = ambassador?.totalEarned || 0n;

  if (isSeedsLoading || isHistoryLoading || isOrdersLoading) {
    return (
      <Card className="border-2 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-2xl">🌾</span> Recruited Farmers Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <span className="text-2xl">🌾</span> Recruited Farmers Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-roots-primary">
              {recruitedSellersCount}
            </div>
            <div className="text-xs text-roots-gray">Active Farmers</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-amber-600">
              🌱 {formatSeeds(totalReferralSeeds)}
            </div>
            <div className="text-xs text-roots-gray">From Sales ({AMBASSADOR_COMMISSION_PERCENT}%)</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              🌱 {formatSeeds(totalRecruitmentSeeds)}
            </div>
            <div className="text-xs text-roots-gray">Recruitment Bonuses</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {referralEvents.length}
            </div>
            <div className="text-xs text-roots-gray">Commission Events</div>
          </div>
        </div>

        {/* Pending $ROOTS (Phase 2) */}
        {(pendingRoots > 0n || earnedRoots > 0n) && (
          <div className="p-4 bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 rounded-lg border border-roots-primary/20">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <span>💰</span> $ROOTS Earnings (Phase 2)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-bold text-roots-primary">
                  {formatRoots(pendingRoots)} $ROOTS
                </div>
                <div className="text-xs text-roots-gray">Pending (vesting)</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">
                  {formatRoots(earnedRoots)} $ROOTS
                </div>
                <div className="text-xs text-roots-gray">Total Earned</div>
              </div>
            </div>
          </div>
        )}

        {/* When do I receive Seeds/ROOTS? */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-800">
            <span>⏰</span> When Do I Receive Rewards?
          </h4>
          <div className="space-y-2 text-sm text-blue-700">
            <p>
              <strong>Seeds:</strong> Earned instantly when your recruited farmers make sales.
              You earn {AMBASSADOR_COMMISSION_PERCENT}% of each sale as Seeds.
            </p>
            <p>
              <strong>$ROOTS:</strong> Seeds convert to $ROOTS tokens at Phase 2 launch.
              Early Seeds have bonus multipliers!
            </p>
            <p>
              <strong>Recruitment Bonus:</strong> Earn bonus Seeds when a farmer you recruited makes their first sale.
            </p>
          </div>
        </div>

        {/* Orders from Recruited Sellers */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <span>📦</span> Orders from Your Farmers
            {recruitedOrders.length > 0 && (
              <span className="text-sm font-normal text-roots-gray">
                ({recruitedOrders.length} total)
              </span>
            )}
          </h4>

          {pendingCommission > 0n && (
            <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-amber-800">Pending Commission (in-progress orders):</span>
                <span className="font-bold text-amber-700">
                  ~${formatUnits(pendingCommission, 6)} USDC
                </span>
              </div>
            </div>
          )}

          {recruitedOrders.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border">
              <div className="text-4xl mb-2">📦</div>
              <p className="text-roots-gray text-sm">
                No orders yet from your recruited farmers.
              </p>
              <p className="text-xs text-roots-gray mt-2">
                When your farmers receive orders, you'll see them here.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {displayOrders.map((order) => {
                  const status = formatOrderStatus(order.status);
                  const commission = calculateCommission(order.totalPrice);
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-amber-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xl bg-gray-100 p-2 rounded-full">
                          {order.isDelivery ? '🚚' : '📍'}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            Order #{order.id}
                          </div>
                          <div className="text-xs text-roots-gray">
                            {formatTimeAgo(order.createdAt)} • Seller #{order.seller.id}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                        <div className="text-sm font-medium text-gray-700 mt-1">
                          ${formatUnits(BigInt(order.totalPrice), 6)}
                        </div>
                        <div className="text-xs text-amber-600">
                          +${formatUnits(commission, 6)} commission
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {recruitedOrders.length > 5 && (
                <button
                  onClick={() => setShowAllOrders(!showAllOrders)}
                  className="w-full mt-2 text-sm text-roots-primary hover:underline"
                >
                  {showAllOrders ? 'Show less' : `Show all ${recruitedOrders.length} orders`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <span>📜</span> Recent Commission Activity
          </h4>
          {referralEvents.length === 0 ? (
            <div className="text-center py-6 bg-white rounded-lg border">
              <div className="text-4xl mb-2">🌱</div>
              <p className="text-roots-gray text-sm">
                No commission activity yet. When your recruited farmers make sales,
                you'll see your earnings here!
              </p>
              <p className="text-xs text-roots-gray mt-2">
                Share your farmer referral link to start earning.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {referralEvents.slice(0, 10).map((event: SeedsEvent) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-amber-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`text-xl ${
                      event.reason === 'recruitment' ? 'bg-green-100' : 'bg-amber-100'
                    } p-2 rounded-full`}>
                      {event.reason === 'recruitment' ? '🎉' : '💵'}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {event.reason === 'recruitment'
                          ? 'Recruitment Bonus'
                          : 'Sales Commission'
                        }
                      </div>
                      <div className="text-xs text-roots-gray">
                        {formatTimeAgo(event.timestamp)}
                        {event.orderId && (
                          <span className="ml-1">• Order #{event.orderId}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-600">
                      +{formatSeeds(event.adjustedAmount)} 🌱
                    </div>
                    {event.multiplier > 1 && (
                      <div className="text-xs text-green-600">
                        {event.multiplier}x multiplier
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help text */}
        <div className="text-xs text-roots-gray text-center pt-2 border-t">
          Commission rate: {AMBASSADOR_COMMISSION_PERCENT}% of your farmers' sales for their first year.
        </div>
      </CardContent>
    </Card>
  );
}
