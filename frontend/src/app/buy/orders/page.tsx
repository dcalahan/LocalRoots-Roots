'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';
import { useCompleteOrder } from '@/hooks/useOrderActions';
import { OrderStatus, OrderStatusLabels, canRaiseDispute, getDisputeTimeRemaining, formatTimeRemaining, type OrderWithMetadata } from '@/types/order';
import { getIpfsUrl } from '@/lib/pinata';
import { useToast } from '@/hooks/use-toast';
import { DisputeModal } from '@/components/order/DisputeModal';
import { BuyerWalletButton } from '@/components/BuyerWalletButton';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  return getIpfsUrl(imageRef);
}

function formatDate(timestamp: bigint): string {
  if (timestamp === 0n) return '';
  return new Date(Number(timestamp) * 1000).toLocaleDateString();
}

function getStatusColor(status: OrderStatus): string {
  switch (status) {
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

function getStatusDescription(order: OrderWithMetadata): { icon: string; text: string; color: string } {
  switch (order.status) {
    case OrderStatus.Pending:
      return { icon: '🕐', text: 'Waiting for seller to accept', color: 'text-yellow-700' };
    case OrderStatus.Accepted:
      return { icon: '📦', text: 'Seller is preparing your order', color: 'text-blue-700' };
    case OrderStatus.ReadyForPickup:
      return { icon: '✅', text: 'Ready for pickup - tap to accept', color: 'text-green-700' };
    case OrderStatus.OutForDelivery:
      return { icon: '🚗', text: 'Delivered - tap to accept', color: 'text-green-700' };
    case OrderStatus.Completed:
      return { icon: '✓', text: order.fundsReleased ? 'Complete - seller paid' : 'Complete', color: 'text-gray-600' };
    case OrderStatus.Disputed:
      return { icon: '⚠️', text: 'Under review', color: 'text-orange-700' };
    case OrderStatus.Refunded:
      return { icon: '↩️', text: 'Refunded to your wallet', color: 'text-gray-600' };
    case OrderStatus.Cancelled:
      return { icon: '✕', text: 'Cancelled', color: 'text-gray-600' };
    default:
      return { icon: '', text: '', color: 'text-gray-600' };
  }
}

// Order card component with accept functionality
function OrderCard({ order, onAccept, isAccepting, onDispute }: {
  order: OrderWithMetadata;
  onAccept?: (orderId: bigint) => void;
  isAccepting?: boolean;
  onDispute?: (order: OrderWithMetadata) => void;
}) {
  const needsAcceptance = order.status === OrderStatus.ReadyForPickup || order.status === OrderStatus.OutForDelivery;
  const statusDesc = getStatusDescription(order);
  const showDisputeLink = canRaiseDispute(order);
  const disputeTimeRemaining = getDisputeTimeRemaining(order);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <Link href={`/buy/orders/${order.orderId.toString()}`} className="flex-shrink-0">
            <div className="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden">
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
          </Link>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <Link href={`/buy/orders/${order.orderId.toString()}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">
                    {order.quantity.toString()}× {order.metadata.produceName}
                  </h3>
                  <p className="text-sm text-roots-gray">{order.metadata.sellerName}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                  {OrderStatusLabels[order.status]}
                </span>
              </div>

              {/* Status description */}
              <p className={`text-xs mt-1 ${statusDesc.color}`}>
                {statusDesc.icon} {statusDesc.text}
              </p>

              <div className="mt-2 flex items-center justify-between">
                <PriceDisplay amount={order.totalPrice} size="sm" />
                <span className="text-sm text-roots-gray">
                  {formatDate(order.createdAt)}
                </span>
              </div>
            </Link>

            {/* Action buttons */}
            <div className="mt-3 flex items-center gap-3">
              {/* Confirm receipt button for ready/delivered orders */}
              {needsAcceptance && onAccept && (
                <Button
                  size="sm"
                  className="bg-roots-primary hover:bg-roots-primary/90"
                  onClick={(e) => {
                    e.preventDefault();
                    onAccept(order.orderId);
                  }}
                  disabled={isAccepting}
                >
                  {isAccepting ? 'Confirming...' : order.status === OrderStatus.OutForDelivery ? 'Confirm Delivery Received' : 'Confirm Pickup Received'}
                </Button>
              )}

              {/* Dispute link - shown when within 48-hour window */}
              {showDisputeLink && onDispute && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onDispute(order);
                  }}
                  className="text-xs text-red-600 hover:text-red-800 hover:underline"
                >
                  Report an issue ({formatTimeRemaining(disputeTimeRemaining)} left)
                </button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const { orders, isLoading, error, refetch, isConnected } = useBuyerOrders();
  const { completeOrder, isCompleting, isSuccess, error: completeError, reset } = useCompleteOrder();
  const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<OrderWithMetadata | null>(null);
  const { toast } = useToast();

  const handleDispute = (order: OrderWithMetadata) => {
    setDisputeOrder(order);
  };

  const handleDisputeSuccess = () => {
    setDisputeOrder(null);
    toast({
      title: 'Dispute submitted',
      description: 'Our team will review your case and get back to you.',
    });
    refetch();
  };

  // Handle success
  useEffect(() => {
    if (isSuccess && acceptingOrderId) {
      toast({
        title: 'Order confirmed!',
        description: 'Thank you for confirming receipt. The seller will receive payment after the dispute window.',
      });
      setAcceptingOrderId(null);
      reset();
      // Small delay to ensure blockchain state is updated before refetch
      setTimeout(() => {
        refetch();
      }, 1000);
    }
  }, [isSuccess, acceptingOrderId, toast, reset, refetch]);

  // Handle errors
  useEffect(() => {
    if (completeError && acceptingOrderId) {
      const isStaleData = completeError.includes('FailedCall') || completeError.includes('Invalid');
      toast({
        title: isStaleData ? 'Order already confirmed' : 'Failed to confirm order',
        description: isStaleData ? 'This order may have already been confirmed. Refreshing...' : completeError,
        variant: 'destructive',
      });
      if (isStaleData) {
        reset();
        setAcceptingOrderId(null);
        refetch();
      }
    }
  }, [completeError, acceptingOrderId, toast, reset, refetch]);

  // Split orders into current (waiting) and past (ready to accept or done)
  const currentOrders = orders.filter(o =>
    o.status === OrderStatus.Pending || o.status === OrderStatus.Accepted
  );
  const pastOrders = orders.filter(o =>
    o.status !== OrderStatus.Pending && o.status !== OrderStatus.Accepted
  );

  const handleAcceptOrder = async (orderId: bigint) => {
    setAcceptingOrderId(orderId.toString());
    const success = await completeOrder(orderId);
    if (success) {
      toast({
        title: 'Order confirmed!',
        description: 'Thank you for confirming receipt. The seller will receive payment after the dispute window.',
      });
      setAcceptingOrderId(null);
      setTimeout(() => refetch(), 1000);
    } else {
      setAcceptingOrderId(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">🔗</div>
        <h1 className="text-2xl font-heading font-bold mb-2">Connect Your Wallet</h1>
        <p className="text-roots-gray mb-4">
          Connect your wallet to view your orders
        </p>
        <BuyerWalletButton />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-heading font-bold mb-6">Your Orders</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-roots-gray mb-4">{error}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h1 className="text-2xl font-heading font-bold mb-2">No orders yet</h1>
        <p className="text-roots-gray mb-6">
          Start shopping to see your orders here
        </p>
        <Link href="/buy">
          <Button className="bg-roots-primary">Browse Listings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-heading font-bold mb-6">Your Orders</h1>

      {/* Current Orders */}
      {currentOrders.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-roots-gray mb-3">Current Orders</h2>
          <div className="space-y-4">
            {currentOrders.map((order) => (
              <OrderCard
                key={order.orderId.toString()}
                order={order}
                onDispute={handleDispute}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Orders */}
      {pastOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-roots-gray mb-3">Past Orders</h2>
          <div className="space-y-4">
            {pastOrders.map((order) => (
              <OrderCard
                key={order.orderId.toString()}
                order={order}
                onAccept={handleAcceptOrder}
                isAccepting={isCompleting && acceptingOrderId === order.orderId.toString()}
                onDispute={handleDispute}
              />
            ))}
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeOrder && (
        <DisputeModal
          orderId={disputeOrder.orderId}
          productName={disputeOrder.metadata.produceName}
          onClose={() => setDisputeOrder(null)}
          onSuccess={handleDisputeSuccess}
        />
      )}
    </div>
  );
}
