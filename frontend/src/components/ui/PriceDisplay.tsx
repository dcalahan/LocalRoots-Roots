'use client';

import { useState, useEffect } from 'react';
import { formatPricesWithFiat, detectUserCurrency, type SupportedCurrency } from '@/lib/pricing';

interface PriceDisplayProps {
  amount: bigint;
  size?: 'sm' | 'md' | 'lg';
  showRoots?: boolean;
  currency?: SupportedCurrency;
  className?: string;
}

export function PriceDisplay({
  amount,
  size = 'md',
  showRoots = true,
  currency,
  className = '',
}: PriceDisplayProps) {
  const [userCurrency, setUserCurrency] = useState<SupportedCurrency>('USD');

  useEffect(() => {
    setUserCurrency(currency || detectUserCurrency());
  }, [currency]);

  const { roots, fiat } = formatPricesWithFiat(amount, userCurrency);

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
  currency?: SupportedCurrency;
  className?: string;
}

export function PriceSummary({ label, amount, currency, className = '' }: PriceSummaryProps) {
  const [userCurrency, setUserCurrency] = useState<SupportedCurrency>('USD');

  useEffect(() => {
    setUserCurrency(currency || detectUserCurrency());
  }, [currency]);

  const { roots, fiat } = formatPricesWithFiat(amount, userCurrency);

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
