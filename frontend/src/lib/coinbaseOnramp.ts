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
  /**
   * USD amount to pre-fill. Coinbase fees come OUT of the delivered USDC,
   * so a $5.00 fiat preset delivers ~$4.88 USDC. Use this only when the
   * exact delivered amount doesn't matter.
   */
  presetFiatAmount?: number;
  /**
   * USDC amount to deliver. Coinbase calculates the fiat charge needed to
   * cover the delivered amount + fees, so the buyer pays the fee on top.
   * Prefer this when the delivered USDC must match an order total exactly.
   */
  presetCryptoAmount?: number;
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
/**
 * Open a blank popup window synchronously. MUST be called from a user-
 * gesture handler (e.g. onClick) WITHOUT any prior `await` — iOS Safari
 * counts any prior async work as breaking the gesture context and will
 * block the popup. Doug, Apr 29 2026: Matt hit this on iPhone.
 *
 * Pattern: caller opens this immediately on tap, then can do async work,
 * then passes the resulting Window reference to navigateToOnramp() which
 * sets the URL once the session is ready. If the caller decides Coinbase
 * isn't needed (existing balance check passed), they call `popup.close()`
 * themselves before navigating.
 *
 * Returns null if the browser blocked the popup outright. Caller should
 * surface a "please allow popups" message in that case.
 */
export function openBlankOnrampPopup(): Window | null {
  return window.open(
    'about:blank',
    'coinbase-onramp',
    'width=500,height=750,scrollbars=yes,resizable=yes',
  );
}

/**
 * Mint a Coinbase Onramp session and navigate the given popup to the
 * checkout URL. The popup must have been opened previously (synchronously,
 * inside the user gesture) via openBlankOnrampPopup().
 *
 * If popup is null (e.g. browser blocked), this returns
 * `{ ok: false, error: 'Popup was blocked...' }` so the caller can surface
 * a clear message.
 */
export async function navigateOnrampPopup(
  popup: Window | null,
  opts: OpenOnrampOptions,
): Promise<OpenOnrampResult> {
  if (!opts.walletAddress) {
    if (popup) popup.close();
    return { ok: false, error: 'No wallet address' };
  }
  if (!isCoinbaseOnrampConfigured()) {
    if (popup) popup.close();
    return { ok: false, error: 'Coinbase Onramp not configured' };
  }
  const hasFiat = typeof opts.presetFiatAmount === 'number' && opts.presetFiatAmount > 0;
  const hasCrypto = typeof opts.presetCryptoAmount === 'number' && opts.presetCryptoAmount > 0;
  if (!hasFiat && !hasCrypto) {
    if (popup) popup.close();
    return { ok: false, error: 'Must specify presetFiatAmount or presetCryptoAmount' };
  }
  if (hasFiat && hasCrypto) {
    if (popup) popup.close();
    return { ok: false, error: 'Specify only one of presetFiatAmount or presetCryptoAmount' };
  }

  if (!popup) {
    return {
      ok: false,
      error:
        'Popup was blocked. Please allow popups for localroots.love and try again.',
    };
  }

  try {
    const res = await fetch('/api/coinbase-onramp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: opts.walletAddress,
        presetFiatAmount: opts.presetFiatAmount,
        presetCryptoAmount: opts.presetCryptoAmount,
        partnerUserId: opts.partnerUserId,
        redirectUrl: opts.redirectUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = body.error || `HTTP ${res.status}`;
      popup.close();
      return { ok: false, error: errMsg };
    }

    const { url } = (await res.json()) as { url: string };
    if (!url) {
      popup.close();
      return { ok: false, error: 'No URL returned from session endpoint' };
    }

    popup.location.href = url;
    return { ok: true, popup };
  } catch (err) {
    popup.close();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Convenience wrapper: opens popup + mints session in one call. ONLY safe
 * to use if the caller has done NO async work since the user gesture.
 * For flows that need to do anything async first (e.g. pre-payment balance
 * check), use openBlankOnrampPopup() + navigateOnrampPopup() directly.
 */
export async function openCoinbaseOnramp(
  opts: OpenOnrampOptions,
): Promise<OpenOnrampResult> {
  const popup = openBlankOnrampPopup();
  return navigateOnrampPopup(popup, opts);
}
