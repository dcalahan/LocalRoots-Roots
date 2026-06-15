/**
 * /api/harvest-log — manual logging of a harvest event from the plant card UI.
 *
 * Mirrors the /api/care-action pattern. The user taps "Log harvest" on a
 * plant card; this endpoint fires the harvest-logged RP credit and returns
 * the new state. The actual HarvestEvent is appended to the plant in the
 * client's useMyGarden state (which then syncs through the next PUT to
 * /api/my-garden) — same pattern as how the chat flow works.
 *
 * Doug, Jun 15 2026: this is the second trigger surface for harvest-logged
 * (the first is the my-garden PUT diff that fires on new HarvestEvent
 * entries appended via Sage's mark_harvested action). Both use the same
 * dedup key shape {plantId}:harvest:{YYYY-MM-DD} so a user who logs via
 * chat AND via the pill on the same day collapses to ONE credit.
 *
 * Rate-limit-by-day is enforced by the verb's dailyCap (5/day) plus the
 * per-plant-per-day dedup at the credit layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { credit } from '@/lib/offchainRP';
import { getIpGeoFromRequest } from '@/lib/ipGeo';

interface LogHarvestBody {
  userId?: string;
  plantId?: string;
  date?: string; // ISO date — defaults to today UTC if missing
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: LogHarvestBody;
  try {
    body = (await request.json()) as LogHarvestBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { userId, plantId } = body;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  if (!plantId || typeof plantId !== 'string') {
    return NextResponse.json({ error: 'plantId required' }, { status: 400 });
  }

  const date = body.date || new Date().toISOString();
  const day = date.slice(0, 10);
  const dedupKey = `${plantId}:harvest:${day}`;
  const ipMeta = getIpGeoFromRequest(request);

  const result = await credit('harvest-logged', userId, dedupKey, { ipMeta });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    credited: result.credited,
    rpAmount: result.credited ? result.rpAmount : 0,
    newTotal: result.credited ? result.newTotal : undefined,
    reason: result.credited ? undefined : result.reason,
    dedupKey,
  });
}
