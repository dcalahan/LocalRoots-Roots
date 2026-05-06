/**
 * Coinbase availability flag — manual override for when Coinbase
 * Onramp/Offramp is unavailable (e.g. blocked app, paid-support gate,
 * outage on their side).
 *
 * Triggered May 5 2026 when Coinbase CDP blocked LocalRoots's app
 * (project ID 37ee8da0-6945-4c8f-9f73-f7cb5bc4dabc) via auto-rejection
 * after our application review. The session-token API now returns a
 * 502 with `{"code":"ERROR_CODE_NOT_FOUND","message":"NotFound: app id
 * ... is blocked"}`. Letting users click the buttons and hit that
 * error is worse UX than disabling the buttons with a clear message.
 *
 * Set `NEXT_PUBLIC_COINBASE_DISABLED=true` in Vercel env vars to
 * surface the "temporarily unavailable" banner across:
 *   - /wallet → Buy USDC section (BuyUsdcSection.tsx)
 *   - /wallet → Cash Out section (CashOutSection.tsx)
 *   - /buy/checkout → Pay with Credit Card path (CreditCardCheckout.tsx)
 *
 * When access is restored (or we migrate to Stripe / MoonPay), unset
 * the env var or set to `false`.
 */

export function isCoinbaseDisabled(): boolean {
  return process.env.NEXT_PUBLIC_COINBASE_DISABLED?.toLowerCase() === 'true';
}

/**
 * Shared user-facing message when the Coinbase paths are disabled.
 * Kept as a single string so the three surfaces stay consistent.
 */
export const COINBASE_UNAVAILABLE_MESSAGE =
  'Credit-card payments and bank cash-out are temporarily unavailable while we work with our payment partner. Crypto wallet payments are still working — sellers can still receive USDC, buyers with crypto wallets can still purchase. Sorry for the disruption.';
