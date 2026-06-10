/**
 * Sage → Cypress Marsh label-store deep link mint.
 *
 *   POST /api/sage/label-link
 *   Body: { userId: "did:privy:..." }
 *
 * Mints an HS256 JWT carrying the Privy DID as `sub`, returns the
 * fully-formed label-store URL. The label store verifies the JWT against
 * the same shared secret (`LABEL_STORE_JWT_SECRET`), then fetches the
 * gardener via the partner endpoint.
 *
 * Auth model: no Bearer required. The mint is gated by gardener-eligibility
 * (the DID must already correspond to a registered seller or an opted-in
 * public gardener); unknown DIDs return 404 with a uniform error to prevent
 * enumeration. Rate-limited by IP to make scanning expensive.
 *
 * The resulting JWT is single-use: the label store stores its `jti` on
 * first redemption and rejects re-use within the 15-minute TTL.
 *
 * Curl-testable without Sage wiring:
 *   curl -sX POST https://www.localroots.love/api/sage/label-link \
 *     -H 'content-type: application/json' \
 *     -d '{"userId":"did:privy:cmazyy..."}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProfile } from '@/lib/gardenProfileStore';
import { getPrivyEmbeddedWallet } from '@/lib/privyManagement';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { mintLabelLink } from '@/lib/labelLinkJwt';
import { kv } from '@/lib/kv';

const RATE_LIMIT_PER_MIN = 20;

function getClientIp(req: NextRequest): string {
  // x-forwarded-for is the right signal on Vercel (CDN-front).
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

async function checkRateLimit(ip: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const minute = Math.floor(Date.now() / 60000);
  const k = `sage:label-link:rate:${ip}:${minute}`;
  try {
    const current = (await kv.get<number>(k)) ?? 0;
    if (current >= RATE_LIMIT_PER_MIN) {
      const retryAfter = 60 - Math.floor((Date.now() % 60000) / 1000);
      return { ok: false, retryAfter };
    }
    await kv.set(k, current + 1);
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Rate limit by client IP.
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  // 2. Parse body.
  let userId: string;
  try {
    const body = (await request.json()) as { userId?: unknown };
    if (typeof body?.userId !== 'string' || !body.userId.startsWith('did:privy:')) {
      return NextResponse.json({ error: 'invalid_user_id' }, { status: 400 });
    }
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // 3. Eligibility check — DID must correspond to either a registered
  //    seller or an opted-in public gardener. Same 404 for both negative
  //    cases (no enumeration signal).
  const profile = await getProfile(userId);
  const optedInPublic = !!profile && !profile.hidden;

  let isSeller = false;
  const wallet = await getPrivyEmbeddedWallet(userId);
  if (wallet) {
    try {
      const client = createFreshPublicClient();
      const sellerId = (await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'sellerIdByOwner',
        args: [wallet],
      })) as bigint;
      isSeller = sellerId > 0n;
    } catch (err) {
      console.warn('[sage/label-link] sellerIdByOwner read failed:', err);
    }
  }

  if (!isSeller && !optedInPublic) {
    return NextResponse.json({ error: 'not_eligible' }, { status: 404 });
  }

  // 4. Mint.
  const minted = await mintLabelLink(userId);
  if (!minted) {
    return NextResponse.json(
      { error: 'mint_unavailable' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: minted.url,
    expiresAt: new Date(minted.expiresAt * 1000).toISOString(),
    jti: minted.jti,
  });
}
