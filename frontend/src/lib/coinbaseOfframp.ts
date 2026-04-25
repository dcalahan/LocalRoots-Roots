/**
 * Coinbase Offramp client helpers — let sellers cash out USDC to their bank.
 *
 * Architecture: the frontend calls our `/api/coinbase-offramp-session` route,
 * which signs a JWT with our CDP API key and asks Coinbase to mint a session
 * token bound to the seller's wallet. The route returns the final Coinbase
 * Offramp URL (with the session token embedded) which the frontend opens
 * in a popup.
 *
 * Coinbase handles KYC, USDC pull from wallet, USD conversion, and ACH
 * to the seller's bank account. LocalRoots never touches fiat.
 *
 * Setup required (per Doug, before mainnet):
 * 1. Create Coinbase Developer Platform (CDP) account at https://portal.cdp.coinbase.com
 * 2. Create an Offramp app, get the Project ID
 * 3. Configure allowed domains: localroots.love, www.localroots.love
 * 4. Create an Ed25519 API key, save the secret
 * 5. Set env vars in Vercel:
 *    - NEXT_PUBLIC_COINBASE_PROJECT_ID  (public — also used for branding)
 *    - COINBASE_CDP_API_KEY_NAME        (server-side only — UUID)
 *    - COINBASE_CDP_API_KEY_PRIVATE     (server-side only — base64 secret)
 *
 * Reference: https://docs.cdp.coinbase.com/onramp/docs/sell-quickstart/
 */

export interface OpenOfframpOptions {
  /** User's wallet address (where USDC will come FROM). */
  walletAddress: string;
  /** Privy ID or similar — used for transaction tracking on Coinbase side. */
  partnerUserId?: string;
  /** Pre-fill an amount to sell (in USDC). User can edit on Coinbase. */
  presetCryptoAmount?: number;
}

/**
 * Returns true when the Coinbase Offramp project is configured (env var set).
 * Used to gate the UI client-side — full server-side check happens in the API route.
 */
export function isCoinbaseOfframpConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID;
}

export interface OpenOfframpResult {
  ok: boolean;
  /** Set when ok=false. */
  error?: string;
}

/**
 * Open the Coinbase Offramp flow in a popup window.
 *
 * Two-step popup pattern: opens a blank window synchronously on click (so
 * popup blockers don't fire), then awaits the session token fetch and
 * navigates the popup to the final URL once it's ready.
 *
 * Falls back to same-tab navigation if the popup is blocked.
 */
export async function openCoinbaseOfframp(
  opts: OpenOfframpOptions,
): Promise<OpenOfframpResult> {
  if (!opts.walletAddress) {
    return { ok: false, error: 'No wallet address' };
  }
  if (!isCoinbaseOfframpConfigured()) {
    return { ok: false, error: 'Coinbase Offramp not configured' };
  }

  // Open a blank popup synchronously so browsers don't block it after the await.
  const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');

  try {
    const res = await fetch('/api/coinbase-offramp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: opts.walletAddress,
        presetCryptoAmount: opts.presetCryptoAmount,
        partnerUserId: opts.partnerUserId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = body.error || `HTTP ${res.status}`;
      if (popup) popup.close();
      return { ok: false, error: errMsg };
    }

    const { url } = (await res.json()) as { url: string };
    if (!url) {
      if (popup) popup.close();
      return { ok: false, error: 'No URL returned from session endpoint' };
    }

    if (popup) {
      popup.location.href = url;
    } else {
      // Popup was blocked — fall back to same-tab navigation
      window.location.href = url;
    }
    return { ok: true };
  } catch (err) {
    if (popup) popup.close();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
