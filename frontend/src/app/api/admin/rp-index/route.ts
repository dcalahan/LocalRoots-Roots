/**
 * /api/admin/rp-index — cron job that builds admin RP indexes.
 *
 * Vercel Cron fires this every 5 minutes (configured in vercel.json).
 * Reads `rp:offchain:*` KV namespace, builds purpose-shaped indexes at
 * `rp:admin:index:*` for the admin UI to read with sub-100ms latency.
 *
 * Two access paths:
 *
 *   GET /api/admin/rp-index
 *     Vercel Cron hits this — Vercel signs with the CRON_SECRET header
 *     in the `Authorization: Bearer <secret>` form. If CRON_SECRET env
 *     is set we verify; otherwise we allow (for local dev).
 *
 *   GET /api/admin/rp-index?force=true&adminAddress=0x...
 *     Manual trigger from the admin UI's "Refresh now" button. Requires
 *     adminAddress to be in the marketplace's isAdmin mapping.
 *
 * Returns the IndexMeta record from the build.
 *
 * Design notes:
 * - No POST surface — cron + admin-button only.
 * - Long-running by web-route standards (KV scan + writes). Cap by the
 *   `maxDuration` setting; bump if it gets close to the wall.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildAdminRPIndexes } from '@/lib/adminRPIndex';
import { isAdminAddress } from '@/lib/adminAuth';

// Vercel function config — cron jobs can run longer than user-facing routes.
// Phase 1 target: <30s. If the namespace grows, revisit.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  const adminAddress = searchParams.get('adminAddress');

  // ── Auth ─────────────────────────────────────────────────────
  // Path 1: Vercel Cron — `Authorization: Bearer ${CRON_SECRET}`
  // Path 2: Admin manual trigger — `?adminAddress=0x...&force=true`
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCronCall = cronSecret
    ? authHeader === `Bearer ${cronSecret}`
    : !force; // dev fallback: if no CRON_SECRET, treat any non-force call as cron

  let authPath: 'cron' | 'admin' | 'denied' = 'denied';
  if (isCronCall) {
    authPath = 'cron';
  } else if (force && adminAddress && (await isAdminAddress(adminAddress))) {
    authPath = 'admin';
  }

  if (authPath === 'denied') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // ── Build ────────────────────────────────────────────────────
  try {
    const meta = await buildAdminRPIndexes();
    console.log(
      `[admin/rp-index] ${authPath} run: ${meta.eventCount} events, ${meta.userCount} users, ${meta.durationMs}ms`,
    );
    return NextResponse.json({ ok: true, meta, triggeredBy: authPath });
  } catch (err) {
    console.error('[admin/rp-index] build failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Build failed' },
      { status: 500 },
    );
  }
}
