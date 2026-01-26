'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { useSellerOrders, OrderStatus } from '@/hooks/useSellerOrders';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorOrders, formatOrderStatus, calculateCommission } from '@/hooks/useAmbassadorOrders';
import { OrderStatusLabels, type OrderWithMetadata } from '@/types/order';
import { getIpfsUrl } from '@/lib/pinata';
import { formatUnits } from 'viem';

type TabType = 'purchases' | 'sales' | 'referrals';

// Helper to resolve image URLs
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  return getIpfsUrl(imageRef);
}

function formatDate(timestamp: bigint | Date | string): string {
  if (!timestamp) return '';
  if (typeof timestamp === 'bigint') {
    if (timestamp === 0n) return '';
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString();
  }
  // Unix timestamp string
  return new Date(parseInt(timestamp) * 1000).toLocaleDateString();
}

function getStatusColor(status: OrderStatus | string): string {
  const statusNum = typeof status === 'number' ? status : OrderStatus[status as keyof typeof OrderStatus];
  switch (statusNum) {
    case OrderStatus.Pending:
      return 'bg-yellow-100 text-yellow-800';
    case OrderStatus.Accepted:
      return 'bg-blue-100 text-blue-800';
    case OrderStatus.ReadyForPickup:
    case OrderStatus.OutForDelivery:
      return 'bg-green-100 text-green-800';
    case OrderStatus.Completed:
      return 'bg-gray-100 text-gray-800';
    case OrderStatus.Cancelled:
      return 'bg-red-100 text-red-800';
    case OrderStatus.Disputed:
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

// Buyer Order Card (credit card purchases)
function BuyerOrderCard({ order }: { order: OrderWithMetadata }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            {resolveImageUrl(order.metadata.imageUrl) ? (
              <img
                src={resolveImageUrl(order.metadata.imageUrl)!}
                alt={order.metadata.produceName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                🌱
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">
                  {order.quantity.toString()}x {order.metadata.produceName}
                </h3>
                <p className="text-sm text-roots-gray">{order.metadata.sellerName}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                {OrderStatusLabels[order.status]}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <PriceDisplay amount={order.totalPrice} size="sm" />
              <span className="text-sm text-roots-gray">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Seller Order Card
function SellerOrderCard({ order }: { order: any }) {
  const status = order.status as OrderStatus;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-lg bg-roots-secondary/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            <span className="text-2xl">📦</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">
                  {order.quantity}x {order.produceName || 'Order'}
                </h3>
                <p className="text-sm text-roots-gray">
                  {order.isDelivery ? '🚗 Delivery' : '📍 Pickup'}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                {OrderStatusLabels[status]}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <PriceDisplay amount={BigInt(order.totalPrice)} size="sm" />
              <span className="text-sm text-roots-gray">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ambassador Order Card (referral orders)
function AmbassadorOrderCard({ order }: { order: any }) {
  const statusInfo = formatOrderStatus(order.status);
  const commission = calculateCommission(order.totalPrice);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-lg bg-purple-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
            <span className="text-2xl">🤝</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">Referral Order</h3>
                <p className="text-sm text-roots-gray">
                  From seller #{order.seller?.id || 'Unknown'}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-sm">
                <span className="text-roots-gray">Commission: </span>
                <span className="font-medium text-green-600">
                  {formatUnits(commission, 18)} ROOTS
                </span>
              </div>
              <span className="text-sm text-roots-gray">
                {formatDate(order.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UnifiedOrdersPage() {
  const { authenticated, login, ready } = usePrivy();

  // Role detection
  const { isSeller, sellerId, isLoading: sellerLoading } = useSellerStatus();
  const { isAmbassador, ambassadorId, isLoading: ambassadorLoading } = useAmbassadorStatus();

  // Orders data
  const { orders: buyerOrders, isLoading: buyerLoading } = useBuyerOrders();
  const { orders: sellerOrders, isLoading: sellerOrdersLoading } = useSellerOrders();
  const { data: ambassadorData, isLoading: ambassadorOrdersLoading } = useAmbassadorOrders(ambassadorId || undefined);

  // Determine available tabs based on roles
  const hasPurchases = buyerOrders.length > 0;
  const hasSales = isSeller && sellerOrders.length > 0;
  const hasReferrals = isAmbassador && (ambassadorData?.orders?.length || 0) > 0;

  // Available tabs
  const availableTabs: TabType[] = [];
  if (hasPurchases || !isSeller && !isAmbassador) availableTabs.push('purchases');
  if (isSeller) availableTabs.push('sales');
  if (isAmbassador) availableTabs.push('referrals');

  // Default to first available tab, or purchases
  const [activeTab, setActiveTab] = useState<TabType>('purchases');

  // Update active tab when roles are determined
  useEffect(() => {
    if (!sellerLoading && !ambassadorLoading) {
      if (isSeller && !hasPurchases) {
        setActiveTab('sales');
      } else if (isAmbassador && !hasPurchases && !isSeller) {
        setActiveTab('referrals');
      }
    }
  }, [sellerLoading, ambassadorLoading, isSeller, isAmbassador, hasPurchases]);

  const isLoading = !ready || sellerLoading || ambassadorLoading;

  // Not authenticated - show login prompt
  if (ready && !authenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Sign In to View Orders</h1>
        <p className="text-roots-gray mb-6">
          Login with your email to view your orders, sales, and referrals.
        </p>
        <Button
          onClick={login}
          className="bg-roots-primary hover:bg-roots-primary/90"
        >
          Login with Email
        </Button>
        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-roots-gray mb-3">
            Paid with crypto using an external wallet?
          </p>
          <Link href="/buy/orders">
            <Button variant="outline" size="sm">
              View Crypto Orders
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-heading font-bold mb-6">Your Orders</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Check if user has any orders at all
  const totalOrders = buyerOrders.length + sellerOrders.length + (ambassadorData?.orders?.length || 0);
  const hasAnyRole = isSeller || isAmbassador || hasPurchases;

  // No orders and no roles
  if (!hasAnyRole && totalOrders === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h1 className="text-2xl font-heading font-bold mb-2">No Orders Yet</h1>
        <p className="text-roots-gray mb-6">
          Start shopping or register as a seller to see orders here.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/buy">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Browse Listings
            </Button>
          </Link>
          <Link href="/sell/register">
            <Button variant="outline">
              Become a Seller
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Tab labels
  const tabLabels: Record<TabType, string> = {
    purchases: 'My Purchases',
    sales: 'My Sales',
    referrals: 'My Referrals',
  };

  // Count badges
  const tabCounts: Record<TabType, number> = {
    purchases: buyerOrders.length,
    sales: sellerOrders.length,
    referrals: ambassadorData?.orders?.length || 0,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold mb-6">Your Orders</h1>

      {/* Tabs - only show if multiple roles */}
      {availableTabs.length > 1 && (
        <div className="flex gap-2 mb-6 border-b overflow-x-auto pb-px">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-roots-primary text-roots-primary'
                  : 'border-transparent text-roots-gray hover:text-roots-primary'
              }`}
            >
              {tabLabels[tab]}
              {tabCounts[tab] > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Single role header */}
      {availableTabs.length === 1 && (
        <p className="text-roots-gray mb-4">
          {activeTab === 'purchases' && 'Orders you\'ve made with credit card'}
          {activeTab === 'sales' && 'Orders from your customers'}
          {activeTab === 'referrals' && 'Orders from sellers you recruited'}
        </p>
      )}

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Purchases Tab */}
        {activeTab === 'purchases' && (
          <>
            {buyerLoading ? (
              <div className="text-center py-8 text-roots-gray">Loading purchases...</div>
            ) : buyerOrders.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🛒</div>
                <p className="text-roots-gray mb-4">No purchases yet</p>
                <Link href="/buy">
                  <Button size="sm" className="bg-roots-primary">
                    Browse Listings
                  </Button>
                </Link>
              </div>
            ) : (
              buyerOrders.map((order) => (
                <BuyerOrderCard key={order.orderId.toString()} order={order} />
              ))
            )}
          </>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <>
            {sellerOrdersLoading ? (
              <div className="text-center py-8 text-roots-gray">Loading sales...</div>
            ) : sellerOrders.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-roots-gray mb-4">No sales yet</p>
                <Link href="/sell/dashboard">
                  <Button size="sm" variant="outline">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              sellerOrders.map((order) => (
                <SellerOrderCard key={order.orderId} order={order} />
              ))
            )}
          </>
        )}

        {/* Referrals Tab */}
        {activeTab === 'referrals' && (
          <>
            {ambassadorOrdersLoading ? (
              <div className="text-center py-8 text-roots-gray">Loading referrals...</div>
            ) : (ambassadorData?.orders?.length || 0) === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">🤝</div>
                <p className="text-roots-gray mb-4">No referral orders yet</p>
                <Link href="/ambassador/dashboard">
                  <Button size="sm" variant="outline">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              ambassadorData?.orders?.map((order: any) => (
                <AmbassadorOrderCard key={order.id} order={order} />
              ))
            )}
          </>
        )}
      </div>

      {/* Link to crypto orders */}
      <div className="mt-8 pt-6 border-t text-center">
        <p className="text-sm text-roots-gray mb-2">
          Looking for orders made with a crypto wallet?
        </p>
        <Link href="/buy/orders">
          <Button variant="outline" size="sm">
            View Crypto Orders
          </Button>
        </Link>
      </div>
    </div>
  );
}
