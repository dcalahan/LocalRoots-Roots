/**
 * Proactive Sage — nudge queue + voice templates.
 *
 * "Proactive Sage" lets Sage reach out FIRST with a warm care nudge
 * ("hey, your basil's ready for a pinch") instead of only ever
 * responding when the user opens the chat. This is the deepest
 * "make people love Sage" lever — a best friend texts YOU.
 *
 * v1 architecture (Doug-approved May 27 2026):
 *   - In-app only (badge on the floating Sage icon + a Sage-authored
 *     message waiting in the thread when the user opens her). No push.
 *   - Nudges live in a queue OUTSIDE the conversation thread
 *     (`garden:nudges:{userId}`), so a SAGE_BRAIN_VERSION bump — which
 *     wipes `garden:conv:{userId}` — does NOT wipe pending nudges.
 *   - Client-triggered on page load: this module's pickDueNudges()
 *     runs against the garden the client already has in memory,
 *     reusing detectCareAlerts(). No server cron in v1.
 *   - Reuses the EXISTING RP dedup: a nudge carries the canonical
 *     careAlerts alertId, so acting via the nudge hits the same
 *     `care-alert-acted-on` setnx event key as the plant card's
 *     "Done"/"Pruned" — no double-earn. This module opens NO new
 *     earning surface.
 *
 * No React, no network here — pure logic + localStorage helpers, in
 * the style of careAlerts.ts / careDismissals.ts. The API route
 * (api/garden-nudges) handles KV durability + cross-device.
 */

import type {
  GardenPlant,
  CareAlert,
  CareAlertType,
  CareAlertSeverity,
} from '@/types/my-garden';
import { detectCareAlerts } from './careAlerts';
import { getCropDisplayName } from './gardenStatus';

// ─── Types ─────────────────────────────────────────────────────────

export interface SageNudge {
  /** = CareAlert.id, the canonical alertId `{plantId}:{type}:{cycle}`.
   *  Matches the dismissals-map keys, which is what guarantees the
   *  no-double-earn + one-per-cycle properties for free. */
  id: string;
  alertType: CareAlertType;
  plantId: string;
  cropId: string;
  plantName: string;
  severity: CareAlertSeverity;
  /** The chosen in-voice opener Sage "texts" the user. */
  text: string;
  createdAt: string;
  /** Set when first rendered in an opened chat. null while waiting. */
  deliveredAt: string | null;
  status: 'pending' | 'delivered' | 'acted' | 'expired';
}

export interface NudgeQueue {
  /** Queue schema version — INDEPENDENT of SAGE_BRAIN_VERSION. A brain
   *  bump must never touch this; that's the whole point of the queue. */
  version: number;
  nudges: SageNudge[];
}

export const NUDGE_QUEUE_VERSION = 1;

// ─── Anti-nag limits (Doug-tunable) ────────────────────────────────

/** Never let the badge become a guilt-inducing pile. */
const MAX_PENDING = 3;
/** She doesn't pile on — at most one NEW nudge enqueued per day. */
const MAX_NEW_PER_DAY = 1;
/** Drop nudges older than this; the moment has passed. */
const TTL_DAYS = 14;

const SEVERITY_RANK: Record<CareAlertSeverity, number> = {
  critical: 0,
  urgent: 1,
  soon: 2,
  info: 3,
};

// ─── Voice templates ───────────────────────────────────────────────
//
// DRAFT — Doug to red-pen (May 27 2026). These are Sage's OPENER only:
// the first line she texts. The moment the user replies, they're in a
// full-personality Haiku conversation, so these are the knock on the
// door, not the whole exchange.
//
// SPIRIT (per CLAUDE.md "Sage's Personality"): warm, observational,
// best-friend-texting-you. {plant} interpolates the real plant name.
// Multiple variants per type + the real name = never feels canned.
// These are templates, not scripts she parrots mid-conversation —
// they only ever appear as the standalone opener.

const NUDGE_TEMPLATES: Partial<Record<CareAlertType, string[]>> = {
  'prune-now': [
    "Hey — your {plant} just hit the stage where a quick pinch up top turns it bushy instead of leggy. Want me to walk you through it? Takes like 30 seconds.",
    "Psst — your {plant} is ready for a pinch. Snip the growing tip now and it branches into twice the plant. Got half a minute?",
    "Oh, good timing — your {plant}'s at that 4-to-6-leaf-pair sweet spot. Pinch the top today and it'll thank you with way more leaves. Want the how?",
    "Your {plant} is asking for a haircut 😄 — a little pinch up top now and it gets bushy. Want me to show you exactly where to cut?",
  ],
  'prune-overdue': [
    "Okay, your {plant} is getting a little wild — it's past due for a pinch. Not a crisis! But let's rein it in before it goes full beanstalk on you.",
    "Your {plant} skipped its pinch and it's starting to stretch out. Easy fix — want me to show you where to cut to get it bushy again?",
  ],
  'bolting': [
    "Heads up — your {plant} is bolting (that flower stalk shooting up the middle). The leaves turn bitter fast once this starts, so today's the day to harvest the good stuff. Want a hand?",
    "Your {plant}'s about to flower on you — that's bolting, and the clock's ticking on the tasty leaves. Grab what you can today? I can walk you through it.",
  ],
  'bolt-risk': [
    "Keep an eye on your {plant} — with this kind of heat it could bolt any day. Might be worth harvesting a little early rather than losing it to bitterness. Want to talk it through?",
  ],
  'harvest-ready': [
    "Your {plant} is ready! 🌱 Go grab some — honestly nothing beats eating something the same day you pick it. Want tips on picking it at its peak?",
    "Ooh — your {plant}'s at peak right now. This is the fun part. Want a quick rundown on harvesting it at its best?",
  ],
  'harvest-urgent': [
    "Your {plant} is RIGHT at the edge of its window — harvest now or it'll start to turn. Want me to tell you what to look for?",
    "Quick one — your {plant} is past peak and needs picking today before it goes. Want the 30-second version of how?",
  ],
  'frost-warning': [
    "Frost's coming and your {plant} really won't love it. Want to talk through covering it or bringing it in tonight?",
  ],
  'heat-wave': [
    "It's about to get brutal out there, and your {plant} feels it too. Want a couple quick heat-protection moves?",
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────

/** Deterministic-ish variant pick. Uses the alertId as the seed so the
 *  same alert always shows the same line (no flip-flop on re-render),
 *  but different alerts/cycles vary. */
function selectVariant(type: CareAlertType, seed: string): string | null {
  const pool = NUDGE_TEMPLATES[type];
  if (!pool || pool.length === 0) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

function buildNudgeFromAlert(alert: CareAlert, plantName: string): SageNudge | null {
  const template = selectVariant(alert.type, alert.id);
  if (!template) return null; // no voice line for this type → don't nudge
  return {
    id: alert.id,
    alertType: alert.type,
    plantId: alert.plantId,
    cropId: alert.cropId,
    plantName,
    severity: alert.severity,
    text: template.replace(/\{plant\}/g, plantName),
    createdAt: new Date().toISOString(),
    deliveredAt: null,
    status: 'pending',
  };
}

/** Drop nudges that have aged out or whose plant is gone. Pure. */
export function pruneNudgeQueue(
  queue: NudgeQueue,
  activePlants: GardenPlant[],
  now: Date = new Date(),
): NudgeQueue {
  const cutoff = now.getTime() - TTL_DAYS * 86400000;
  const livePlantIds = new Set(activePlants.map((p) => p.id));
  const nudges = queue.nudges.filter((n) => {
    if (n.status === 'expired') return false;
    const created = new Date(n.createdAt).getTime();
    if (!isNaN(created) && created < cutoff) return false; // aged out
    if (!livePlantIds.has(n.plantId)) return false; // plant harvested/removed
    return true;
  });
  return { version: NUDGE_QUEUE_VERSION, nudges };
}

export interface PickDueOptions {
  plants: GardenPlant[];
  /** localStorage dismissals map (alertId -> ISO date). */
  dismissals: Record<string, string>;
  /** The current queue (after pruning). */
  queue: NudgeQueue;
  now?: Date;
}

/**
 * Compute which NEW nudges to enqueue, applying all anti-nag gates.
 * Returns the nudges to ADD (caller merges into the queue + persists).
 *
 * Gates:
 *   1. Skip alerts already in the queue (by id) or already dismissed.
 *   2. Respect MAX_PENDING — don't exceed 3 pending total.
 *   3. Respect MAX_NEW_PER_DAY — at most 1 new nudge enqueued per UTC day.
 *   4. Severity ordering — when limited, enqueue the most urgent first.
 */
export function pickDueNudges(opts: PickDueOptions): SageNudge[] {
  const { plants, dismissals, queue, now = new Date() } = opts;

  const pendingCount = queue.nudges.filter((n) => n.status === 'pending').length;
  if (pendingCount >= MAX_PENDING) return [];

  // How many NEW nudges already enqueued today (UTC)?
  const today = now.toISOString().slice(0, 10);
  const enqueuedToday = queue.nudges.filter(
    (n) => n.createdAt.slice(0, 10) === today,
  ).length;
  if (enqueuedToday >= MAX_NEW_PER_DAY) return [];

  const alreadyKnown = new Set(queue.nudges.map((n) => n.id));

  // Gather candidate alerts across all plants, skipping dismissed + known.
  const candidates: { alert: CareAlert; plant: GardenPlant }[] = [];
  for (const plant of plants) {
    if (plant.removedDate || plant.harvestedDate || plant.manualStatus === 'done') continue;
    const alerts = detectCareAlerts(plant, now, { dismissals });
    for (const alert of alerts) {
      if (alreadyKnown.has(alert.id)) continue;
      if (dismissals[alert.id]) continue;
      candidates.push({ alert, plant });
    }
  }
  if (candidates.length === 0) return [];

  // Most urgent first, then oldest plant (lower cycle implicitly).
  candidates.sort(
    (a, b) => SEVERITY_RANK[a.alert.severity] - SEVERITY_RANK[b.alert.severity],
  );

  const slotsLeft = Math.min(
    MAX_PENDING - pendingCount,
    MAX_NEW_PER_DAY - enqueuedToday,
  );

  const picked: SageNudge[] = [];
  for (const { alert, plant } of candidates) {
    if (picked.length >= slotsLeft) break;
    const plantName = getCropDisplayName(plant.cropId, plant.customVarietyName);
    const nudge = buildNudgeFromAlert(alert, plantName);
    if (nudge) picked.push(nudge);
  }
  return picked;
}

// ─── localStorage (instant), KV is the durable cross-device store ──

function localKey(userId: string): string {
  return `garden:nudges:${userId}`;
}

export function loadLocalNudgeQueue(userId: string | null): NudgeQueue {
  const empty: NudgeQueue = { version: NUDGE_QUEUE_VERSION, nudges: [] };
  if (!userId || typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as NudgeQueue;
    if (parsed.version !== NUDGE_QUEUE_VERSION || !Array.isArray(parsed.nudges)) {
      return empty;
    }
    return parsed;
  } catch {
    return empty;
  }
}

export function saveLocalNudgeQueue(userId: string | null, queue: NudgeQueue): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(queue));
  } catch {
    /* quota — non-critical, KV is the durable copy */
  }
}

/** Count of nudges still waiting to be seen — drives the icon badge. */
export function pendingNudgeCount(queue: NudgeQueue): number {
  return queue.nudges.filter((n) => n.status === 'pending').length;
}
