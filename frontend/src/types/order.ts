export enum OrderStatus {
  Pending = 0,
  Accepted = 1,
  ReadyForPickup = 2,
  OutForDelivery = 3,
  Completed = 4,
  Disputed = 5,
  Refunded = 6,
  Cancelled = 7,
}

export const OrderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'Pending',
  [OrderStatus.Accepted]: 'Preparing',
  [OrderStatus.ReadyForPickup]: 'Ready for Pickup',
  [OrderStatus.OutForDelivery]: 'Delivered',
  [OrderStatus.Completed]: 'Completed',
  [OrderStatus.Disputed]: 'Disputed',
  [OrderStatus.Refunded]: 'Refunded',
  [OrderStatus.Cancelled]: 'Cancelled',
};

export interface Order {
  orderId: bigint;
  listingId: bigint;
  sellerId: bigint;
  buyer: `0x${string}`;
  quantity: bigint;
  totalPrice: bigint;
  isDelivery: boolean;
  status: OrderStatus;
  createdAt: bigint;
  completedAt: bigint;
  rewardQueued: boolean;
  proofIpfs: string;
  proofUploadedAt: bigint;
  fundsReleased: boolean;
}

export interface OrderWithMetadata extends Order {
  metadata: {
    produceName: string;
    imageUrl: string | null;
    sellerName: string;
    unit: string;
    sellerPickupAddress?: string; // Address for pickup orders
  };
}

// Dispute window is 48 hours (in seconds)
export const DISPUTE_WINDOW_SECONDS = 48 * 60 * 60;

export function canRaiseDispute(order: Order): boolean {
  // Can dispute if proof uploaded and within 48 hour window
  if (order.proofUploadedAt === 0n) return false;
  if (order.status === OrderStatus.Disputed) return false;
  if (order.status === OrderStatus.Cancelled) return false;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const disputeDeadline = order.proofUploadedAt + BigInt(DISPUTE_WINDOW_SECONDS);

  return now < disputeDeadline;
}

export function getDisputeTimeRemaining(order: Order): number {
  if (order.proofUploadedAt === 0n) return 0;

  const now = Math.floor(Date.now() / 1000);
  const disputeDeadline = Number(order.proofUploadedAt) + DISPUTE_WINDOW_SECONDS;

  return Math.max(0, disputeDeadline - now);
}
