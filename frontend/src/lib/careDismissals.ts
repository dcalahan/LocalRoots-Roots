/**
 * Care-alert dismissals — server-side store mirrored to Vercel KV.
 *
 * Two write paths feed this store:
 *  1. UI: GardenPlantCard's "Done" button → dismissAlert() → also POSTs here
 *  2. Sage chat: extracted mark_pruned / mark_bolting / dismiss_care_alert
 *     actions → useMyGarden handler POSTs here
 *
 * One read path: garden-brain.ts loads the map and passes it into
 * detectCareAlerts(plant, now, { dismissals }) so Sage's prompt no longer
 * mentions things the user already handled.
 *
 * Shape: alertId -> ISO-date string. AlertId format matches careAlerts.ts:
 *   `${plantId}:${type}:${cycle}` — e.g. "uuid:prune-sucker:0"
 *
 * Entries older than 90 days are pruned on every write. Pruning alerts
 * recur on cycles, so an old cycle 0 dismissal becomes irrelevant once
 * cycle 1 fires; the TTL just keeps the map from growing unbounded.
 */

import { kv } from './kv';
import type { GardenPlant } from '@/types/my-garden';
import { getPruningRules } from './plantingCalendar';

export type DismissalsMap = Record<string, string>;

const TTL_DAYS = 90;

function key(userId: string): string {
  return `garden:dismissals:${userId}`;
}

export async function loadServerDismissals(userId: string): Promise<DismissalsMap> {
  if (!userId) return {};
  try {
    const data = await kv.get<DismissalsMap>(key(userId));
    return data || {};
  } catch {
    return {};
  }
}

export async function saveServerDismissals(
  userId: string,
  dismissals: DismissalsMap,
): Promise<void> {
  if (!userId) return;
  // Prune entries older than TTL_DAYS so the map doesn't grow forever
  const cutoff = Date.now() - TTL_DAYS * 86400000;
  const pruned: DismissalsMap = {};
  for (const [k, v] of Object.entries(dismissals)) {
    const t = new Date(v).getTime();
    if (!isNaN(t) && t >= cutoff) pruned[k] = v;
  }
  try {
    await kv.set(key(userId), pruned);
  } catch (err) {
    console.error('[careDismissals] save failed:', err);
  }
}

export async function recordDismissals(
  userId: string,
  alertIds: string[],
): Promise<void> {
  if (!userId || alertIds.length === 0) return;
  const cur = await loadServerDismissals(userId);
  const now = new Date().toISOString();
  for (const id of alertIds) cur[id] = now;
  await saveServerDismissals(userId, cur);
}

/**
 * Compute the alert IDs Sage should dismiss when the user says something
 * like "I pruned the tomatoes" or "stop telling me about pruning."
 *
 * Categories map to alertId type prefixes (see careAlerts.ts alertId()):
 *   pruning   → `prune-${rule.type}` (e.g. prune-sucker, prune-pinch-top)
 *   bolting   → bolting OR bolt-risk (we dismiss both — user already knows)
 *   harvest   → harvest-ready (covers both harvest-ready and harvest-urgent
 *               since both share the same alertId type prefix)
 *
 * Returns alertIds for ALL active plants of the given crop. Passing
 * `cropId = null` enumerates across every active plant.
 */
export type CareCategory = 'pruning' | 'bolting' | 'harvest';

export function getDismissibleAlertIds(
  plants: GardenPlant[],
  cropId: string | null,
  category: CareCategory,
  now: Date = new Date(),
): string[] {
  const ids: string[] = [];
  for (const p of plants) {
    if (cropId && p.cropId !== cropId) continue;
    if (p.removedDate || p.harvestedDate) continue;
    if (p.manualStatus === 'done') continue;

    const elapsed = Math.floor(
      (now.getTime() - new Date(p.plantingDate).getTime()) / 86400000,
    );
    if (elapsed < 0) continue;

    if (category === 'pruning') {
      const rules = getPruningRules(p.cropId);
      for (const rule of rules) {
        // Compute current cycle. If we haven't hit triggerDays yet,
        // dismiss cycle 0 — covers proactive pruning before the alert fires.
        const cyclesPast =
          elapsed < rule.triggerDays
            ? 0
            : Math.floor(
                (elapsed - rule.triggerDays) / Math.max(rule.recurringDays, 1),
              );
        const cycle = Math.max(0, cyclesPast);
        ids.push(`${p.id}:prune-${rule.type}:${cycle}`);
      }
    } else if (category === 'bolting') {
      // Both bolting and bolt-risk share cycle 0 (non-cycling alerts).
      ids.push(`${p.id}:bolting:0`);
      ids.push(`${p.id}:bolt-risk:0`);
    } else if (category === 'harvest') {
      ids.push(`${p.id}:harvest-ready:0`);
    }
  }
  return ids;
}
