'use client';

/**
 * OrderStatusBanner — surfaces order-state changes prominently above the
 * dashboard the user is currently viewing. Three role variants:
 *
 *   - "seller" — "You have N pending orders" → click → seller dashboard orders tab
 *   - "buyer"  — "Order #N has been accepted/cancelled" → click → /orders
 *   - "ambassador" — "Your recruits have N new pending orders" → click → ambassador dashboard
 *
 * State tracking: lib/orderBannerState.ts (localStorage). User dismisses
 * banner via the close button OR by clicking through (which marks seen).
 *
 * Doug, Apr 29 2026.
 */

import Link from 'next/link';

interface OrderStatusBannerProps {
  /** Coral (seller/ambassador action) or teal (buyer info) accent. */
  tone: 'action' | 'info';
  /** Headline shown left-aligned. Keep short. */
  message: string;
  /** Optional sub-line for context. */
  detail?: string;
  /** Where clicking the CTA navigates. Use `href` OR `onClick`, not both. */
  href?: string;
  /** Run on CTA click instead of navigating (e.g. switch tabs in-page). */
  onClick?: () => void;
  /** Label of the CTA button. Defaults to "View". */
  ctaLabel?: string;
  /** Called when the user dismisses the banner via the X button. */
  onDismiss?: () => void;
}

export function OrderStatusBanner({
  tone,
  message,
  detail,
  href,
  onClick,
  ctaLabel = 'View',
  onDismiss,
}: OrderStatusBannerProps) {
  const accent =
    tone === 'action'
      ? 'bg-roots-primary/10 border-roots-primary/30 text-roots-primary'
      : 'bg-roots-secondary/10 border-roots-secondary/30 text-roots-secondary';

  const button =
    tone === 'action'
      ? 'bg-roots-primary hover:bg-roots-primary/90 text-white'
      : 'bg-roots-secondary hover:bg-roots-secondary/90 text-white';

  const cta = (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md font-medium ${button}`}
    >
      {ctaLabel}
    </button>
  );

  return (
    <div
      className={`flex items-center gap-3 border rounded-lg px-4 py-3 mb-4 ${accent}`}
      role="status"
    >
      <div className="flex-1">
        <p className="text-sm font-semibold leading-tight">{message}</p>
        {detail && <p className="text-xs mt-0.5 opacity-80">{detail}</p>}
      </div>
      {href ? <Link href={href}>{cta}</Link> : cta}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="opacity-50 hover:opacity-100 transition-opacity p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
