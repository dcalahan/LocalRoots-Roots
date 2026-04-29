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
  /**
   * Visual prominence:
   * - `alert`  — eyepopping coral fill + white text + larger padding.
   *              Use for action-required (seller has pending orders waiting).
   * - `action` — coral-tinted background + coral text. Subtle but noticeable.
   * - `info`   — teal-tinted background + teal text. For passive notifications
   *              (buyer order status changed, ambassador recruit activity).
   */
  tone: 'alert' | 'action' | 'info';
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
  // Visual treatment per tone.
  //   alert: full coral background, white text, generous padding, icon —
  //          built to demand attention. Use sparingly: action-required only.
  //   action: subtle coral tint. Suggests-not-demands.
  //   info:   subtle teal tint. Passive notification.
  const isAlert = tone === 'alert';
  const accent = isAlert
    ? 'bg-roots-primary text-white border-0 shadow-md'
    : tone === 'action'
      ? 'bg-roots-primary/10 border-roots-primary/30 text-roots-primary'
      : 'bg-roots-secondary/10 border-roots-secondary/30 text-roots-secondary';

  const button = isAlert
    ? 'bg-white text-roots-primary hover:bg-white/90'
    : tone === 'action'
      ? 'bg-roots-primary hover:bg-roots-primary/90 text-white'
      : 'bg-roots-secondary hover:bg-roots-secondary/90 text-white';

  const padding = isAlert ? 'px-5 py-4' : 'px-4 py-3';
  const messageSize = isAlert ? 'text-base font-bold' : 'text-sm font-semibold';
  const detailSize = isAlert ? 'text-sm mt-1' : 'text-xs mt-0.5 opacity-80';
  const ctaSize = isAlert
    ? 'text-sm px-4 py-2 rounded-md font-bold whitespace-nowrap'
    : 'text-xs px-3 py-1.5 rounded-md font-medium';

  const cta = (
    <button
      type="button"
      onClick={onClick}
      className={`${ctaSize} ${button}`}
    >
      {ctaLabel}
    </button>
  );

  return (
    <div
      className={`flex items-center gap-3 border rounded-lg mb-4 ${accent} ${padding}`}
      role="status"
    >
      {isAlert && (
        <div className="text-2xl flex-shrink-0" aria-hidden>
          🔔
        </div>
      )}
      <div className="flex-1">
        <p className={`leading-tight ${messageSize}`}>{message}</p>
        {detail && <p className={detailSize}>{detail}</p>}
      </div>
      {href ? <Link href={href}>{cta}</Link> : cta}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={`${isAlert ? 'opacity-80 hover:opacity-100' : 'opacity-50 hover:opacity-100'} transition-opacity p-1`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
