/**
 * /api/care-dismissals — server mirror of UI dismissal state.
 *
 * GET ?userId=... → { dismissals: { [alertId]: ISO-date } }
 *   (used by garden-brain.ts when loading Sage's context)
 *
 * POST ?userId=... body { alertId: string } | { alertIds: string[] }
 *   (called by GardenPlantCard's "Done" button and useMyGarden's
 *   mark_pruned / mark_bolting / dismiss_care_alert handlers)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadServerDismissals,
  recordDismissals,
} from '@/lib/careDismissals';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json({ dismissals: {} });
  try {
    const dismissals = await loadServerDismissals(userId);
    return NextResponse.json({ dismissals });
  } catch (err) {
    console.error('[care-dismissals GET] error:', err);
    return NextResponse.json({ dismissals: {} });
  }
}

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.alertIds)
      ? body.alertIds.filter((s: unknown): s is string => typeof s === 'string')
      : typeof body.alertId === 'string'
        ? [body.alertId]
        : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'alertId or alertIds required' },
        { status: 400 },
      );
    }
    await recordDismissals(userId, ids);

    // Credit care-alert-acted-on for any urgent-severity alerts dismissed.
    // AlertId format is `${plantId}:${type}:${cycle}` (see careAlerts.ts).
    //
    // BUG FIXED May 25 2026: Earlier this filter expected exact-match types
    // like `prune-now` / `harvest-urgent`. But the CLIENT alertId
    // construction in careAlerts.ts uses different names:
    //   - Pruning: `prune-${rule.type}` (e.g., prune-sucker, prune-pinch-top,
    //     prune-cutback) — NEVER `prune-now`/`prune-overdue`
    //   - Harvest: `harvest-ready` — NEVER `harvest-urgent`
    //   - Bolting: `bolting` / `bolt-risk` ✓ (these matched)
    // Net effect: pruning + ready-to-harvest dismissals NEVER credited RP.
    // Doug surfaced this when his tomato sucker dismissal stayed at 470 RP.
    // Fix: match against the actual alertId types the client emits.
    const URGENT_EXACT = new Set([
      'bolting',
      'bolt-risk',
      'harvest-ready',
      'frost-warning',
      'heat-wave',
    ]);
    const urgentIds = ids.filter(id => {
      const parts = id.split(':');
      if (parts.length < 2) return false;
      const type = parts[1];
      // Exact-match the known urgent types, OR any prune-* variant
      // (prune-pinch-top, prune-sucker, prune-cutback, etc.).
      return URGENT_EXACT.has(type) || type.startsWith('prune-');
    });
    if (urgentIds.length > 0) {
      const [{ credit }, { getIpGeoFromRequest }] = await Promise.all([
        import('@/lib/offchainRP'),
        import('@/lib/ipGeo'),
      ]);
      const ipMeta = getIpGeoFromRequest(request);
      for (const alertId of urgentIds) {
        const result = await credit('care-alert-acted-on', userId, alertId, { ipMeta });
        if (result.ok && result.credited) {
          console.log('[care-dismissals] +15 RP care-alert-acted-on for', userId, alertId);
        }
      }
    }

    return NextResponse.json({ ok: true, recorded: ids.length });
  } catch (err) {
    console.error('[care-dismissals POST] error:', err);
    return NextResponse.json(
      { error: 'Failed to record dismissal' },
      { status: 500 },
    );
  }
}
