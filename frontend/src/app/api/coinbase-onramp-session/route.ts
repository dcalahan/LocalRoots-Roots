/**
 * Mint a Coinbase Onramp session token for a buyer's wallet.
 *
 * Mirror of `/api/coinbase-offramp-session` but for the buy direction —
 * buyer pays USD via card / Apple Pay / Google Pay, USDC lands in their
 * Privy wallet on Base mainnet.
 *
 * Flow:
 *   1. Frontend POSTs { walletAddress, presetFiatAmount } here when buyer
 *      clicks "Pay with Credit Card"
 *   2. We sign a JWT with our Coinbase CDP API key (Ed25519, EdDSA)
 *   3. We POST to Coinbase's session token endpoint with the JWT
 *   4. Coinbase returns a session token bound to that wallet
 *   5. We build the final Onramp URL with the session token and return it
 *   6. Frontend opens the URL in a popup; buyer pays in Coinbase's hosted UI
 *   7. USDC lands in the buyer's wallet; frontend polls balance and settles
 *      the marketplace order
 *
 * Env vars (server-side only — same as offramp):
 *   - COINBASE_CDP_API_KEY_NAME     UUID of the API key
 *   - COINBASE_CDP_API_KEY_PRIVATE  base64-encoded Ed25519 secret (64 bytes)
 *   - NEXT_PUBLIC_COINBASE_PROJECT_ID  the CDP project ID
 *
 * Why no Client API Key: this is the URL-redirect (popup) flow, not the
 * inline OnchainKit FundCard component. The session-token endpoint
 * authenticates via JWT signed with the Secret API Key — same auth as
 * offramp. See https://docs.cdp.coinbase.com/onramp-&-offramp/session-token-authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importJWK } from 'jose';
import { randomBytes } from 'crypto';

const COINBASE_API_HOST = 'api.developer.coinbase.com';
const SESSION_TOKEN_PATH = '/onramp/v1/token';
// NOTE: this is `/buy/select-asset`, NOT `/v3/buy/input`. The offramp
// counterpart uses `/v3/sell/input` but the buy flow's guest-checkout
// entry point is the v1 path. Using v3/buy/input bounces the buyer to
// login.coinbase.com instead of guest checkout — verified via Coinbase
// docs (Apr 28 2026):
// https://docs.cdp.coinbase.com/onramp-&-offramp/onramp-apis/generating-onramp-url
const ONRAMP_URL_BASE = 'https://pay.coinbase.com/buy/select-asset';

interface SessionTokenRequestBody {
  walletAddress?: string;
  /** USD amount to pre-fill on Coinbase. User can adjust. */
  presetFiatAmount?: number;
  /** Optional Privy ID for partnerUserId tracking on Coinbase side. */
  partnerUserId?: string;
  /** URL to redirect to after the buyer completes payment. */
  redirectUrl?: string;
}

/**
 * Build a JWT for authenticating to Coinbase's CDP API.
 * Uses Ed25519 / EdDSA per the API key format from CDP.
 *
 * Identical to the offramp helper — kept as a copy here rather than
 * extracted because the offramp route is the only other caller and
 * inlining keeps each route self-contained for easier audit.
 */
async function generateCoinbaseJwt(
  method: string,
  host: string,
  path: string,
): Promise<string> {
  const keyId = process.env.COINBASE_CDP_API_KEY_NAME;
  const secret = process.env.COINBASE_CDP_API_KEY_PRIVATE;
  if (!keyId || !secret) {
    throw new Error('Coinbase CDP credentials are not configured');
  }

  const decoded = Buffer.from(secret, 'base64');
  if (decoded.length !== 64) {
    throw new Error(
      `Coinbase Ed25519 secret has unexpected length: ${decoded.length} bytes (expected 64)`,
    );
  }

  const privateKeyBytes = decoded.subarray(0, 32);
  const publicKeyBytes = decoded.subarray(32, 64);

  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: privateKeyBytes.toString('base64url'),
    x: publicKeyBytes.toString('base64url'),
  };

  const key = await importJWK(jwk, 'EdDSA');

  const now = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString('hex');

  const jwt = await new SignJWT({
    sub: keyId,
    iss: 'cdp',
    nbf: now,
    exp: now + 120, // 2 minutes
    uri: `${method} ${host}${path}`,
  })
    .setProtectedHeader({
      alg: 'EdDSA',
      kid: keyId,
      typ: 'JWT',
      nonce,
    })
    .sign(key);

  return jwt;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SessionTokenRequestBody;
    const { walletAddress, presetFiatAmount, partnerUserId, redirectUrl } = body;

    // Validation
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
    if (presetFiatAmount !== undefined) {
      if (typeof presetFiatAmount !== 'number' || presetFiatAmount <= 0) {
        return NextResponse.json(
          { error: 'presetFiatAmount must be a positive number' },
          { status: 400 },
        );
      }
      // Coinbase guest checkout has a $5 minimum / $500/week cap.
      // Reject obvious abuse here; soft-fails (e.g. user buying $4 of basil)
      // get a clearer client-side message before we even hit this route.
      if (presetFiatAmount < 1) {
        return NextResponse.json(
          { error: 'presetFiatAmount must be at least $1' },
          { status: 400 },
        );
      }
    }

    // Sign the request
    let jwt: string;
    try {
      jwt = await generateCoinbaseJwt('POST', COINBASE_API_HOST, SESSION_TOKEN_PATH);
    } catch (err) {
      console.error('[coinbase-onramp-session] JWT signing failed:', err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Failed to sign Coinbase request',
        },
        { status: 500 },
      );
    }

    // Call Coinbase to mint session token. Body matches the offramp route —
    // session-token API is symmetric (buy and sell use the same payload;
    // direction is implied by the destination URL we send the user to).
    const cbResponse = await fetch(
      `https://${COINBASE_API_HOST}${SESSION_TOKEN_PATH}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addresses: [{ address: walletAddress, blockchains: ['base'] }],
          assets: ['USDC'],
        }),
      },
    );

    if (!cbResponse.ok) {
      const errText = await cbResponse.text().catch(() => 'unknown');
      console.error(
        '[coinbase-onramp-session] Coinbase API error:',
        cbResponse.status,
        errText,
      );
      return NextResponse.json(
        {
          error: `Coinbase API error (${cbResponse.status})`,
          detail: errText.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const data = (await cbResponse.json()) as { token?: string };
    if (!data.token) {
      console.error('[coinbase-onramp-session] no token in response:', data);
      return NextResponse.json(
        { error: 'Coinbase returned no session token' },
        { status: 502 },
      );
    }

    // Build the final Onramp URL. Pre-select USDC on Base so the buyer
    // doesn't have to pick — they only see "$X with card / Apple Pay".
    const params = new URLSearchParams({
      sessionToken: data.token,
      defaultAsset: 'USDC',
      defaultNetwork: 'base',
    });
    if (presetFiatAmount && presetFiatAmount > 0) {
      // Round to 2 decimals — Coinbase rejects more precision on USD
      params.set('presetFiatAmount', presetFiatAmount.toFixed(2));
    }
    if (partnerUserId) {
      // Privy IDs can contain colons and exceed Coinbase's 49-char limit
      params.set('partnerUserId', partnerUserId.slice(0, 49));
    }
    if (redirectUrl) {
      params.set('redirectUrl', redirectUrl);
    }

    const url = `${ONRAMP_URL_BASE}?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[coinbase-onramp-session] unexpected error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
