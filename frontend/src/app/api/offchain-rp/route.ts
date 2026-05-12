/**
 * Off-chain Roots Points read endpoint.
 *
 * GET /api/offchain-rp?userId=<userKey>
 *
 * Returns the user's UserRPSummary { total, lastUpdated, byVerb }. Read-only;
 * no side effects. Used by the client-side useOffchainRP() hook to render
 * the header RootsPointsPill and the "Your Roots Points" section on
 * /profile.
 *
 * userId here is the same string passed to credit() — typically a Privy
 * user DID (`did:privy:...`) but the library accepts wallet addresses too.
 * The key is normalized to lowercase inside getUserSummary().
 *
 * Returns a zero-valued summary (not 404) for users who've never earned
 * off-chain RP, so the client doesn't need to special-case the empty path.
 *
 * Not authenticated. Off-chain RP totals are not sensitive — they're an
 * aggregate of public-ish actions (added a plant, etc.). The audit records
 * at rp:offchain:event:{eventId} contain more detail but aren't exposed
 * here. If we later want privacy on the totals, this is the surface to add
 * a signature check on.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserSummary } from '@/lib/offchainRP';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json(
      { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {} },
    );
  }

  try {
    const summary = await getUserSummary(userId);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[offchain-rp] read failed:', err);
    // Mirror the my-garden pattern: a read failure shouldn't break the
    // page render. Return a zero-valued summary; client sees "0 RP" and
    // can retry.
    return NextResponse.json(
      { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {} },
      { status: 200 },
    );
  }
}
