/**
 * Stripe Crypto Onramp session status read endpoint.
 *
 * GET /api/stripe-onramp-session-status?sessionId=cos_...
 *
 * Companion to /api/stripe-onramp-session (mint). Exists because Stripe
 * doesn't deliberately surface session rejection reasons via webhook —
 * their docs explicitly say the `rejected` status doesn't expose a sub-
 * reason in the public API (it's a fraud-mitigation choice — they don't
 * want attackers to learn which signal tripped). But we can at least poll
 * the session to see WHICH terminal state it ended in (rejected vs.
 * fulfillment_complete vs. still pending) and react in our own UI.
 *
 * Used by CreditCardCheckout's polling loop to detect when a Stripe
 * session ends in `rejected` so the user gets a recovery panel rather
 * than staring at a "waiting for funds" spinner that will never resolve.
 *
 * Status values per Stripe docs:
 *   - initialized: session created, awaiting user
 *   - requires_payment: user is mid-flow
 *   - rejected: Stripe rejected (KYC fail, fraud, sanctions, velocity)
 *   - fulfillment_processing: Stripe accepted, crypto on its way
 *   - fulfillment_complete: USDC delivered (or whichever destination)
 *
 * Security:
 *   - We mint sessions server-side; the session ID is public-ish (it
 *     appears in the redirect_url visible in the user's browser).
 *     Anyone with a session ID can read its status — Stripe's API
 *     allows this. We do NOT add an extra auth layer; we just don't
 *     expose anything the buyer wouldn't already see in Stripe's UI.
 *   - STRIPE_SECRET_KEY stays server-side. The browser only ever sees
 *     the status enum + (eventually) the transaction_details on success.
 */

import { NextRequest, NextResponse } from 'next/server';

const STRIPE_API_URL = 'https://api.stripe.com/v1/crypto/onramp_sessions';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId query param required' }, { status: 400 });
  }

  // Loose format check — Stripe session IDs start with `cos_`. Reject anything
  // that doesn't to avoid forwarding random user input to Stripe's API.
  if (!/^cos_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: 'Malformed sessionId' }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
  }

  try {
    const resp = await fetch(`${STRIPE_API_URL}/${sessionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => 'unknown');
      console.error('[stripe-onramp-session-status] Stripe error:', resp.status, text);
      return NextResponse.json(
        { error: `Stripe API error (${resp.status})`, detail: text.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await resp.json()) as {
      id: string;
      status: string;
      transaction_details?: Record<string, unknown>;
    };

    // Return a focused subset — the full session object includes things
    // we don't need to expose to the browser.
    return NextResponse.json({
      id: data.id,
      status: data.status,
      transactionDetails: data.transaction_details ?? null,
    });
  } catch (err) {
    console.error('[stripe-onramp-session-status] Unexpected error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
