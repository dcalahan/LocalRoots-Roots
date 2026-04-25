/**
 * Mint a Coinbase Offramp session token for a seller's wallet.
 *
 * Flow:
 *   1. Frontend POSTs { walletAddress, presetCryptoAmount? } here when seller clicks "Cash Out"
 *   2. We sign a JWT with our Coinbase CDP API key (Ed25519, EdDSA algorithm)
 *   3. We POST to Coinbase's session token endpoint with the JWT
 *   4. Coinbase returns a session token bound to that wallet
 *   5. We build the final Offramp URL with the session token and return it
 *   6. Frontend opens the URL in a popup
 *
 * Env vars (server-side only):
 *   - COINBASE_CDP_API_KEY_NAME     UUID of the API key
 *   - COINBASE_CDP_API_KEY_PRIVATE  base64-encoded Ed25519 secret (64 bytes)
 *   - NEXT_PUBLIC_COINBASE_PROJECT_ID  the CDP project ID (also used client-side for branding)
 *
 * Plan: ~/.claude/plans/mainnet-launch-1-2-weeks.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importJWK } from 'jose';
import { randomBytes } from 'crypto';

const COINBASE_API_HOST = 'api.developer.coinbase.com';
const SESSION_TOKEN_PATH = '/onramp/v1/token';
const OFFRAMP_URL_BASE = 'https://pay.coinbase.com/v3/sell/input';

interface SessionTokenRequestBody {
  walletAddress?: string;
  /** Optional pre-fill amount in USDC. User can edit on Coinbase. */
  presetCryptoAmount?: number;
  /** Optional Privy ID for partnerUserId tracking on Coinbase side. */
  partnerUserId?: string;
}

/**
 * Build a JWT for authenticating to Coinbase's CDP API.
 * Uses Ed25519 / EdDSA per the API key format from CDP.
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

  // Coinbase Ed25519 secret format: 64 bytes total when base64-decoded.
  // First 32 bytes = private key seed, last 32 bytes = public key.
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

  // Coinbase JWT format per docs: https://docs.cdp.coinbase.com/api-reference/v2/authentication
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
    const { walletAddress, presetCryptoAmount, partnerUserId } = body;

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

    // Sign the request
    let jwt: string;
    try {
      jwt = await generateCoinbaseJwt('POST', COINBASE_API_HOST, SESSION_TOKEN_PATH);
    } catch (err) {
      console.error('[coinbase-offramp-session] JWT signing failed:', err);
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

    // Call Coinbase to mint session token
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
        '[coinbase-offramp-session] Coinbase API error:',
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
      console.error('[coinbase-offramp-session] no token in response:', data);
      return NextResponse.json(
        { error: 'Coinbase returned no session token' },
        { status: 502 },
      );
    }

    // Build the final Offramp URL with session token
    const params = new URLSearchParams({ sessionToken: data.token });
    if (presetCryptoAmount && presetCryptoAmount > 0) {
      params.set('presetCryptoAmount', presetCryptoAmount.toString());
    }
    if (partnerUserId) {
      // Truncate Privy IDs that contain colons (they may exceed Coinbase's limit)
      params.set('partnerUserId', partnerUserId.slice(0, 49));
    }

    const url = `${OFFRAMP_URL_BASE}?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[coinbase-offramp-session] unexpected error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
