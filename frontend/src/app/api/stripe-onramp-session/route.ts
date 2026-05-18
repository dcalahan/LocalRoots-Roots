/**
 * Mint a Stripe Crypto Onramp session for a buyer's wallet.
 *
 * Replaces the Coinbase Onramp path (Coinbase blocked our app on May 5
 * 2026). Stripe acquired Privy in 2025, so this is a first-party
 * Stripe-ecosystem integration: USDC delivered to the buyer's Privy
 * embedded wallet on Base mainnet, with Stripe as merchant of record
 * on the fiat-to-crypto purchase.
 *
 * Flow:
 *   1. Frontend POSTs { walletAddress, presetFiatAmount? | presetCryptoAmount?, email? }
 *   2. We hit Stripe's REST API at api.stripe.com/v1/crypto/onramp_sessions
 *      using STRIPE_SECRET_KEY (sk_test_... or sk_live_...)
 *   3. Stripe returns { id, client_secret, redirect_url }
 *   4. We return the redirect_url to the frontend, which opens it in a popup
 *      (same pattern as the old Coinbase flow — minimizes UI churn)
 *
 * Note: Stripe Crypto Onramp is still in Preview at the API level. The
 * Stripe Node SDK doesn't expose `crypto.onrampSessions.create` as a typed
 * method yet, so we hit the v1 endpoint with form-encoded body directly.
 * Switch to the SDK method when it gets first-class support.
 *
 * Env vars (server-side only):
 *   - STRIPE_SECRET_KEY  Stripe API secret key
 *
 * Reference: https://docs.stripe.com/api/crypto/onramp_sessions/create
 * Reference: https://docs.privy.io/recipes/stripe-headless-onramp
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp } from '@/lib/clientIp';

const STRIPE_API_URL = 'https://api.stripe.com/v1/crypto/onramp_sessions';

interface SessionRequestBody {
  walletAddress?: string;
  /** USD amount to pre-fill on Stripe's hosted UI. Optional. */
  presetFiatAmount?: number;
  /** USDC amount to pre-fill. Stripe calculates the fiat charge needed. */
  presetCryptoAmount?: number;
  /** Email pre-fill — passed to Stripe as `kyc_details[email]`. */
  email?: string;
  /** Phone pre-fill (E.164 or local format) — passed as `kyc_details[phone]`. */
  phone?: string;
  /**
   * Where Stripe Link redirects the user after session completion. Required
   * for the mobile same-tab flow — without it, the user is stranded inside
   * crypto.link.com. The popup flow uses this less (popup just closes), but
   * it's harmless to include either way. Must be a URL on our own origin.
   */
  returnUrl?: string;
}

/**
 * Testing notes (Stripe Crypto Onramp test mode, May 11 2026):
 * Real SSN + test card 4242 FAILS with "An unknown error occurred"
 * because Stripe's fraud rules reject the real-name/real-SSN + test-card
 * combination. Use the documented test allowlist:
 *
 *   - Card:   4242 4242 4242 4242 (any future expiry, any CVC, any ZIP)
 *   - SSN:    000-00-0000
 *   - OTP:    000000
 *   - DOB:    any reasonable date
 *   - Name:   any non-empty values
 *
 * Real KYC data is only accepted in LIVE mode (once Stripe approves the
 * Crypto Onramp application). Doug burned a test cycle on this — don't
 * repeat the mistake. Source:
 * https://docs.stripe.com/crypto/onramp + Stripe testing docs.
 */

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SessionRequestBody;
    const { walletAddress, presetFiatAmount, presetCryptoAmount, email, phone, returnUrl } = body;

    // Validation — mirror the Coinbase route's shape so callers don't have to learn a new contract.
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress is required' },
        { status: 400 },
      );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'walletAddress must be a 0x-prefixed 40-hex-char Ethereum address' },
        { status: 400 },
      );
    }
    if (presetFiatAmount !== undefined && presetCryptoAmount !== undefined) {
      return NextResponse.json(
        { error: 'Specify only one of presetFiatAmount or presetCryptoAmount' },
        { status: 400 },
      );
    }
    if (presetFiatAmount !== undefined) {
      if (typeof presetFiatAmount !== 'number' || presetFiatAmount <= 0) {
        return NextResponse.json(
          { error: 'presetFiatAmount must be a positive number' },
          { status: 400 },
        );
      }
      // Stripe Crypto Onramp has a $1 floor (vs Coinbase's $5) — much friendlier
      // to small basil purchases. Validate above 1 to give a clean error.
      if (presetFiatAmount < 1) {
        return NextResponse.json(
          { error: 'presetFiatAmount must be at least $1' },
          { status: 400 },
        );
      }
    }
    if (presetCryptoAmount !== undefined) {
      if (typeof presetCryptoAmount !== 'number' || presetCryptoAmount <= 0) {
        return NextResponse.json(
          { error: 'presetCryptoAmount must be a positive number' },
          { status: 400 },
        );
      }
      if (presetCryptoAmount < 1) {
        return NextResponse.json(
          { error: 'presetCryptoAmount must be at least 1 USDC' },
          { status: 400 },
        );
      }
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'STRIPE_SECRET_KEY is not configured' },
        { status: 500 },
      );
    }

    // Build form-encoded body. Stripe v1 endpoints accept JSON too but the
    // canonical pattern is form-encoded.
    //
    // IMPORTANT: Stripe Crypto Onramp's API has all transaction params at
    // the TOP LEVEL of the request body — NOT nested under
    // `transaction_details` (that's the RESPONSE shape, not the request
    // shape). Sending `transaction_details[destination_currency]` etc.
    // returns 400 `parameter_unknown`. Confirmed against
    // https://docs.stripe.com/api/crypto/onramp_sessions/create — May 11 2026.
    //
    // Also: `customer_information` is not a valid request parameter; use
    // `kyc_details` instead (and only when pre-populating real KYC data,
    // not arbitrary emails). Skipping email pre-fill for now — Stripe's
    // hosted UI collects it inline.
    const params = new URLSearchParams();
    // NB: wallet_addresses key for Base is `base_network` (asymmetric
    // naming — every other chain uses just the chain name, but Base
    // has the `_network` suffix). Verified against Stripe's docs
    // (https://docs.stripe.com/api/crypto/onramp_sessions/object) and
    // confirmed via 400 from `wallet_addresses[base]` on May 11 2026.
    params.append('wallet_addresses[base_network]', walletAddress);
    params.append('destination_currency', 'usdc');
    params.append('destination_network', 'base');
    params.append('source_currency', 'usd');

    if (presetCryptoAmount !== undefined && presetCryptoAmount > 0) {
      // USDC precision; Stripe's API takes the amount as a string
      params.append('destination_amount', presetCryptoAmount.toFixed(6));
    } else if (presetFiatAmount !== undefined && presetFiatAmount > 0) {
      params.append('source_amount', presetFiatAmount.toFixed(2));
    }

    // Lock the wallet so the buyer can't redirect funds elsewhere inside
    // Stripe's UI. Top-level boolean per Stripe's API contract.
    params.append('lock_wallet_address', 'true');

    // Stripe Crypto Onramp's create endpoint does NOT accept a return_url
    // / success_url parameter (verified May 18 2026 against the API docs).
    // The `returnUrl` field is accepted in our request body for forward-
    // compatibility but currently ignored — Stripe doesn't auto-redirect
    // users back to the merchant after a session completes. Mobile flow
    // relies on the buyer returning to /buy/checkout manually; the
    // wallet-balance probe (commit 5c52657) picks up the new USDC on
    // their return and offers the gasless settlement path.
    void returnUrl;

    // Pass client IP for fraud detection — Stripe's `customer_ip_address`
    // parameter mirrors the `clientIp` requirement Coinbase had. Same
    // helper we already use for both Coinbase routes.
    const clientIp = getClientIp(req);
    if (clientIp) {
      params.append('customer_ip_address', clientIp);
    }

    // We do NOT pre-fill identity fields via `kyc_details`. Two real
    // failure modes observed in production (May 11 2026):
    //
    //   - `kyc_details[email]` IS accepted by the API but causes
    //     Stripe Link to LOCK the session to that email. If the user
    //     has an existing Stripe Link account under a different
    //     email, they get "Please login with the account that you
    //     previously used for this purchase" and cannot proceed.
    //     Because most users have a Stripe Link account from prior
    //     use on other sites (Shopify, Robinhood, etc.) under
    //     whatever email they signed up with first, pre-filling
    //     forces a conflict for the majority of users.
    //
    //   - `kyc_details[phone]` returns 400 `parameter_unknown` — not
    //     a documented sub-field.
    //
    // Architectural correction: when an external identity layer like
    // Stripe Link exists, don't pre-fill identity fields. Let the
    // user's existing identity authenticate them in the provider's
    // own UI. Pre-fill is only helpful for first-time users with no
    // existing account; for everyone else, it creates friction.
    //
    // The route still accepts `email` and `phone` in the request body
    // for forward-compatibility (don't break callers) but neither is
    // forwarded to Stripe.
    void email;
    void phone;

    const stripeResp = await fetch(STRIPE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!stripeResp.ok) {
      const errText = await stripeResp.text().catch(() => 'unknown');
      console.error(
        '[stripe-onramp-session] Stripe API error:',
        stripeResp.status,
        errText,
      );
      return NextResponse.json(
        {
          error: `Stripe API error (${stripeResp.status})`,
          detail: errText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const data = (await stripeResp.json()) as {
      id?: string;
      client_secret?: string;
      redirect_url?: string;
    };

    if (!data.redirect_url) {
      console.error(
        '[stripe-onramp-session] no redirect_url in response:',
        data,
      );
      return NextResponse.json(
        { error: 'Stripe returned no redirect URL' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url: data.redirect_url,
      id: data.id,
      clientSecret: data.client_secret,
    });
  } catch (err) {
    console.error('[stripe-onramp-session] unexpected error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
