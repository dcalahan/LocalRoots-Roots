/**
 * Off-chain Roots Points read endpoint.
 *
 * GET /api/offchain-rp?userId=<userKey>
 *
 * Returns the user's UserRPSummary { total, lastUpdated, byVerb } plus
 * a `todayByVerb` map showing what they earned today per verb (for the
 * /profile "Today's Earnings" panel that cures the no-surprise cap UX
 * problem per the May 17 plan).
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
import { kv } from '@/lib/kv';
import { getUserSummary, VERBS, type VerbId } from '@/lib/offchainRP';

interface TodayByVerb {
  [verbId: string]: { count: number; rp: number };
}

/**
 * Read today's per-verb counts for a user by scanning the existing
 * `rp:offchain:daily:{address}:{verbId}:{YYYY-MM-DD}` keys. We don't
 * need a new index — the data is already there from the cap-enforcement
 * logic in credit().
 *
 * Reads in parallel via Promise.all (~one read per live verb) to keep
 * the profile-page load fast.
 */
async function readTodayByVerb(userId: string): Promise<TodayByVerb> {
  const today = new Date().toISOString().slice(0, 10);
  const address = userId.toLowerCase();
  const liveVerbs = Object.entries(VERBS)
    .filter(([, cfg]) => cfg.live)
    .map(([id]) => id as VerbId);

  const counts = await Promise.all(
    liveVerbs.map(async (verbId) => {
      const key = `rp:offchain:daily:${address}:${verbId}:${today}`;
      const count = (await kv.get<number>(key)) ?? 0;
      return { verbId, count };
    }),
  );

  const result: TodayByVerb = {};
  for (const { verbId, count } of counts) {
    if (count > 0) {
      const verb = VERBS[verbId];
      result[verbId] = { count, rp: count * verb.rpAmount };
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json(
      { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {}, todayByVerb: {} },
    );
  }

  try {
    const [summary, todayByVerb] = await Promise.all([
      getUserSummary(userId),
      readTodayByVerb(userId),
    ]);
    return NextResponse.json({ ...summary, todayByVerb });
  } catch (err) {
    console.error('[offchain-rp] read failed:', err);
    // Mirror the my-garden pattern: a read failure shouldn't break the
    // page render. Return a zero-valued summary; client sees "0 RP" and
    // can retry.
    return NextResponse.json(
      { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {}, todayByVerb: {} },
      { status: 200 },
    );
  }
}
