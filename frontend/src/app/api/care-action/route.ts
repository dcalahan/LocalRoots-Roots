/**
 * /api/care-action — manual logging of care actions a user performed in
 * real life, outside the existing care-alert dismissal flow.
 *
 * Doug's complaint (May 18 2026): "I pruned my tomatoes; Sage said I'd
 * earn 15 RP; I earned nothing." The existing `care-alert-acted-on`
 * verb only fired when the user dismissed an urgent in-app alert. If
 * the alert wasn't currently active (or the user pruned without opening
 * the app first), no credit. That mismatched the user mental model
 * Sage was promoting.
 *
 * Fix: this endpoint lets the user log an action directly from the
 * plant card. We validate that the crop actually supports the action
 * (per `crop-growing-data.json` — e.g. "Pruned" only credits on crops
 * with pruning rules, so the user can't fire it on a carrot), then
 * fire the same verb that the alert-dismissal path uses. Dedup key is
 * `{plantId}:{action}:{YYYY-MM-DD}` so the same plant+action can only
 * earn once per UTC day. The verb's existing dailyCap (5/day on
 * care-alert-acted-on) is the ceiling — even a user with 20 plants
 * can't earn more than 5 × 15 = 75 RP/day from manual care logging.
 *
 * This sits alongside `/api/care-dismissals` (which handles the in-app
 * alert dismissal path) — both fire the same verbs. They use different
 * dedup keys (alertId vs. date-based), so a user who happens to both
 * dismiss an alert AND log the same action manually on the same day
 * COULD double-earn. Acceptable for v1 because the verb's dailyCap
 * still bounds the worst case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { credit, type VerbId } from '@/lib/offchainRP';
import { getIpGeoFromRequest } from '@/lib/ipGeo';
import cropDataJson from '@/data/crop-growing-data.json';

type CareAction = 'prune' | 'bolt-mgmt';

interface CropEntry {
  pruning?: unknown;
  bolting?: unknown;
}

/** Action → which off-chain verb fires when the user logs it. */
const ACTION_TO_VERB: Record<CareAction, VerbId> = {
  prune: 'care-alert-acted-on',
  'bolt-mgmt': 'care-alert-acted-on',
};

/** Action → which field in crop-growing-data.json must exist for the
 *  action to be eligible. Prevents the user firing "Pruned" on a carrot. */
const ACTION_TO_REQUIRED_RULE: Record<CareAction, keyof CropEntry> = {
  prune: 'pruning',
  'bolt-mgmt': 'bolting',
};

interface CropDataJson {
  crops: Record<string, CropEntry>;
}

function isCareAction(value: unknown): value is CareAction {
  return value === 'prune' || value === 'bolt-mgmt';
}

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { plantId, cropId, action } = (body ?? {}) as {
    plantId?: unknown;
    cropId?: unknown;
    action?: unknown;
  };

  if (typeof plantId !== 'string' || !plantId) {
    return NextResponse.json({ error: 'plantId required' }, { status: 400 });
  }
  if (typeof cropId !== 'string' || !cropId) {
    return NextResponse.json({ error: 'cropId required' }, { status: 400 });
  }
  if (!isCareAction(action)) {
    return NextResponse.json(
      { error: 'action must be one of: prune, bolt-mgmt' },
      { status: 400 },
    );
  }

  // Validate the crop actually supports this action. Looks up the crop
  // in crop-growing-data.json and checks for the required rule field.
  // Custom varieties (e.g. "tomato-cherry-sungold") aren't in the JSON;
  // they fall back to the parent crop ID. Strip everything after the
  // second hyphen to get the parent. (e.g., "tomato-cherry-sungold" →
  // "tomato-cherry".) For now, just try the exact ID; if missing, try
  // splitting and looking up the parent.
  const crops = (cropDataJson as CropDataJson).crops;
  const requiredRule = ACTION_TO_REQUIRED_RULE[action];

  const cropEntry =
    crops[cropId] ??
    crops[cropId.split('-').slice(0, 2).join('-')] ??
    null;

  if (!cropEntry || !cropEntry[requiredRule]) {
    return NextResponse.json(
      {
        error: `Crop "${cropId}" doesn't have ${requiredRule} rules — no RP for this action.`,
        ineligible: true,
      },
      { status: 400 },
    );
  }

  // Fire the credit. Dedup key = plantId + action + UTC date; one credit
  // per plant per action per day. The verb's dailyCap (5) is the real
  // anti-gaming ceiling.
  const today = new Date().toISOString().slice(0, 10);
  const dedupKey = `${plantId}:${action}:${today}`;
  const verbId = ACTION_TO_VERB[action];
  const ipMeta = getIpGeoFromRequest(request);

  const result = await credit(verbId, userId, dedupKey, { ipMeta });

  if (!result.ok) {
    console.error('[care-action] credit failed:', result.error);
    return NextResponse.json(
      { error: 'Credit failed', detail: result.error },
      { status: 500 },
    );
  }

  if (result.credited) {
    return NextResponse.json({
      ok: true,
      credited: 1,
      rpAmount: result.rpAmount,
      newTotal: result.newTotal,
      cappedCount: 0,
      eventId: result.eventId,
    });
  }

  // Non-credit outcomes: duplicate (already logged today), daily-cap,
  // lifetime-cap, not-live, or anonymous. Surface enough info for the
  // client to render the right toast or quiet inline state.
  return NextResponse.json({
    ok: true,
    credited: 0,
    rpAmount: 0,
    newTotal: 0,
    cappedCount: result.reason === 'daily-cap' ? 1 : 0,
    cappedVerbs: result.reason === 'daily-cap' ? [verbId] : undefined,
    reason: result.reason,
  });
}
