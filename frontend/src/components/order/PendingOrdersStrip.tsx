'use client';

/**
 * PendingOrdersStrip — full-width alert strip for action-required order
 * states. Visually matches EarlyAdopterBanner's prominence (full-width
 * gradient bar across the top of the page) so sellers/ambassadors can't
 * miss it.
 *
 * Usage: drop directly below <EarlyAdopterBanner /> at the top of a page,
 * outside the page's max-w container. The strip handles its own width +
 * centering internally.
 *
 * Two color variants:
 *   - "seller-pending"  — coral gradient. Action required (you have orders waiting).
 *   - "buyer-update"    — teal gradient. Informational (your order changed status).
 *
 * Doug, Apr 29 2026 — "Just like the 'We just went live'. Maybe right below it."
 */

import Link from 'next/link';

interface PendingOrdersStripProps {
  variant: 'seller-pending' | 'buyer-update';
  message: string;
  detail?: string;
  href?: string;
  onClick?: () => void;
  ctaLabel?: string;
}

export function PendingOrdersStrip({
  variant,
  message,
  detail,
  href,
  onClick,
  ctaLabel = 'View',
}: PendingOrdersStripProps) {
  const gradient =
    variant === 'seller-pending'
      ? 'bg-gradient-to-r from-roots-primary to-orange-500'
      : 'bg-gradient-to-r from-roots-secondary to-teal-500';

  const icon = variant === 'seller-pending' ? '🔔' : '✉️';

  const cta = (
    <button
      type="button"
      onClick={onClick}
      className="bg-white text-gray-900 hover:bg-white/90 px-4 py-1.5 rounded-md font-bold text-sm whitespace-nowrap shadow-sm"
    >
      {ctaLabel} →
    </button>
  );

  return (
    <div className={`${gradient} text-white py-3 px-4`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-sm md:text-base flex-wrap">
        <span className="text-xl" aria-hidden>
          {icon}
        </span>
        <span className="font-bold">{message}</span>
        {detail && <span className="opacity-90 hidden md:inline">— {detail}</span>}
        {href ? <Link href={href}>{cta}</Link> : cta}
      </div>
    </div>
  );
}
