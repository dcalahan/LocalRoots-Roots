/**
 * GET /api/admin/rp/recent?adminAddress=0x...&limit=100&offset=0
 *
 * Returns the most recent off-chain RP credit events across all users.
 * Admin-only — gated by isAdminAddress on the marketplace contract.
 *
 * Reads from the pre-built `rp:admin:index:recent-events` index. The
 * index is rebuilt every 5 minutes by /api/admin/rp-index cron. So data
 * here can be up to ~5 minutes stale — the admin UI shows a "Last
 * updated Nm ago" indicator from the same meta record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAddress } from '@/lib/adminAuth';
import { readRecentEvents, readIndexMeta } from '@/lib/adminRPIndex';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminAddress = searchParams.get('adminAddress');

  if (!(await isAdminAddress(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  try {
    const [events, meta] = await Promise.all([
      readRecentEvents(limit, offset),
      readIndexMeta(),
    ]);
    return NextResponse.json({ events, meta });
  } catch (err) {
    console.error('[admin/rp/recent] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Read failed' },
      { status: 500 },
    );
  }
}
