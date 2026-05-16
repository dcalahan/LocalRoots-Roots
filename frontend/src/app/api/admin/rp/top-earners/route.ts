/**
 * GET /api/admin/rp/top-earners?adminAddress=0x...&limit=50&offset=0
 *
 * Returns the top N users by total off-chain RP. Admin-only.
 *
 * Reads from the pre-built `rp:admin:index:top-earners` index. The
 * index is rebuilt every 5 minutes by the rp-index cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAddress } from '@/lib/adminAuth';
import { readTopEarners, readIndexMeta } from '@/lib/adminRPIndex';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminAddress = searchParams.get('adminAddress');

  if (!(await isAdminAddress(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  try {
    const [earners, meta] = await Promise.all([
      readTopEarners(limit, offset),
      readIndexMeta(),
    ]);
    return NextResponse.json({ earners, meta });
  } catch (err) {
    console.error('[admin/rp/top-earners] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Read failed' },
      { status: 500 },
    );
  }
}
