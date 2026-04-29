'use client';

/**
 * useBuyerOrderUpdates — detect "interesting" status changes on the buyer's
 * orders since they last viewed them, for surfacing a notification banner.
 *
 * Returns the count of orders whose current on-chain status differs from
 * the last-seen value in localStorage AND represents a meaningful change
 * (Accepted, ReadyForPickup, OutForDelivery, Cancelled). Unsignificant
 * transitions like initial load (Pending → Pending) don't trigger.
 *
 * Use with `<OrderStatusBanner>` — call `markAllSeen` when the user clicks
 * through to dismiss the banner for the next render cycle.
 *
 * Doug, Apr 29 2026.
 */

import { useMemo } from 'react';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useBuyerOrders } from '@/hooks/useBuyerOrders';
import { OrderStatus } from '@/types/order';
import { getLastSeenStatus, markAllSeen } from '@/lib/orderBannerState';

const NOTIFY_STATUSES = new Set<number>([
  OrderStatus.Accepted,
  OrderStatus.ReadyForPickup,
  OrderStatus.OutForDelivery,
  OrderStatus.Cancelled,
]);

export function useBuyerOrderUpdates() {
  const { orders, isLoading } = useBuyerOrders();
  const { address: wagmiAddress } = useAccount();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
  const privyAddress = embeddedWallet?.address || user?.wallet?.address;
  const userId = (privyAddress || wagmiAddress)?.toLowerCase();

  const updates = useMemo(() => {
    if (!userId) return [];
    return orders.filter((o) => {
      const lastSeen = getLastSeenStatus(userId, o.orderId.toString());
      const isNoteworthy = NOTIFY_STATUSES.has(o.status);
      // Show banner if status changed AND new status is one we want to
      // surface. First-load (lastSeen undefined) shows ONLY if current
      // status is one of the notify statuses — we don't beep about the
      // historical record, just current actionable updates.
      return isNoteworthy && lastSeen !== o.status;
    });
  }, [orders, userId]);

  function dismiss() {
    markAllSeen(
      userId,
      orders.map((o) => ({
        orderId: o.orderId.toString(),
        status: o.status,
      }))
    );
  }

  return {
    isLoading,
    /** Total count of orders with unseen noteworthy status changes. */
    updateCount: updates.length,
    /** Most recent updated order (for the detail-page deep-link). */
    mostRecent: updates[0],
    /** Mark all current orders as seen at their current statuses. */
    dismiss,
  };
}
