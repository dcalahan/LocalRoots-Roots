/**
 * Off-chain Roots Points (RP) — foundation library.
 *
 * Companion to the existing on-chain RP earned via marketplace + ambassador
 * contracts. The on-chain RP is immutable (subgraph-indexed events); this
 * off-chain RP exists to reward engagement that doesn't translate to a
 * marketplace transaction — Sage usage, garden tracking, photos, harvests.
 *
 * Doug approved the strategic plan May 12 2026. Full design at
 * `<repo>/roots-points-expansion-plan.md`. Decisions locked:
 *   - Off-chain RP indexed by a stable user key (lowercased). The key can
 *     be either a Privy embedded wallet address (`0x...`) OR a Privy user
 *     DID (`did:privy:cmxxx`). The library is content-agnostic; whichever
 *     identifier the calling surface naturally has is fine. At airdrop
 *     snapshot, `scripts/distribution/calculateAllocations.ts` resolves
 *     both to the final wallet address via the Privy Management API.
 *   - Anonymous users never earn (no Privy ID, no airdrop eligibility)
 *   - Per-verb daily and lifetime caps protect against farming
 *   - Dedup via `setnx` on `rp:offchain:event:{eventId}` — idempotent retries
 *   - Snapshot-time merkle reads `rp:offchain:{address}` keys, sums into
 *     existing on-chain RP, runs through wash filter, produces airdrop
 *     allocations
 *
 * Phase 1.0 ships ONE verb wired end-to-end: plant-added. The remaining 12
 * verbs from the plan get wired in Phase 2 against this same infrastructure.
 *
 * Critical principles:
 *   - Server-side only. Never trust client-supplied RP credits.
 *   - Idempotent. Same dedup key, called N times, credits once.
 *   - Never throws on KV failure. Off-chain RP is best-effort; the user's
 *     primary action (saving a plant, sending a Sage message) must succeed
 *     even if KV is down. Log + swallow.
 *   - No `await` on the user's hot path. Every credit call is fire-and-forget
 *     from within a Vercel `after()` block or an awaited promise that the
 *     caller can ignore. Don't block plant-save on RP-credit.
 */

import { kv } from '@/lib/kv'

// ─── Types ─────────────────────────────────────────────────────────────

export type VerbId =
  | 'plant-added'
  // Phase 2 verbs (declared here so the registry compiles; not yet credited):
  | 'sage-daily'
  | 'sage-depth-bonus'
  | 'bed-created'
  | 'plant-photo'
  | 'bed-photo'
  | 'harvest-logged'
  | 'plant-update'
  | 'public-profile-published'
  | 'care-alert-acted-on'
  | 'listing-created'
  | 'share-card-sent'
  | 'recruited-gardener-activated'

export interface VerbConfig {
  /** Stable verb identifier — appears in dedup keys, telemetry, audit. */
  id: VerbId
  /** Roots Points awarded per credit event. */
  rpAmount: number
  /**
   * Max credits per UTC day per user. undefined = unlimited within the
   * lifetime cap. The cap is per VERB, not per surface — credits from
   * multiple sources (e.g. plant added via UI vs Sage chat action) count
   * against the same daily ledger.
   */
  dailyCap?: number
  /** Max credits per user, all-time. undefined = unlimited. */
  lifetimeCap?: number
  /** Human-friendly label for toasts + profile breakdown. */
  label: string
  /**
   * Whether this verb is wired end-to-end as of the current ship. Phase 1.0
   * has only plant-added live. Other verbs return `notLive` from credit()
   * so we don't accidentally accumulate ghost credits before the surfaces
   * are wired. Flip to true as each verb's emitting surface lands.
   */
  live: boolean
}

/** Per-user persisted RP summary, stored at `rp:offchain:{address}`. */
export interface UserRPSummary {
  /** Total off-chain RP earned, all-time. */
  total: number
  /** ISO timestamp of last credit event. */
  lastUpdated: string
  /** Per-verb breakdown for the user-facing profile display. */
  byVerb: Partial<
    Record<
      VerbId,
      {
        rp: number
        count: number
        lastEarnedAt: string
      }
    >
  >
}

/** Audit record stored at `rp:offchain:event:{eventId}`. Append-only. */
export interface CreditEventRecord {
  eventId: string
  verbId: VerbId
  privyAddress: string
  rpAmount: number
  dedupKey: string
  timestamp: string
}

/** Result returned to the caller of credit(). */
export type CreditResult =
  | { ok: true; credited: true; rpAmount: number; newTotal: number; eventId: string }
  | { ok: true; credited: false; reason: 'duplicate' | 'daily-cap' | 'lifetime-cap' | 'not-live' | 'anonymous' }
  | { ok: false; error: string }

// ─── Verb registry (single source of truth for verb shape) ─────────────

/**
 * All earning verbs. Numbers come from the approved plan §1 (see
 * `roots-points-expansion-plan.md`). DO NOT adjust without re-running the
 * "engaged user daily max" arithmetic Doug signed off on (~515 RP/day cap).
 */
export const VERBS: Record<VerbId, VerbConfig> = {
  'plant-added': {
    id: 'plant-added',
    rpAmount: 25,
    dailyCap: 4, // 4 plants/day × 25 RP = 100 RP/day max
    lifetimeCap: 80, // 80 plants lifetime × 25 RP = 2000 RP — generous for serious gardeners
    label: 'Plant added to garden',
    live: true,
  },

  // ── Phase 2 verbs ───────────────────────────────────────────────
  // Live as of:
  //   - May 15 2026 (sage-daily)
  //   - May 15 2026 (bed-created, plant-update, harvest-logged,
  //     plant-photo, bed-photo — all wired via /api/my-garden PUT
  //     diff)
  'sage-daily': {
    id: 'sage-daily',
    rpAmount: 10,
    dailyCap: 1,
    label: 'Daily check-in with Sage',
    live: true,
  },
  'sage-depth-bonus': {
    id: 'sage-depth-bonus',
    rpAmount: 15,
    dailyCap: 1,
    label: 'Deep Sage conversation',
    live: false, // Phase 2+, pending real chat data per Doug's open question #5
  },
  'bed-created': {
    id: 'bed-created',
    rpAmount: 50,
    dailyCap: 2,
    lifetimeCap: 10,
    label: 'Garden bed created',
    live: true,
  },
  'plant-photo': {
    id: 'plant-photo',
    rpAmount: 30,
    dailyCap: 3,
    label: 'Plant photo captured',
    // Per-plant photos don't exist in the data model yet (GardenPlant has
    // no photoIpfs field — only GardenBed does). Keeps the verb declared
    // for when plant photos are added.
    live: false,
  },
  'bed-photo': {
    id: 'bed-photo',
    rpAmount: 50,
    dailyCap: 1,
    label: 'Garden bed photo captured',
    live: true,
  },
  'harvest-logged': {
    id: 'harvest-logged',
    rpAmount: 40,
    dailyCap: 5,
    label: 'Harvest logged',
    live: true,
  },
  'plant-update': {
    id: 'plant-update',
    rpAmount: 5,
    dailyCap: 5,
    label: 'Plant update logged',
    live: true,
  },
  'public-profile-published': {
    id: 'public-profile-published',
    rpAmount: 200,
    lifetimeCap: 1,
    label: 'Public garden profile published',
    live: false,
  },
  'care-alert-acted-on': {
    id: 'care-alert-acted-on',
    rpAmount: 15,
    dailyCap: 5,
    label: 'Care action completed',
    live: false,
  },
  'listing-created': {
    id: 'listing-created',
    rpAmount: 100,
    dailyCap: 5,
    label: 'Listing created',
    live: false,
  },
  'share-card-sent': {
    id: 'share-card-sent',
    rpAmount: 5,
    dailyCap: 10,
    label: 'Share card sent',
    live: false,
  },
  'recruited-gardener-activated': {
    id: 'recruited-gardener-activated',
    rpAmount: 1000,
    label: 'Recruited gardener activated',
    live: false,
  },
}

// ─── KV key shapes ─────────────────────────────────────────────────────

const userKey = (address: string) => `rp:offchain:${address.toLowerCase()}`
const eventKey = (eventId: string) => `rp:offchain:event:${eventId}`
const dailyKey = (address: string, verbId: VerbId, isoDate: string) =>
  `rp:offchain:daily:${address.toLowerCase()}:${verbId}:${isoDate}`
const lifetimeKey = (address: string, verbId: VerbId) =>
  `rp:offchain:lifetime:${address.toLowerCase()}:${verbId}`

/** UTC date string for daily-cap keys. Stable across timezones. */
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

/**
 * Compute the eventId for a credit attempt. The same (verbId, dedupKey)
 * always produces the same eventId, which makes credit attempts idempotent
 * via setnx on the event key.
 *
 * dedupKey is verb-specific: for plant-added it's the plantId; for
 * sage-daily it's `{userId}:{YYYY-MM-DD}`; for harvest-logged it's the
 * plantId; etc.
 *
 * eventId is a SHA-1-ish hex digest — small enough to be a Redis key,
 * long enough to avoid collision across verbs. Not cryptographically
 * sensitive — it's just a stable hash for idempotency.
 */
function computeEventId(verbId: VerbId, dedupKey: string): string {
  // Lightweight FNV-1a 64-bit hash. We don't need crypto guarantees here;
  // we need a stable, short, collision-resistant-enough identifier. Native
  // crypto.subtle.digest is async and overkill for this use case.
  let hash = 0xcbf29ce484222325n
  const input = `${verbId}|${dedupKey}`
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i))
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return hash.toString(16).padStart(16, '0')
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Credit a user with off-chain Roots Points for completing a verb.
 *
 * Idempotent: calling repeatedly with the same `dedupKey` for the same
 * verb produces at most one credit. Safe to call from a fire-and-forget
 * `after()` block — KV failures are logged and swallowed so the user's
 * primary action isn't blocked.
 *
 * @param verbId    Which earning verb (see VERBS registry)
 * @param privyAddress Stable user identifier. Accepts either a Privy
 *                  embedded wallet address (`0x...`) or a Privy user DID
 *                  (`did:privy:...`). Normalized to lowercase before use.
 *                  Pass `null` / empty for anonymous users — short-circuits
 *                  with `credited: false, reason: 'anonymous'`.
 * @param dedupKey  Verb-specific unique identifier (e.g. `plantId`,
 *                  `{userId}:{YYYY-MM-DD}`). Same key, same eventId, same
 *                  no-op behavior on retry.
 */
export async function credit(
  verbId: VerbId,
  privyAddress: string | null | undefined,
  dedupKey: string,
): Promise<CreditResult> {
  const verb = VERBS[verbId]
  if (!verb) {
    return { ok: false, error: `unknown verb: ${verbId}` }
  }

  if (!verb.live) {
    return { ok: true, credited: false, reason: 'not-live' }
  }

  if (!privyAddress || typeof privyAddress !== 'string' || privyAddress.length === 0) {
    return { ok: true, credited: false, reason: 'anonymous' }
  }

  const address = privyAddress.toLowerCase()
  const eventId = computeEventId(verbId, dedupKey)

  try {
    // ── 1. Atomic claim on the event key (idempotency guarantee) ────
    const eventRecord: CreditEventRecord = {
      eventId,
      verbId,
      privyAddress: address,
      rpAmount: verb.rpAmount,
      dedupKey,
      timestamp: new Date().toISOString(),
    }
    const claimed = await kv.setnx(eventKey(eventId), eventRecord)
    if (!claimed) {
      // Someone (this caller, on retry, or a duplicate request) already
      // claimed this eventId. No-op return.
      return { ok: true, credited: false, reason: 'duplicate' }
    }

    // ── 2. Check daily cap (non-atomic; race window is bounded) ─────
    if (verb.dailyCap !== undefined) {
      const today = todayUTC()
      const dailyCount = (await kv.get<number>(dailyKey(address, verbId, today))) ?? 0
      if (dailyCount >= verb.dailyCap) {
        // Daily cap hit. Roll back the event claim so a future attempt
        // (tomorrow) can succeed. Otherwise the eventId would block the
        // verb forever for this address-dedupKey combo.
        await kv.del(eventKey(eventId))
        return { ok: true, credited: false, reason: 'daily-cap' }
      }
    }

    // ── 3. Check lifetime cap (same non-atomic trade-off) ───────────
    if (verb.lifetimeCap !== undefined) {
      const lifetimeCount = (await kv.get<number>(lifetimeKey(address, verbId))) ?? 0
      if (lifetimeCount >= verb.lifetimeCap) {
        await kv.del(eventKey(eventId))
        return { ok: true, credited: false, reason: 'lifetime-cap' }
      }
    }

    // ── 4. Increment counters + accumulate user summary ─────────────
    const today = todayUTC()

    if (verb.dailyCap !== undefined) {
      const currentDaily = (await kv.get<number>(dailyKey(address, verbId, today))) ?? 0
      await kv.set(dailyKey(address, verbId, today), currentDaily + 1)
    }
    if (verb.lifetimeCap !== undefined) {
      const currentLifetime = (await kv.get<number>(lifetimeKey(address, verbId))) ?? 0
      await kv.set(lifetimeKey(address, verbId), currentLifetime + 1)
    }

    const summary = (await kv.get<UserRPSummary>(userKey(address))) ?? {
      total: 0,
      lastUpdated: new Date(0).toISOString(),
      byVerb: {},
    }
    const verbRow = summary.byVerb[verbId] ?? { rp: 0, count: 0, lastEarnedAt: new Date(0).toISOString() }
    const newSummary: UserRPSummary = {
      total: summary.total + verb.rpAmount,
      lastUpdated: new Date().toISOString(),
      byVerb: {
        ...summary.byVerb,
        [verbId]: {
          rp: verbRow.rp + verb.rpAmount,
          count: verbRow.count + 1,
          lastEarnedAt: new Date().toISOString(),
        },
      },
    }
    await kv.set(userKey(address), newSummary)

    return {
      ok: true,
      credited: true,
      rpAmount: verb.rpAmount,
      newTotal: newSummary.total,
      eventId,
    }
  } catch (err) {
    // Hard rule: never throw from a credit() call. The caller's primary
    // action (saving a plant, etc.) must not fail because RP crediting
    // had a KV blip. Log and degrade silently.
    console.error('[offchainRP] credit failed', { verbId, privyAddress, dedupKey, err })
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Read a user's off-chain RP summary. Returns a zero-valued default for
 * users who've never earned any off-chain RP (so the UI doesn't have to
 * deal with nulls).
 */
export async function getUserSummary(privyAddress: string): Promise<UserRPSummary> {
  if (!privyAddress) {
    return { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {} }
  }
  const summary = await kv.get<UserRPSummary>(userKey(privyAddress.toLowerCase()))
  return summary ?? { total: 0, lastUpdated: new Date(0).toISOString(), byVerb: {} }
}

// ─── Internal exports for unit tests ───────────────────────────────────
// These are not part of the public API. They exist so tests can verify
// key shapes match the documented schema in the plan doc.

export const __internal = {
  userKey,
  eventKey,
  dailyKey,
  lifetimeKey,
  computeEventId,
  todayUTC,
}
