/**
 * Coinbase Onramp client helpers — let buyers pay with credit card,
 * landing USDC in their Privy wallet on Base mainnet.
 *
 * Mirror of `lib/coinbaseOfframp.ts`. Same JWT auth, same session token
 * endpoint, different destination URL (`/v3/buy/input` vs `/v3/sell/input`).
 *
 * Architecture: frontend calls our `/api/coinbase-onramp-session` route,
 * which signs a JWT with our Secret CDP API key and asks Coinbase to mint
 * a session token bound to the buyer's wallet. Route returns the final
 * Coinbase Onramp URL (with sessionToken embedded), frontend opens it in
 * a popup. Buyer pays in Coinbase's hosted UI (Apple Pay / Google Pay /
 * card). USDC settles to their Privy wallet on Base; the parent page
 * polls for the balance and then settles the marketplace order.
 *
 * Doug's principle (CLAUDE.md "Zero Liability via Decentralization"):
 * Coinbase is the regulated counterparty taking USD. LocalRoots never
 * touches fiat. USDC arrives in self-custody Privy wallet, marketplace
 * escrow handles the rest.
 *
 * Reference: https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/generating-onramp-url
 */

export interface OpenOnrampOptions {
  /** Buyer's wallet address — where USDC will be deposited. */
  walletAddress: string;
  /** USD amount to pre-fill on Coinbase. User can still adjust. */
  presetFiatAmount: number;
  /** Privy ID — used for tracking on Coinbase side, optional. */
  partnerUserId?: string;
  /** URL Coinbase redirects to after the buyer completes payment. */
  redirectUrl?: string;
}

/**
 * Returns true when the Coinbase Onramp project is configured.
 * Same env var as offramp — they share a CDP project.
 */
export function isCoinbaseOnrampConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID;
}

export interface OpenOnrampResult {
  ok: boolean;
  /** When ok=true, the popup window we opened. Caller polls + closes it. */
  popup?: Window | null;
  /** Set when ok=false. */
  error?: string;
}

/**
 * Open the Coinbase Onramp flow in a popup window.
 *
 * Two-step popup pattern: opens a blank window synchronously on click (so
 * popup blockers don't fire), then awaits the session token fetch and
 * navigates the popup to the final URL once it's ready.
 *
 * Returns the popup reference so the caller can poll its state and close
 * it when the buyer's wallet has been funded.
 *
 * Falls back to same-tab navigation if popups are blocked — that path is
 * worse UX (we lose the parent page state) so we surface a clearer error
 * to the caller in that case rather than silently navigating away.
 */
export async function openCoinbaseOnramp(
  opts: OpenOnrampOptions,
): Promise<OpenOnrampResult> {
  if (!opts.walletAddress) {
    return { ok: false, error: 'No wallet address' };
  }
  if (!isCoinbaseOnrampConfigured()) {
    return { ok: false, error: 'Coinbase Onramp not configured' };
  }
  if (!opts.presetFiatAmount || opts.presetFiatAmount <= 0) {
    return { ok: false, error: 'Amount must be greater than 0' };
  }

  // Open a blank popup synchronously so browsers don't block it after the
  // await. Sized for Coinbase's hosted checkout — fits Apple Pay sheet.
  const popup = window.open(
    'about:blank',
    'coinbase-onramp',
    'width=500,height=750,scrollbars=yes,resizable=yes',
  );

  try {
    const res = await fetch('/api/coinbase-onramp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: opts.walletAddress,
        presetFiatAmount: opts.presetFiatAmount,
        partnerUserId: opts.partnerUserId,
        redirectUrl: opts.redirectUrl,
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
      return { ok: true, popup };
    }

    // Popup blocked — caller should surface "please allow popups" rather
    // than navigating the parent away (which kills the cart + checkout state).
    return { ok: false, error: 'Popup was blocked. Please allow popups for localroots.love and try again.' };
  } catch (err) {
    if (popup) popup.close();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
