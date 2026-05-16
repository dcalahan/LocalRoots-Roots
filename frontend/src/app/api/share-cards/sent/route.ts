/**
 * /api/share-cards/sent — record a share-card send event for Roots Points.
 *
 * POST body: { userId: string, cardType: string, target?: string }
 *
 * Fires the `share-card-sent` off-chain RP verb (5 RP per share, 10/day cap).
 * Dedup key uses cardType + day, so spamming the same card hits the cap fast.
 *
 * This endpoint is fire-and-forget from the client — ShareCardModal POSTs
 * after a successful share (Web Share API resolved, OR clipboard copy).
 * If the share itself fails, the client doesn't POST. If the POST fails,
 * the share still happened — RP credit is non-blocking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { credit } from '@/lib/offchainRP';
import { getIpGeoFromRequest } from '@/lib/ipGeo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const { userId, cardType, target } = (body || {}) as {
      userId?: string;
      cardType?: string;
      target?: string;
    };

    if (!userId || !cardType) {
      return NextResponse.json(
        { error: 'userId and cardType required' },
        { status: 400 },
      );
    }

    // Dedup key: same cardType on the same day collapses to one credit
    // attempt. The verb's daily cap (10/day) further limits abuse.
    // Including `target` (e.g., 'facebook', 'instagram', 'sms') gives a
    // little finer granularity — sharing the same card on FB vs. SMS
    // counts as two events, but spamming FB only counts once per day.
    const today = new Date().toISOString().slice(0, 10);
    const dedupKey = `${cardType}:${target || 'any'}:${today}`;

    const result = await credit('share-card-sent', userId, dedupKey, {
      ipMeta: getIpGeoFromRequest(request),
    });
    return NextResponse.json({
      ok: true,
      credited: result.ok && result.credited,
      rpAmount: result.ok && result.credited ? result.rpAmount : 0,
      newTotal: result.ok && result.credited ? result.newTotal : undefined,
    });
  } catch (err) {
    console.error('[share-cards/sent] error:', err);
    return NextResponse.json({ ok: true, credited: false }, { status: 200 });
  }
}
