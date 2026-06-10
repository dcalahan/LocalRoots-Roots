/**
 * Partner profile endpoint — Cypress Marsh Garden Supplies (and any
 * future partner that needs to look up a gardener for printing /
 * personalization).
 *
 *   GET /api/v1/partner/growers/{grower_id}
 *   Authorization: Bearer <PARTNER_API_KEY_CYPRESS_MARSH>
 *
 * `{grower_id}` is a URL-encoded Privy DID — e.g.
 * `did%3Aprivy%3Acmazyy123`. The partner gets it from the JWT `sub` claim
 * issued by `/api/sage/label-link`.
 *
 * Resolution flow:
 *   1. Privy DID → public gardener profile (KV `garden-profile:{userId}`)
 *   2. Privy DID → wallet address (Privy Management API)
 *   3. wallet → on-chain sellerId via marketplace.sellerIdByOwner()
 *   4. sellerId > 0 → return `/buy/sellers/{N}` (permanent URL, safe for print)
 *      sellerId == 0 AND opted-in gardener → return `/gardeners/{userId}` (stable while opted in)
 *      neither → 404
 *
 * Response shape locked with Doug, June 4 2026 — `lr_profile_version: 1`.
 * Bump that field if anything material about the response changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePartnerAuth } from '@/lib/partnerAuth';
import { getProfile } from '@/lib/gardenProfileStore';
import { getPrivyEmbeddedWallet } from '@/lib/privyManagement';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { kv } from '@/lib/kv';

const ENV_VAR = 'PARTNER_API_KEY_CYPRESS_MARSH';
const SITE_BASE = 'https://www.localroots.love';
const RATE_LIMIT_PER_MIN = 120;

interface SuccessResponse {
  grower_id: string;
  display_name: string;
  garden_name: string;
  bio: string | null;
  profile_slug: null;            // reserved for future LR slug support
  profile_url: string;
  profile_kind: 'seller' | 'gardener';
  city: string | null;
  state: string | null;
  country: 'US' | null;
  avatar_url: string | null;
  is_opted_in_public: boolean;
  lr_profile_version: 1;
}

/** Split `"Hilton Head, SC"` → `{ city: 'Hilton Head', state: 'SC' }`. */
function splitLocationLabel(label: string | undefined): { city: string | null; state: string | null } {
  if (!label) return { city: null, state: null };
  const m = label.match(/^(.+?),\s*([A-Z]{2})\b/);
  if (!m) return { city: label, state: null };
  return { city: m[1].trim(), state: m[2] };
}

/** Per-key per-minute rate limit. KV read-modify-write — race-tolerant. */
async function checkRateLimit(key: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const minute = Math.floor(Date.now() / 60000);
  const k = `partner:ratelimit:${key}:${minute}`;
  try {
    const current = (await kv.get<number>(k)) ?? 0;
    if (current >= RATE_LIMIT_PER_MIN) {
      // Seconds remaining until the minute rolls over
      const retryAfter = 60 - Math.floor((Date.now() % 60000) / 1000);
      return { ok: false, retryAfter };
    }
    await kv.set(k, current + 1);
    return { ok: true };
  } catch {
    // KV failure shouldn't take the endpoint down; let it through.
    return { ok: true };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grower_id: string }> },
): Promise<NextResponse> {
  // 1. Bearer auth (fail-closed if env var missing).
  const auth = requirePartnerAuth(request, ENV_VAR);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // 2. Rate limit per token.
  const headerToken = request.headers.get('authorization')?.split(/\s+/)[1] ?? 'unknown';
  // Use just a short prefix as the rate-limit bucket key — never log full token.
  const rateLimitKey = headerToken.slice(0, 12);
  const rl = await checkRateLimit(rateLimitKey);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  // 3. Parse grower_id (URL-encoded Privy DID).
  const { grower_id: rawId } = await params;
  let growerId: string;
  try {
    growerId = decodeURIComponent(rawId);
  } catch {
    return NextResponse.json({ error: 'invalid_grower_id' }, { status: 400 });
  }
  if (!growerId.startsWith('did:privy:')) {
    return NextResponse.json({ error: 'invalid_grower_id' }, { status: 400 });
  }

  // 4. Look up the gardener profile (opt-in public directory).
  const profile = await getProfile(growerId);
  const optedInPublic = !!profile && !profile.hidden;

  // 5. Resolve wallet → sellerId. Either step can fail; we tolerate.
  let sellerId = 0n;
  const wallet = await getPrivyEmbeddedWallet(growerId);
  if (wallet) {
    try {
      const client = createFreshPublicClient();
      const result = (await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'sellerIdByOwner',
        args: [wallet],
      })) as bigint;
      sellerId = result;
    } catch (err) {
      console.warn('[partner/growers] sellerIdByOwner read failed:', err);
    }
  }

  // 6. Decide URL form, or 404 if eligible for neither.
  let profileKind: 'seller' | 'gardener';
  let profileUrl: string;
  if (sellerId > 0n) {
    profileKind = 'seller';
    profileUrl = `${SITE_BASE}/buy/sellers/${sellerId.toString()}`;
  } else if (optedInPublic) {
    profileKind = 'gardener';
    profileUrl = `${SITE_BASE}/gardeners/${encodeURIComponent(growerId)}`;
  } else {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 7. Shape the response. Seller-only case (no public profile) still works
  //    — we return null/empty for the gardener-derived fields and the
  //    label store knows enough to render the QR target.
  const { city, state } = splitLocationLabel(profile?.locationLabel);
  const body: SuccessResponse = {
    grower_id: growerId,
    display_name: profile?.displayName ?? '',
    // Single-name principle (CLAUDE.md): garden_name === display_name.
    garden_name: profile?.displayName ?? '',
    bio: profile?.bio ?? null,
    profile_slug: null,
    profile_url: profileUrl,
    profile_kind: profileKind,
    city,
    state,
    country: state ? 'US' : null,
    avatar_url: profile?.profilePhotoUrl ?? null,
    is_opted_in_public: optedInPublic,
    lr_profile_version: 1,
  };

  return NextResponse.json(body);
}
