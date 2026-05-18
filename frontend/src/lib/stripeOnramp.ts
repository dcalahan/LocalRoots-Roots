/**
 * Stripe Crypto Onramp client helpers.
 *
 * Mirror of `lib/coinbaseOnramp.ts` — same interface shape (`OpenOnrampOptions`,
 * `OpenOnrampResult`, `openBlankOnrampPopup`, `navigateOnrampPopup`,
 * `openOnramp`) so the call sites can swap providers via a feature flag
 * without rewriting their UX logic. Keeps the iOS-Safari popup-blocker
 * pattern in place: open the blank popup synchronously inside the user
 * gesture, then async-fetch the session and navigate the popup.
 *
 * Replaces Coinbase Onramp (blocked our app on May 5 2026). Stripe owns
 * Privy as of 2025, so this is the first-party stack: Privy wallet +
 * Stripe Crypto Onramp + USDC on Base. Stripe is the merchant of record
 * on the fiat-to-crypto purchase; LocalRoots never custodies user funds.
 *
 * Doug's principle (CLAUDE.md "Zero Liability via Decentralization"):
 * Stripe is the regulated counterparty taking USD. LocalRoots never
 * touches fiat. USDC arrives in self-custody Privy wallet, marketplace
 * escrow handles the rest.
 *
 * Reference: https://docs.stripe.com/api/crypto/onramp_sessions/create
 */

export interface OpenOnrampOptions {
  /** Buyer's wallet address — where USDC will be deposited. */
  walletAddress: string;
  /** USD amount to pre-fill on Stripe's hosted UI. */
  presetFiatAmount?: number;
  /** USDC amount to deliver. Stripe back-calculates the fiat charge. */
  presetCryptoAmount?: number;
  /** Email pre-fill (smooths Stripe Link signup). */
  email?: string;
  /** Phone pre-fill (smooths Stripe Link signup). E.164 ideal but Stripe normalizes. */
  phone?: string;
  /**
   * URL Stripe Link redirects to when the session completes. Required for
   * mobile same-tab flow (see `shouldUseSameTabOnramp` below) — without a
   * return_url, the user gets stranded inside crypto.link.com. Optional for
   * desktop popup flow but harmless to include.
   */
  returnUrl?: string;
}

/**
 * iOS Safari (especially in private mode) strips query parameters from
 * cross-origin popup navigations via the `popup.location.href = url`
 * pattern. Stripe Link's session_hash is a long base64-style string that
 * matches Safari ITP's tracking-parameter heuristics, so it gets dropped.
 * The popup ends up at bare `crypto.link.com`, Stripe defaults to "Buy
 * Ethereum $10," and the user has no way to complete their actual order.
 *
 * Fix: on mobile, replace the popup with a same-tab navigation. iOS Safari
 * preserves query strings on normal in-tab navigations (only the popup
 * cross-origin pattern triggers ITP stripping). The Stripe return_url then
 * brings the user back to /buy/checkout, where the wallet-balance probe
 * (commit 5c52657) auto-detects the new USDC and routes them through the
 * gasless settlement path.
 *
 * Verified May 18 2026 against Doug's iPhone test: same wallet that earlier
 * showed "Buy 9.44 USDC" on desktop popup showed "Buy Ethereum $10" inside
 * the popup on mobile Safari private mode. Confirmed via curl that our
 * session-mint endpoint produces a correct URL with session_hash — the
 * query param disappears between popup-open and Stripe's render.
 *
 * Detection is intentionally narrow: iOS WebKit user-agents only. Android
 * Chrome and other mobile browsers handle the popup pattern correctly and
 * benefit from the more interactive popup UX.
 */
export function shouldUseSameTabOnramp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPhone/iPad/iPod cover all iOS Safari variants. WebKit on iPad
  // sometimes reports as desktop Safari, but the popup-vs-same-tab choice
  // is conservative — same-tab works everywhere; popup is the optimization.
  return /iPhone|iPad|iPod/.test(ua);
}

export interface OpenOnrampResult {
  ok: boolean;
  /** When ok=true, the popup window we opened. Caller polls + closes it. */
  popup?: Window | null;
  /**
   * Stripe Crypto Onramp session ID (e.g. "cos_..."). Available when this
   * provider is Stripe (not Coinbase). Pass to /api/stripe-onramp-session-status
   * to poll for rejection states. May be undefined if the mint endpoint
   * didn't return an ID (older response shape or non-Stripe provider).
   */
  sessionId?: string;
  /** Set when ok=false. */
  error?: string;
}

/**
 * Returns true when the Stripe Crypto Onramp publishable key is set in
 * the client env. Used by UI components to disable the button cleanly
 * when the integration isn't configured (e.g. local dev without the
 * env var).
 */
export function isStripeOnrampConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

/**
 * Feature flag for the Coinbase → Stripe migration. Set
 * NEXT_PUBLIC_USE_STRIPE_ONRAMP=true in Vercel to activate Stripe paths.
 * When unset/false, the original Coinbase paths are used (currently
 * disabled via NEXT_PUBLIC_COINBASE_DISABLED — see lib/coinbaseStatus.ts).
 *
 * After Stripe is verified working in production, this flag becomes the
 * default-on state and the Coinbase code can be removed.
 */
export function isStripeOnrampEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_STRIPE_ONRAMP?.toLowerCase() === 'true';
}

/**
 * Open a blank popup window synchronously. MUST be called from a user-
 * gesture handler WITHOUT any prior `await` — iOS Safari counts any
 * prior async work as breaking the gesture context and will block the
 * popup. Same pattern as the Coinbase helper.
 */
export function openBlankOnrampPopup(): Window | null {
  return window.open(
    'about:blank',
    'stripe-onramp',
    'width=500,height=750,scrollbars=yes,resizable=yes',
  );
}

/**
 * Mint a Stripe Crypto Onramp session and navigate the given popup to
 * Stripe's hosted UI. The popup must have been opened previously
 * (synchronously, inside the user gesture) via openBlankOnrampPopup().
 */
export async function navigateStripeOnrampPopup(
  popup: Window | null,
  opts: OpenOnrampOptions,
): Promise<OpenOnrampResult> {
  if (!opts.walletAddress) {
    if (popup) popup.close();
    return { ok: false, error: 'No wallet address' };
  }

  const hasFiat = typeof opts.presetFiatAmount === 'number' && opts.presetFiatAmount > 0;
  const hasCrypto = typeof opts.presetCryptoAmount === 'number' && opts.presetCryptoAmount > 0;
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
    const res = await fetch('/api/stripe-onramp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: opts.walletAddress,
        presetFiatAmount: opts.presetFiatAmount,
        presetCryptoAmount: opts.presetCryptoAmount,
        email: opts.email,
        phone: opts.phone,
        returnUrl: opts.returnUrl,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errMsg = body.error || `HTTP ${res.status}`;
      popup.close();
      return { ok: false, error: errMsg };
    }

    const { url, id } = (await res.json()) as { url: string; id?: string };
    if (!url) {
      popup.close();
      return { ok: false, error: 'No URL returned from session endpoint' };
    }

    popup.location.href = url;
    return { ok: true, popup, sessionId: id };
  } catch (err) {
    popup.close();
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Mint a Stripe Crypto Onramp session and return the redirect URL — WITHOUT
 * opening a popup. Used by the pre-mint pattern: call this when the buyer
 * lands on the "Confirm & Pay" screen, cache the URL in state, then on the
 * Pay button click do `window.open(url, ...)` synchronously inside the
 * user gesture.
 *
 * This sidesteps the iOS Safari ITP bug entirely. The popup-then-redirect
 * pattern (`popup.location.href = stripeUrl`) triggers cross-origin query-
 * string stripping in Safari private mode — `session_hash` disappears,
 * Stripe Link defaults to "Buy Ethereum $10." A direct `window.open(url, ...)`
 * with the full URL inline is a normal navigation and preserves the params.
 *
 * Verified against Doug's iPhone test May 18 2026: same wallet that showed
 * "Buy Ethereum $10" with the popup pattern now shows "Buy 9.44 USDC" with
 * the pre-mint + sync-open pattern.
 */
export async function mintStripeOnrampUrl(
  opts: OpenOnrampOptions,
): Promise<{ ok: true; url: string; sessionId?: string } | { ok: false; error: string }> {
  if (!opts.walletAddress) {
    return { ok: false, error: 'No wallet address' };
  }

  const hasFiat = typeof opts.presetFiatAmount === 'number' && opts.presetFiatAmount > 0;
  const hasCrypto = typeof opts.presetCryptoAmount === 'number' && opts.presetCryptoAmount > 0;
  if (hasFiat && hasCrypto) {
    return { ok: false, error: 'Specify only one of presetFiatAmount or presetCryptoAmount' };
  }

  try {
    const res = await fetch('/api/stripe-onramp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress: opts.walletAddress,
        presetFiatAmount: opts.presetFiatAmount,
        presetCryptoAmount: opts.presetCryptoAmount,
        email: opts.email,
        phone: opts.phone,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || `HTTP ${res.status}` };
    }

    const { url, id } = (await res.json()) as { url: string; id?: string };
    if (!url) {
      return { ok: false, error: 'No URL returned from session endpoint' };
    }

    return { ok: true, url, sessionId: id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Synchronously open a Stripe Onramp URL in a new window/tab. MUST be called
 * from inside a user gesture handler (button onClick) with NO prior await.
 * The URL must be pre-minted via `mintStripeOnrampUrl` ahead of time.
 *
 * Returns the popup window so the caller can poll its `closed` state. On
 * iOS Safari, this opens in a new tab rather than a true popup — that's
 * fine, the polling logic doesn't care about window dimensions.
 */
export function openStripeOnrampWithUrl(url: string): Window | null {
  return window.open(
    url,
    'stripe-onramp',
    'width=500,height=750,scrollbars=yes,resizable=yes',
  );
}

/**
 * Convenience wrapper: opens popup + mints session in one call. ONLY safe
 * to use if the caller has done NO async work since the user gesture.
 * For flows that need pre-payment balance checks or other async work
 * before opening the onramp, use openBlankOnrampPopup() +
 * navigateStripeOnrampPopup() directly.
 */
export async function openStripeOnramp(
  opts: OpenOnrampOptions,
): Promise<OpenOnrampResult> {
  const popup = openBlankOnrampPopup();
  return navigateStripeOnrampPopup(popup, opts);
}
