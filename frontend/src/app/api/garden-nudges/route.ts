/**
 * /api/garden-nudges — durable, cross-device store for Proactive Sage's
 * nudge queue. Mirrors the careDismissals route pattern.
 *
 * GET  ?userId=...                 → { version, nudges }
 * POST ?userId=... body { queue }  → persist the queue (TTL-pruned) → { ok }
 *
 * The CLIENT (lib/sageNudges.ts via GardenAIChat) owns the computation:
 * it detects due care alerts, applies the anti-nag gates, and writes the
 * resulting queue here. The server's job is durability + cross-device
 * (a nudge enqueued on the laptop shows on the phone) + a TTL prune so
 * the value can't grow unbounded.
 *
 * Stored at `garden:nudges:{userId}`. This key is INDEPENDENT of
 * `garden:conv:{userId}` — a SAGE_BRAIN_VERSION bump wipes the
 * conversation but NEVER this queue. That's the whole point: pending
 * nudges survive Sage upgrades.
 *
 * This route credits NO Roots Points and opens no earning surface — it's
 * pure delivery state. Acting on a nudge goes through the existing
 * /api/care-dismissals + /api/care-action paths, which carry the RP dedup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { NUDGE_QUEUE_VERSION, type NudgeQueue, type SageNudge } from '@/lib/sageNudges';

const TTL_DAYS = 14;

function key(userId: string): string {
  return `garden:nudges:${userId}`;
}

function emptyQueue(): NudgeQueue {
  return { version: NUDGE_QUEUE_VERSION, nudges: [] };
}

/** Drop aged-out / expired nudges. Plant-existence pruning happens
 *  client-side (the server doesn't have the live garden). */
function pruneByAge(queue: NudgeQueue, now = Date.now()): NudgeQueue {
  const cutoff = now - TTL_DAYS * 86400000;
  const nudges = queue.nudges.filter((n) => {
    if (n.status === 'expired') return false;
    const created = new Date(n.createdAt).getTime();
    return isNaN(created) || created >= cutoff;
  });
  return { version: NUDGE_QUEUE_VERSION, nudges };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) return NextResponse.json(emptyQueue());
  try {
    const data = await kv.get<NudgeQueue>(key(userId));
    if (!data || data.version !== NUDGE_QUEUE_VERSION || !Array.isArray(data.nudges)) {
      return NextResponse.json(emptyQueue());
    }
    return NextResponse.json(pruneByAge(data));
  } catch (err) {
    console.error('[garden-nudges GET] error:', err);
    return NextResponse.json(emptyQueue());
  }
}

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const incoming = body?.queue as NudgeQueue | undefined;
    if (!incoming || !Array.isArray(incoming.nudges)) {
      return NextResponse.json({ error: 'queue with nudges[] required' }, { status: 400 });
    }
    // Defensive shape check — only persist well-formed nudges.
    const clean: SageNudge[] = incoming.nudges.filter(
      (n): n is SageNudge =>
        !!n &&
        typeof n.id === 'string' &&
        typeof n.plantId === 'string' &&
        typeof n.text === 'string',
    );
    const pruned = pruneByAge({ version: NUDGE_QUEUE_VERSION, nudges: clean });
    await kv.set(key(userId), pruned);
    return NextResponse.json({ ok: true, count: pruned.nudges.length });
  } catch (err) {
    console.error('[garden-nudges POST] error:', err);
    return NextResponse.json({ error: 'Failed to save nudge queue' }, { status: 500 });
  }
}
