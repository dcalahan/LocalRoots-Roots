'use client';

import { useState, useEffect } from 'react';
import { formatPricesWithFiat, detectUserCurrency, type SupportedCurrency } from '@/lib/pricing';
import { USDC_ADDRESS } from '@/lib/contracts/marketplace';

/**
 * Normalize an order/listing amount into ROOTS-equivalent base units (18
 * decimals) for the standard formatters. If `paymentToken` indicates the
 * amount is in USDC base units (6 decimals), convert it; otherwise return
 * as-is. Without this, USDC-paid orders display as "<$0.01" because the
 * formatters divide by 10^12 too many times. Doug, Apr 29 2026.
 */
function normalizeToRootsUnits(amount: bigint, paymentToken?: string): bigint {
  if (paymentToken && paymentToken.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    // USDC base units (6 decimals) → ROOTS base units (18 decimals).
    // 1 USDC = 100 ROOTS internally; ROOTS has 12 more decimals than USDC,
    // so multiply by 100 × 10^12 = 10^14.
    return amount * 100n * 1_000_000_000_000n;
  }
  return amount;
}

interface PriceDisplayProps {
  amount: bigint;
  /** Optional payment-token address. If USDC, `amount` is treated as 6-decimal base units. */
  paymentToken?: string;
  size?: 'sm' | 'md' | 'lg';
  showRoots?: boolean;
  currency?: SupportedCurrency;
  className?: string;
}

export function PriceDisplay({
  amount,
  paymentToken,
  size = 'md',
  showRoots = true,
  currency,
  className = '',
}: PriceDisplayProps) {
  const [userCurrency, setUserCurrency] = useState<SupportedCurrency>('USD');

  useEffect(() => {
    setUserCurrency(currency || detectUserCurrency());
  }, [currency]);

  const normalizedAmount = normalizeToRootsUnits(amount, paymentToken);
  const { roots, fiat } = formatPricesWithFiat(normalizedAmount, userCurrency);

  const sizeClasses = {
    sm: { fiat: 'text-sm font-medium', roots: 'text-xs' },
    md: { fiat: 'text-lg font-semibold', roots: 'text-xs' },
    lg: { fiat: 'text-2xl font-bold', roots: 'text-sm' },
  };

  return (
    <div className={`flex flex-col ${className}`}>
      <span className={sizeClasses[size].fiat}>{fiat}</span>
      {showRoots && (
        <span className={`text-roots-gray ${sizeClasses[size].roots}`}>
          {roots} ROOTS
        </span>
      )}
    </div>
  );
}

interface PriceSummaryProps {
  label: string;
  amount: bigint;
  /** Optional payment-token address. If USDC, `amount` is treated as 6-decimal base units. */
  paymentToken?: string;
  currency?: SupportedCurrency;
  className?: string;
}

export function PriceSummary({ label, amount, paymentToken, currency, className = '' }: PriceSummaryProps) {
  const [userCurrency, setUserCurrency] = useState<SupportedCurrency>('USD');

  useEffect(() => {
    setUserCurrency(currency || detectUserCurrency());
  }, [currency]);

  const normalizedAmount = normalizeToRootsUnits(amount, paymentToken);
  const { roots, fiat } = formatPricesWithFiat(normalizedAmount, userCurrency);

  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className="text-roots-gray">{label}</span>
      <div className="text-right">
        <div className="font-semibold">{fiat}</div>
        <div className="text-xs text-roots-gray">{roots} ROOTS</div>
      </div>
    </div>
  );
}
