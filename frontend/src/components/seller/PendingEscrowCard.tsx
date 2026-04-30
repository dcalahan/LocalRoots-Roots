'use client';

/**
 * PendingEscrowCard — surfaces the dollar value of a seller's funds
 * currently held in marketplace escrow. Shown on /wallet (above the
 * token balances) and on /orders (above the Sales tab list).
 *
 * Doug, Apr 30 2026: "the wallet page and probably somewhere on orders
 * should show some sort of Pending payments while the payment is still
 * in the escrow process."
 *
 * Renders nothing if the seller has no in-escrow orders — silent in
 * steady state, present and informative when it matters.
 *
 * Uses `summarizeSellerEscrow` from `lib/escrow.ts` — that's the single
 * source of truth for the aggregation. Don't duplicate the math here.
 */

import Link from 'next/link';
import { useSellerOrders } from '@/hooks/useSellerOrders';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { summarizeSellerEscrow, formatNextRelease } from '@/lib/escrow';
import { formatFiat } from '@/lib/pricing';

interface PendingEscrowCardProps {
  /** Set true when this is the first thing on the page (e.g. /wallet)
   *  to bump up the visual weight slightly. */
  emphasize?: boolean;
  /** Hide the "View orders →" CTA — useful when the card sits on the
   *  /orders page itself and the link would be redundant. */
  hideOrdersLink?: boolean;
}

export function PendingEscrowCard({ emphasize, hideOrdersLink }: PendingEscrowCardProps) {
  const { isSeller } = useSellerStatus();
  const { orders, isLoading } = useSellerOrders();

  // Render nothing for non-sellers, while loading, or when there's
  // genuinely nothing in escrow. The card should be invisible when it
  // has nothing to say.
  if (!isSeller || isLoading) return null;

  const summary = summarizeSellerEscrow(orders);
  if (summary.total.count === 0) return null;

  const nextRelease = formatNextRelease(summary.nextAutoReleaseAt);

  // Headline copy adapts to what's actually pending. We lead with the
  // most-actionable bucket so the seller knows what to do.
  let headline = 'You have funds in escrow';
  if (summary.pendingAcceptance.count > 0) {
    headline = summary.pendingAcceptance.count === 1
      ? '1 order needs your acceptance'
      : `${summary.pendingAcceptance.count} orders need your acceptance`;
  } else if (summary.preparing.count > 0) {
    headline = summary.preparing.count === 1
      ? '1 order to fulfill'
      : `${summary.preparing.count} orders to fulfill`;
  }

  return (
    <div className={`rounded-lg border bg-amber-50 border-amber-200 ${emphasize ? 'p-5 mb-6' : 'p-4 mb-4'}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">💰</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-amber-900">{headline}</h3>
            <div className="text-right">
              <div className={`font-bold text-amber-900 ${emphasize ? 'text-2xl' : 'text-lg'}`}>
                {formatFiat(summary.total.usd)}
              </div>
              <div className="text-xs text-amber-800">
                {summary.total.count} {summary.total.count === 1 ? 'order' : 'orders'} in escrow
              </div>
            </div>
          </div>

          {/* Per-bucket breakdown — only show buckets that have anything in them.
              Plain text, comma-separated, so it stays compact. */}
          <p className="text-sm text-amber-800 mt-2">
            {[
              summary.pendingAcceptance.count > 0 && `${summary.pendingAcceptance.count} awaiting acceptance (${formatFiat(summary.pendingAcceptance.usd)})`,
              summary.preparing.count > 0 && `${summary.preparing.count} preparing (${formatFiat(summary.preparing.usd)})`,
              summary.awaitingConfirmation.count > 0 && `${summary.awaitingConfirmation.count} awaiting buyer confirmation (${formatFiat(summary.awaitingConfirmation.usd)})`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {/* Next-release hint — only when at least one fulfilled order is
              counting down. Helps the seller know when to expect the money. */}
          {nextRelease && (
            <p className="text-xs text-amber-700 mt-1.5">
              Next auto-release {nextRelease} (sooner if buyer confirms).
            </p>
          )}

          {!hideOrdersLink && (
            <div className="mt-3">
              <Link
                href="/orders?tab=sales"
                className="text-sm font-medium text-amber-900 hover:text-amber-700 underline decoration-dotted underline-offset-2"
              >
                View orders →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
