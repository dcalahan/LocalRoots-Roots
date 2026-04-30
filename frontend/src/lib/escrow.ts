/**
 * Escrow summary helpers for the seller side.
 *
 * Funds for every paid order live in the marketplace contract until release
 * (buyer Accepts → immediate release, OR 48h after seller's proof upload →
 * automatic release). Sellers don't see the dollar value of those held
 * funds anywhere except buried inside individual order cards. Doug,
 * Apr 30 2026: "the wallet page and probably somewhere on orders should
 * show some sort of Pending payments while the payment is still in the
 * escrow process."
 *
 * This module is the single source of truth for that aggregation. Both
 * /wallet (PendingEscrowCard) and /orders (sales tab summary) consume
 * `summarizeSellerEscrow`. Don't reimplement.
 */

import { rootsToFiat } from './pricing';
import { USDC_ADDRESS } from './contracts/marketplace';
import { OrderStatus, DISPUTE_WINDOW_SECONDS } from '@/types/order';
import type { SellerOrder } from '@/hooks/useSellerOrders';

export interface EscrowBucket {
  count: number;
  usd: number;
}

export interface EscrowSummary {
  /** Pending(0): buyer paid, seller hasn't accepted yet. Seller can decline. */
  pendingAcceptance: EscrowBucket;
  /** Accepted(1): seller accepted, hasn't fulfilled yet. */
  preparing: EscrowBucket;
  /**
   * ReadyForPickup(2) or OutForDelivery(3): seller fulfilled, dispute
   * window in progress. Funds release on buyer Accept or 48h auto.
   */
  awaitingConfirmation: EscrowBucket;
  /** Total across all three buckets. */
  total: EscrowBucket;
  /**
   * Earliest time any in-escrow order will auto-release (proofUploadedAt
   * + 48h). Null if no awaiting-confirmation orders have proof yet.
   */
  nextAutoReleaseAt: Date | null;
}

const EMPTY_BUCKET: EscrowBucket = { count: 0, usd: 0 };

/**
 * Convert an on-chain price (string of base units) plus its payment token
 * address to a USD float. Mirrors the math in `formatPrice` on the seller
 * dashboard — keep these two in sync.
 */
function priceToUsd(priceWei: string, paymentToken: string): number {
  let amount = BigInt(priceWei);
  if (paymentToken && paymentToken.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    // USDC base units (6 decimals) → ROOTS-equivalent base units (18 decimals).
    // 1 USDC = 100 ROOTS internally; ROOTS has 12 more decimals.
    amount = amount * 100n * 1_000_000_000_000n;
  }
  return rootsToFiat(amount);
}

export function summarizeSellerEscrow(orders: SellerOrder[]): EscrowSummary {
  const pendingAcceptance = { count: 0, usd: 0 };
  const preparing = { count: 0, usd: 0 };
  const awaitingConfirmation = { count: 0, usd: 0 };
  let nextAutoReleaseAt: Date | null = null;

  for (const order of orders) {
    // fundsReleased=true means the order is settled and not in escrow.
    if (order.fundsReleased) continue;

    const usd = priceToUsd(order.totalPrice, order.paymentToken);

    switch (order.status) {
      case OrderStatus.Pending:
        pendingAcceptance.count += 1;
        pendingAcceptance.usd += usd;
        break;
      case OrderStatus.Accepted:
        preparing.count += 1;
        preparing.usd += usd;
        break;
      case OrderStatus.ReadyForPickup:
      case OrderStatus.OutForDelivery: {
        awaitingConfirmation.count += 1;
        awaitingConfirmation.usd += usd;
        if (order.proofUploadedAt) {
          const releaseTime = new Date(
            order.proofUploadedAt.getTime() + DISPUTE_WINDOW_SECONDS * 1000,
          );
          if (!nextAutoReleaseAt || releaseTime < nextAutoReleaseAt) {
            nextAutoReleaseAt = releaseTime;
          }
        }
        break;
      }
      default:
        // Completed / Disputed / Refunded / Cancelled — not in escrow.
        break;
    }
  }

  const total: EscrowBucket = {
    count: pendingAcceptance.count + preparing.count + awaitingConfirmation.count,
    usd: pendingAcceptance.usd + preparing.usd + awaitingConfirmation.usd,
  };

  return {
    pendingAcceptance: pendingAcceptance.count > 0 ? pendingAcceptance : EMPTY_BUCKET,
    preparing: preparing.count > 0 ? preparing : EMPTY_BUCKET,
    awaitingConfirmation: awaitingConfirmation.count > 0 ? awaitingConfirmation : EMPTY_BUCKET,
    total,
    nextAutoReleaseAt,
  };
}

/**
 * Format the next auto-release time as a friendly relative string.
 * Returns null if `at` is null. Past dates render as "any moment now"
 * since the auto-claim hook should be picking those up.
 */
export function formatNextRelease(at: Date | null): string | null {
  if (!at) return null;
  const ms = at.getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const hours = Math.round(ms / (1000 * 60 * 60));
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(ms / (1000 * 60)));
    return `in ~${minutes} min`;
  }
  if (hours < 24) return `in ~${hours}h`;
  const days = Math.round(hours / 24);
  return `in ~${days}d`;
}
