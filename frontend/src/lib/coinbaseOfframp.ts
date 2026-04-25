/**
 * Coinbase Offramp integration — let sellers cash out USDC to their bank.
 *
 * Architecture: opens Coinbase's hosted offramp page (pay.coinbase.com) with
 * the user's wallet pre-filled. Coinbase handles KYC, USDC pull from wallet,
 * USD conversion, and ACH to bank account. We never touch the funds.
 *
 * Setup required (per Doug, before mainnet):
 * 1. Create Coinbase Developer Platform (CDP) account at https://portal.cdp.coinbase.com
 * 2. Create an Offramp app, get the App ID
 * 3. Configure allowed domains: localroots.love, www.localroots.love
 * 4. Set NEXT_PUBLIC_COINBASE_CDP_APP_ID in Vercel
 *
 * Reference: https://docs.cdp.coinbase.com/onramp/docs/sell-quickstart/
 */

export const COINBASE_OFFRAMP_URL = 'https://pay.coinbase.com/v3/sell/input';

export interface BuildOfframpUrlOptions {
  /** User's wallet address (where USDC will come FROM). */
  walletAddress: string;
  /** Privy ID or similar — used for transaction tracking on Coinbase side. */
  partnerUserId?: string;
  /** Pre-fill an amount to sell (in USDC). User can edit. */
  presetCryptoAmount?: number;
  /** Where to redirect after the user finishes the flow. */
  redirectUrl?: string;
}

/**
 * Returns true when the Coinbase Offramp env var is set.
 * Used to gate the UI — if not configured, show "Coming soon" message.
 */
export function isCoinbaseOfframpConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_COINBASE_CDP_APP_ID;
}

/**
 * Build the Coinbase Offramp URL with the user's wallet pre-filled.
 * Returns null if the App ID env var is missing.
 */
export function buildCoinbaseOfframpUrl(opts: BuildOfframpUrlOptions): string | null {
  const appId = process.env.NEXT_PUBLIC_COINBASE_CDP_APP_ID;
  if (!appId) return null;

  // Coinbase expects:
  //   addresses = JSON-encoded { "0x...": ["base"] }
  //   assets    = JSON-encoded ["USDC"]
  const addresses = JSON.stringify({ [opts.walletAddress]: ['base'] });
  const assets = JSON.stringify(['USDC']);

  const params = new URLSearchParams({
    appId,
    addresses,
    assets,
  });

  if (opts.partnerUserId) {
    // Coinbase uses partnerUserId for tracking; truncate Privy IDs that contain colons
    params.set('partnerUserId', opts.partnerUserId.slice(0, 49));
  }
  if (opts.presetCryptoAmount && opts.presetCryptoAmount > 0) {
    params.set('presetCryptoAmount', opts.presetCryptoAmount.toString());
  }
  if (opts.redirectUrl) {
    params.set('redirectUrl', opts.redirectUrl);
  }

  return `${COINBASE_OFFRAMP_URL}?${params.toString()}`;
}

/**
 * Open Coinbase Offramp in a new tab. Returns false if not configured.
 */
export function openCoinbaseOfframp(opts: BuildOfframpUrlOptions): boolean {
  const url = buildCoinbaseOfframpUrl(opts);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
