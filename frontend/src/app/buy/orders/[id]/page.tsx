'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriceSummary } from '@/components/ui/PriceDisplay';
import { useOrderDetail } from '@/hooks/useBuyerOrders';
import { useCompleteOrder, useRaiseDispute } from '@/hooks/useOrderActions';
import { OrderStatus, OrderStatusLabels, canRaiseDispute, getDisputeTimeRemaining, DISPUTE_WINDOW_SECONDS } from '@/types/order';
import { useAccount, useSignMessage } from 'wagmi';
import { getIpfsUrl } from '@/lib/pinata';
import { fetchPickupForOrder } from '@/lib/sellerPickup';

// Helper to convert image reference to displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  return getIpfsUrl(imageRef);
}

function formatDate(timestamp: bigint): string {
  if (timestamp === 0n) return 'N/A';
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

const statusSteps = [
  { status: OrderStatus.Pending, label: 'Order Placed' },
  { status: OrderStatus.Accepted, label: 'Preparing' },
  { status: OrderStatus.ReadyForPickup, label: 'Ready', altStatus: OrderStatus.OutForDelivery, altLabel: 'Delivered' },
  { status: OrderStatus.Completed, label: 'Completed' },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const { isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { order, isLoading, error } = useOrderDetail(orderId);
  const { completeOrder, isCompleting, isSuccess: completeSuccess } = useCompleteOrder();
  const { raiseDispute, isDisputing, isSuccess: disputeSuccess } = useRaiseDispute();

  // Pickup-info reveal state. Server only releases the seller's exact
  // address after the buyer signs a per-order message AND the order is
  // accepted/in-progress. Triggered by user click — don't auto-fetch on
  // mount because each fetch needs a fresh wallet signature.
  const [pickup, setPickup] = useState<{ address: string; phone?: string } | null>(null);
  const [pickupError, setPickupError] = useState<string | null>(null);
  const [pickupLoading, setPickupLoading] = useState(false);

  const handleRevealPickup = async () => {
    setPickupLoading(true);
    setPickupError(null);
    const result = await fetchPickupForOrder({
      orderId,
      signMessage: (msg) => signMessageAsync({ message: msg }) as Promise<`0x${string}`>,
    });
    setPickupLoading(false);
    if (result.ok) {
      setPickup({ address: result.address, phone: result.phone });
    } else {
      setPickupError(result.error);
    }
  };

  // Refresh page when actions complete
  useEffect(() => {
    if (completeSuccess || disputeSuccess) {
      router.refresh();
    }
  }, [completeSuccess, disputeSuccess, router]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-roots-gray">Connect your wallet to view order details</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h1 className="text-xl font-semibold mb-2">Order not found</h1>
        <p className="text-roots-gray mb-4">{error}</p>
        <Link href="/buy/orders">
          <Button>Back to Orders</Button>
        </Link>
      </div>
    );
  }

  const disputeRemaining = getDisputeTimeRemaining(order);
  const canDisputeOrder = canRaiseDispute(order);

  const handleRaiseDispute = async () => {
    await raiseDispute(BigInt(orderId));
  };

  const handleCompleteOrder = async () => {
    await completeOrder(BigInt(orderId));
  };

  const currentStepIndex = statusSteps.findIndex(
    (s) => s.status === order.status || s.altStatus === order.status
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-roots-gray mb-6">
        <Link href="/buy/orders" className="hover:text-roots-primary">Orders</Link>
        {' / '}
        <span>Order #{orderId}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Order #{orderId}</h1>
          <p className="text-roots-gray">{formatDate(order.createdAt)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === OrderStatus.Disputed ? 'bg-orange-100 text-orange-800' :
          order.status === OrderStatus.Completed ? 'bg-green-100 text-green-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {OrderStatusLabels[order.status]}
        </span>
      </div>

      {/* Progress timeline */}
      {order.status !== OrderStatus.Cancelled && order.status !== OrderStatus.Disputed && (
        <Card className="mb-6">
          <CardContent className="py-6">
            <div className="flex justify-between relative">
              {/* Progress line */}
              <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200" />
              <div
                className="absolute top-4 left-0 h-0.5 bg-roots-primary transition-all"
                style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
              />

              {statusSteps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                // Use altLabel for delivery orders at the "Ready" step
                const label = order.isDelivery && step.altStatus === OrderStatus.OutForDelivery
                  ? step.altLabel || step.label
                  : step.label;

                return (
                  <div key={step.status} className="flex flex-col items-center relative z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-roots-primary text-white' : 'bg-gray-200 text-gray-500'
                    } ${isCurrent ? 'ring-4 ring-roots-primary/20' : ''}`}>
                      {isActive ? '✓' : index + 1}
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'text-roots-primary font-medium' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product */}
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden">
              {resolveImageUrl(order.metadata.imageUrl) ? (
                <img
                  src={resolveImageUrl(order.metadata.imageUrl)!}
                  alt={order.metadata.produceName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🌱</div>
              )}
            </div>
            <div>
              <h3 className="font-medium">{order.metadata.produceName}</h3>
              <p className="text-sm text-roots-gray">{order.metadata.sellerName}</p>
              <p className="text-sm">Quantity: {order.quantity.toString()} {order.metadata.unit}s</p>
            </div>
          </div>

          {/* Fulfillment */}
          <div className="pt-4 border-t">
            <p className="text-sm">
              <span className="text-roots-gray">Fulfillment:</span>{' '}
              <span className="font-medium">{order.isDelivery ? 'Delivery' : 'Pickup'}</span>
            </p>
            {!order.isDelivery && (
              <div className="mt-3">
                {pickup ? (
                  // Address revealed — show + Maps/Waze deep links so buyer
                  // can navigate without retyping
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-1">Pickup Location:</p>
                    <p className="text-sm text-blue-700 mb-2">{pickup.address}</p>
                    {pickup.phone && (
                      <p className="text-xs text-blue-700 mb-2">
                        Seller phone: <a href={`tel:${pickup.phone}`} className="underline">{pickup.phone}</a>
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700"
                      >
                        Open in Google Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?q=${encodeURIComponent(pickup.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700"
                      >
                        Open in Waze
                      </a>
                    </div>
                  </div>
                ) : order.status >= OrderStatus.Accepted &&
                    order.status !== OrderStatus.Cancelled &&
                    order.status !== OrderStatus.Refunded ? (
                  // Order accepted by seller — buyer can reveal address now
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-1">Pickup Location</p>
                    <p className="text-xs text-blue-700 mb-2">
                      Sign with your wallet to reveal the seller&apos;s address — only sent to confirmed buyers like you.
                    </p>
                    <Button
                      onClick={handleRevealPickup}
                      disabled={pickupLoading}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {pickupLoading ? 'Verifying...' : 'Show pickup address'}
                    </Button>
                    {pickupError && (
                      <p className="text-xs text-red-600 mt-2">{pickupError}</p>
                    )}
                  </div>
                ) : (
                  // Pending — seller hasn't accepted yet
                  <p className="text-xs text-roots-gray mt-1">
                    Pickup details unlock once the seller accepts your order.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Proof photo */}
          {order.proofIpfs && (
            <div className="pt-4 border-t">
              <p className="text-sm text-roots-gray mb-2">Seller&apos;s Proof Photo:</p>
              <img
                src={resolveImageUrl(order.proofIpfs) || ''}
                alt="Delivery proof"
                className="rounded-lg max-h-48 object-cover"
              />
              <p className="text-xs text-roots-gray mt-1">
                Uploaded: {formatDate(order.proofUploadedAt)}
              </p>
            </div>
          )}

          {/* Order Status Card - Shows for all states */}
          <div className="pt-4 border-t">
            {/* Pending - Waiting for seller to accept */}
            {order.status === OrderStatus.Pending && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-800 flex items-center gap-2">
                  🕐 Waiting for Seller
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  The seller has been notified and will accept your order soon.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Your payment is held securely in escrow until the order is fulfilled.
                </p>
              </div>
            )}

            {/* Accepted - Seller is preparing */}
            {order.status === OrderStatus.Accepted && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm font-medium text-purple-800 flex items-center gap-2">
                  📦 Seller Preparing Order
                </p>
                <p className="text-xs text-purple-700 mt-1">
                  The seller has accepted your order and is preparing it for {order.isDelivery ? 'delivery' : 'pickup'}.
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  You&apos;ll be notified when it&apos;s ready.
                </p>
              </div>
            )}

            {/* Ready/Delivered - Awaiting buyer confirmation */}
            {(order.status === OrderStatus.ReadyForPickup || order.status === OrderStatus.OutForDelivery) && !order.fundsReleased && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  ⏳ {order.status === OrderStatus.ReadyForPickup ? 'Ready for Pickup' : 'Delivered'} - Payment Pending
                </p>
                {order.proofUploadedAt > 0n ? (
                  <>
                    <p className="text-xs text-amber-700 mt-1">
                      Funds will be transferred to the seller on{' '}
                      <strong>
                        {new Date(Number(order.proofUploadedAt) * 1000 + DISPUTE_WINDOW_SECONDS * 1000).toLocaleString()}
                      </strong>
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      Accept the order below, or report an issue before this time if there&apos;s a problem.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-700 mt-1">
                    The seller is finalizing this order.
                  </p>
                )}
              </div>
            )}

            {/* Completed with funds released */}
            {order.status === OrderStatus.Completed && order.fundsReleased && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                  ✓ Order Complete
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Payment has been released to the seller. Thank you for shopping local!
                </p>
              </div>
            )}

            {/* Completed but funds not yet released */}
            {order.status === OrderStatus.Completed && !order.fundsReleased && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                  ✓ Order Accepted
                </p>
                <p className="text-xs text-green-700 mt-1">
                  You&apos;ve confirmed receipt. Payment will be released to the seller shortly.
                </p>
              </div>
            )}

            {/* Disputed */}
            {order.status === OrderStatus.Disputed && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                  ⚠️ Dispute Raised
                </p>
                <p className="text-xs text-red-700 mt-1">
                  This order is under review. Funds are held until the dispute is resolved.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Our team will contact you to help resolve this issue.
                </p>
              </div>
            )}

            {/* Refunded */}
            {order.status === OrderStatus.Refunded && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  ↩️ Refunded
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  This order has been refunded. The funds have been returned to your wallet.
                </p>
              </div>
            )}

            {/* Cancelled */}
            {order.status === OrderStatus.Cancelled && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  ✕ Cancelled
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  This order was cancelled. Any funds held have been returned to your wallet.
                </p>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="pt-4 border-t">
            <PriceSummary label="Total Paid" amount={order.totalPrice} />
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-3">
        {(order.status === OrderStatus.ReadyForPickup || order.status === OrderStatus.OutForDelivery) && (
          <Button
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
            onClick={handleCompleteOrder}
            disabled={isCompleting}
          >
            {isCompleting ? 'Accepting...' : 'Accept Order'}
          </Button>
        )}

        <Link href="/buy/orders" className="block">
          <Button variant="outline" className="w-full">
            Back to Orders
          </Button>
        </Link>

        {/* Subtle dispute option - only in past orders that are still in window */}
        {canDisputeOrder && (
          <div className="pt-4 border-t text-center">
            <p className="text-xs text-roots-gray mb-2">
              Issue with your order? You have {formatTimeRemaining(disputeRemaining)} to report a problem.
            </p>
            <button
              className="text-xs text-red-500 hover:text-red-700 underline"
              onClick={handleRaiseDispute}
              disabled={isDisputing}
            >
              {isDisputing ? 'Raising Dispute...' : 'Raise a Dispute'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
