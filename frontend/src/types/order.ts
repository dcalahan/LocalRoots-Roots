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

// Get the date/time when funds will be releasable
export function getFundsReleaseDate(order: Order): Date | null {
  if (order.proofUploadedAt === 0n) return null;
  const releaseTimestamp = Number(order.proofUploadedAt) + DISPUTE_WINDOW_SECONDS;
  return new Date(releaseTimestamp * 1000);
}

// Check if seller can claim funds now
export function canClaimFunds(order: Order): boolean {
  if (order.fundsReleased) return false;
  if (order.proofUploadedAt === 0n) return false;
  if (order.status === OrderStatus.Disputed) return false;
  if (order.status === OrderStatus.Cancelled) return false;
  if (order.status === OrderStatus.Refunded) return false;

  const now = Math.floor(Date.now() / 1000);
  const releaseTime = Number(order.proofUploadedAt) + DISPUTE_WINDOW_SECONDS;

  return now >= releaseTime;
}

// Get remaining time until funds can be claimed (in seconds)
export function getTimeUntilFundsRelease(order: Order): number {
  if (order.fundsReleased) return 0;
  if (order.proofUploadedAt === 0n) return 0;

  const now = Math.floor(Date.now() / 1000);
  const releaseTime = Number(order.proofUploadedAt) + DISPUTE_WINDOW_SECONDS;

  return Math.max(0, releaseTime - now);
}

// Format remaining time as human readable string
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Now';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
