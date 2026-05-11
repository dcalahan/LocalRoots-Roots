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
}

export interface OpenOnrampResult {
  ok: boolean;
  /** When ok=true, the popup window we opened. Caller polls + closes it. */
  popup?: Window | null;
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
