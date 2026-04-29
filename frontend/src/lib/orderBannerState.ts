/**
 * localStorage-backed "last seen status" tracking for order-state banners.
 *
 * The order-status-banner pattern (seller pending notifications, buyer
 * accept/cancel notifications, ambassador recruit-activity notifications)
 * needs to know which orders the user has already acknowledged so banners
 * don't keep firing forever. The simplest workable persistence is per-
 * device localStorage — no server round-trip, no auth, immediate.
 *
 * Storage layout:
 *   `orders:seen:{userId}` → JSON map of { [orderId]: lastSeenStatus }
 *
 * Where:
 *   - `userId` is a stable identifier for the viewer. We use the wallet
 *     address (lower-cased) for buyers/sellers/ambassadors. Privy users
 *     and external-wallet users both have a wallet address.
 *   - `orderId` is the on-chain order ID as a string.
 *   - `lastSeenStatus` is the OrderStatus enum value (number) when the
 *     user last viewed/acknowledged this order.
 *
 * The banner shows when current on-chain status differs from lastSeen.
 * Calling `markSeen` updates lastSeen to current, dismissing the banner
 * for that order until its status changes again.
 *
 * Doug, Apr 29 2026.
 */

const STORAGE_PREFIX = 'orders:seen:';

type SeenMap = Record<string, number>;

function key(userId: string): string {
  return `${STORAGE_PREFIX}${userId.toLowerCase()}`;
}

function readMap(userId: string): SeenMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(userId: string, map: SeenMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(map));
  } catch {
    // localStorage quota / disabled — non-fatal; banner will just keep
    // showing until the issue clears.
  }
}

/** Get the last-seen status for a given order, or undefined if never viewed. */
export function getLastSeenStatus(
  userId: string | undefined | null,
  orderId: string | bigint
): number | undefined {
  if (!userId) return undefined;
  const map = readMap(userId);
  return map[orderId.toString()];
}

/**
 * Update the last-seen status for an order. Call this when the user has
 * actively viewed the order (e.g. clicked through to its detail page) or
 * dismissed the banner.
 */
export function markSeen(
  userId: string | undefined | null,
  orderId: string | bigint,
  currentStatus: number
): void {
  if (!userId) return;
  const map = readMap(userId);
  map[orderId.toString()] = currentStatus;
  writeMap(userId, map);
}

/** Bulk-mark a list of orders as seen at their current statuses. */
export function markAllSeen(
  userId: string | undefined | null,
  orders: Array<{ orderId: string | bigint; status: number }>
): void {
  if (!userId) return;
  const map = readMap(userId);
  for (const o of orders) {
    map[o.orderId.toString()] = o.status;
  }
  writeMap(userId, map);
}

/**
 * For a list of orders, return the ones whose status differs from the
 * last-seen value (i.e., should trigger a banner). Orders the user has
 * never viewed return as "new" (lastSeen undefined). Callers can filter
 * further (e.g. only highlight Accepted/Cancelled transitions).
 */
export function getUnseenChanges<
  T extends { orderId: string | bigint; status: number }
>(userId: string | undefined | null, orders: T[]): T[] {
  if (!userId) return [];
  const map = readMap(userId);
  return orders.filter((o) => {
    const last = map[o.orderId.toString()];
    return last === undefined || last !== o.status;
  });
}
