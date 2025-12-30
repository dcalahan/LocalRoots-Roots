import { formatUnits, parseUnits } from 'viem';

// ROOTS token has 18 decimals
export const ROOTS_DECIMALS = 18;

// Default exchange rate: 1000 ROOTS = 1 ETH (configurable via env)
const DEFAULT_ROOTS_PER_ETH = 1000;

// Fiat currency rates (ROOTS to fiat) - these would come from an oracle in production
// For now, 1 ROOTS ≈ $0.10 USD
const FIAT_RATES: Record<string, number> = {
  USD: 0.10,
  EUR: 0.09,
  BRL: 0.50,
  GBP: 0.08,
  CAD: 0.14,
  AUD: 0.15,
  JPY: 15.0,
  MXN: 1.70,
};

export type SupportedCurrency = keyof typeof FIAT_RATES;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  BRL: 'R$',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  MXN: 'MX$',
};

export function getSupportedCurrencies(): SupportedCurrency[] {
  return Object.keys(FIAT_RATES) as SupportedCurrency[];
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export function detectUserCurrency(): SupportedCurrency {
  if (typeof window === 'undefined') return 'USD';

  try {
    const locale = navigator.language || 'en-US';
    const parts = locale.split('-');
    const country = parts[1]?.toUpperCase() || parts[0]?.toUpperCase();

    // Map countries to currencies
    const countryToCurrency: Record<string, SupportedCurrency> = {
      US: 'USD',
      BR: 'BRL',
      DE: 'EUR',
      FR: 'EUR',
      ES: 'EUR',
      IT: 'EUR',
      GB: 'GBP',
      CA: 'CAD',
      AU: 'AUD',
      JP: 'JPY',
      MX: 'MXN',
    };

    return countryToCurrency[country] || 'USD';
  } catch {
    return 'USD';
  }
}

export function getRootsPerEth(): number {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_ROOTS_PER_ETH) {
    return Number(process.env.NEXT_PUBLIC_ROOTS_PER_ETH);
  }
  return DEFAULT_ROOTS_PER_ETH;
}

/**
 * Convert ROOTS to fiat currency
 */
export function rootsToFiat(rootsAmount: bigint, currency: SupportedCurrency = 'USD'): number {
  const rootsFloat = parseFloat(formatUnits(rootsAmount, ROOTS_DECIMALS));
  const rate = FIAT_RATES[currency] || FIAT_RATES.USD;
  return rootsFloat * rate;
}

/**
 * Format fiat amount for display
 */
export function formatFiat(amount: number, currency: SupportedCurrency = 'USD'): string {
  const symbol = getCurrencySymbol(currency);

  if (amount === 0) return `${symbol}0`;
  if (amount < 0.01) return `<${symbol}0.01`;

  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format ROOTS amount for display
 * @param amount - Amount in wei (smallest unit)
 * @param decimals - Number of decimal places to show (default 2)
 */
export function formatRoots(amount: bigint, decimals: number = 2): string {
  const formatted = formatUnits(amount, ROOTS_DECIMALS);
  const num = parseFloat(formatted);

  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse ROOTS amount from string to wei
 * @param amount - Amount as string (e.g., "10.5")
 */
export function parseRoots(amount: string): bigint {
  return parseUnits(amount, ROOTS_DECIMALS);
}

/**
 * Convert fiat amount to ROOTS wei
 * @param fiatAmount - Amount in fiat currency (e.g., 5.00 for $5.00)
 * @param currency - The fiat currency
 */
export function fiatToRoots(fiatAmount: number, currency: SupportedCurrency = 'USD'): bigint {
  const rate = FIAT_RATES[currency] || FIAT_RATES.USD;
  const rootsAmount = fiatAmount / rate;
  return parseUnits(rootsAmount.toFixed(ROOTS_DECIMALS), ROOTS_DECIMALS);
}

/**
 * Parse fiat string to ROOTS wei
 * @param fiatString - Amount as string (e.g., "5.00" for $5.00)
 * @param currency - The fiat currency
 */
export function parseFiatToRoots(fiatString: string, currency: SupportedCurrency = 'USD'): bigint {
  const fiatAmount = parseFloat(fiatString) || 0;
  return fiatToRoots(fiatAmount, currency);
}

/**
 * Convert ROOTS to ETH equivalent
 * @param rootsAmount - Amount in ROOTS wei
 */
export function rootsToEth(rootsAmount: bigint): bigint {
  const rootsPerEth = BigInt(getRootsPerEth());
  return rootsAmount / rootsPerEth;
}

/**
 * Format ETH amount for display
 * @param amount - Amount in wei
 * @param decimals - Number of decimal places to show (default 6)
 */
export function formatEth(amount: bigint, decimals: number = 6): string {
  const formatted = formatUnits(amount, 18);
  const num = parseFloat(formatted);

  if (num === 0) return '0';
  if (num < 0.000001) return '<0.000001';

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get both ROOTS and ETH formatted strings
 */
export function formatPrices(rootsAmount: bigint): {
  roots: string;
  eth: string;
} {
  return {
    roots: formatRoots(rootsAmount),
    eth: formatEth(rootsToEth(rootsAmount)),
  };
}

/**
 * Get ROOTS, fiat, and ETH formatted strings
 */
export function formatPricesWithFiat(
  rootsAmount: bigint,
  currency: SupportedCurrency = 'USD'
): {
  roots: string;
  fiat: string;
  fiatRaw: number;
  eth: string;
  currency: SupportedCurrency;
} {
  const fiatRaw = rootsToFiat(rootsAmount, currency);
  return {
    roots: formatRoots(rootsAmount),
    fiat: formatFiat(fiatRaw, currency),
    fiatRaw,
    eth: formatEth(rootsToEth(rootsAmount)),
    currency,
  };
}
