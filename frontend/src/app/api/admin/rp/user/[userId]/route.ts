/**
 * GET /api/admin/rp/user/[userId]?adminAddress=0x...
 *
 * Returns a single user's RP detail: totals, by-verb breakdown, recent
 * events (last 50), and 7-day daily-counter snapshot. Admin-only.
 *
 * Reads from the pre-built `rp:admin:index:user:{userId}` index.
 * Falls back to a "not in index" 404 if the user hasn't appeared yet —
 * the admin UI handles that case by showing "no activity for this user
 * (or index is stale)."
 *
 * The userId path param can be either:
 *   - Privy DID: `did:privy:cmxxx...`
 *   - Wallet address: `0x...`
 * Index is keyed by lowercased userId; we match by that.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAddress } from '@/lib/adminAuth';
import { readUserDetail } from '@/lib/adminRPIndex';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const adminAddress = searchParams.get('adminAddress');

  if (!(await isAdminAddress(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  // userId comes URL-encoded (because Privy DIDs contain colons).
  // Next.js decodes path params automatically, but be defensive.
  const decoded = decodeURIComponent(userId);

  try {
    const detail = await readUserDetail(decoded);
    if (!detail) {
      return NextResponse.json(
        { error: 'User not found in current index (may not have earned RP yet, or index is stale)' },
        { status: 404 },
      );
    }
    return NextResponse.json({ detail });
  } catch (err) {
    console.error('[admin/rp/user/[userId]] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Read failed' },
      { status: 500 },
    );
  }
}
