/**
 * Unit tests for lib/offchainRP.ts — the foundation of off-chain Roots
 * Points crediting.
 *
 * Strategy: mock @/lib/kv with an in-memory map. Every test gets a fresh
 * store via beforeEach. Tests verify:
 *   - Idempotency: same dedup key, no double credit
 *   - Daily cap enforcement
 *   - Lifetime cap enforcement
 *   - Anonymous short-circuit
 *   - Non-live verb short-circuit
 *   - User summary accumulation across credits
 *   - KV failure surfaces as { ok: false } without throwing
 *   - Address normalization (mixed-case input → lowercase keys)
 *
 * These tests must pass before Phase 1.0 ships. Per Doug's "test before
 * shipping" principle, we need verifiable behavior on the foundation
 * before any UI wires into it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── In-memory KV stub ─────────────────────────────────────────────────
// Implements the same surface lib/kv.ts exports, backed by a Map. Reset
// before each test. setnx is the critical primitive — must be atomic-
// equivalent (refuses to overwrite existing keys).

class InMemoryKV {
  store = new Map<string, string>()

  // Test hook to simulate KV failures
  failNext = false

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('simulated KV failure')
    }
    const raw = this.store.get(key)
    if (raw === undefined) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return raw as T
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    this.store.set(key, serialized)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(_pattern: string): Promise<string[]> {
    return Array.from(this.store.keys())
  }

  async setnx(key: string, value: unknown): Promise<boolean> {
    if (this.store.has(key)) return false
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    this.store.set(key, serialized)
    return true
  }
}

const mockKv = new InMemoryKV()

vi.mock('@/lib/kv', () => ({
  kv: mockKv,
}))

// Imports must come AFTER vi.mock so the mock is registered first
const { credit, getUserSummary, VERBS, __internal } = await import('@/lib/offchainRP')

describe('offchainRP — credit()', () => {
  const ADDR = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01'
  const ADDR_LOWER = ADDR.toLowerCase()

  beforeEach(() => {
    mockKv.store.clear()
    mockKv.failNext = false
  })

  it('credits a plant-added event and accumulates user summary', async () => {
    const result = await credit('plant-added', ADDR, 'plant-uuid-1')
    expect(result.ok).toBe(true)
    expect(result).toMatchObject({
      ok: true,
      credited: true,
      rpAmount: 25,
      newTotal: 25,
    })

    const summary = await getUserSummary(ADDR)
    expect(summary.total).toBe(25)
    expect(summary.byVerb['plant-added']).toMatchObject({
      rp: 25,
      count: 1,
    })
  })

  it('is idempotent — same dedup key never double-credits', async () => {
    await credit('plant-added', ADDR, 'plant-uuid-1')
    const second = await credit('plant-added', ADDR, 'plant-uuid-1')

    expect(second).toEqual({ ok: true, credited: false, reason: 'duplicate' })
    const summary = await getUserSummary(ADDR)
    expect(summary.total).toBe(25) // not 50
  })

  it('enforces daily cap — 5th plant of the day is rejected', async () => {
    // plant-added cap is 4/day
    for (let i = 0; i < 4; i++) {
      const r = await credit('plant-added', ADDR, `plant-${i}`)
      expect(r).toMatchObject({ credited: true })
    }
    const fifth = await credit('plant-added', ADDR, 'plant-5')
    expect(fifth).toEqual({ ok: true, credited: false, reason: 'daily-cap' })

    // Total should be 4 × 25 = 100, not 125
    const summary = await getUserSummary(ADDR)
    expect(summary.total).toBe(100)
    expect(summary.byVerb['plant-added']?.count).toBe(4)
  })

  it('on daily-cap rejection, rolls back the event claim so retry can succeed tomorrow', async () => {
    // Fill the daily cap
    for (let i = 0; i < 4; i++) {
      await credit('plant-added', ADDR, `plant-${i}`)
    }
    // 5th attempt: rejected
    await credit('plant-added', ADDR, 'plant-5')
    // The eventKey for plant-5 must have been rolled back, otherwise a
    // future attempt (after daily reset) would see it as duplicate
    const eventId = __internal.computeEventId('plant-added', 'plant-5')
    const evt = await mockKv.get(__internal.eventKey(eventId))
    expect(evt).toBeNull()
  })

  it('enforces lifetime cap — once hit, never credits again even on new days', async () => {
    // We can't easily run 80 plants in a unit test. Instead, prime the
    // lifetime counter to the cap directly and verify the rejection.
    await mockKv.set(__internal.lifetimeKey(ADDR, 'plant-added'), 80)
    const result = await credit('plant-added', ADDR, 'plant-after-cap')
    expect(result).toEqual({ ok: true, credited: false, reason: 'lifetime-cap' })

    const summary = await getUserSummary(ADDR)
    expect(summary.total).toBe(0)
  })

  it('returns anonymous reason for empty / null address', async () => {
    expect(await credit('plant-added', '', 'x')).toEqual({
      ok: true,
      credited: false,
      reason: 'anonymous',
    })
    expect(await credit('plant-added', null, 'x')).toEqual({
      ok: true,
      credited: false,
      reason: 'anonymous',
    })
    expect(await credit('plant-added', undefined, 'x')).toEqual({
      ok: true,
      credited: false,
      reason: 'anonymous',
    })
  })

  it('returns not-live for verbs that are declared but not yet wired', async () => {
    // plant-photo is Phase 2 — declared in the registry but live: false
    // until the photo-upload surface is wired and verified.
    const result = await credit('plant-photo', ADDR, 'photo-test')
    expect(result).toEqual({ ok: true, credited: false, reason: 'not-live' })
  })

  it('captures first-seen IP geo on first credit and never overwrites', async () => {
    // First credit with US location → user-meta gets written
    await credit('plant-added', ADDR, 'p-1', {
      ipMeta: { country: 'US', region: 'SC', city: 'Hilton Head Island' },
    })
    const metaKey = __internal.userMetaKey(ADDR)
    const meta1 = await mockKv.get<{ country: string; region: string; city: string; firstSeenAt: string }>(metaKey)
    expect(meta1).toMatchObject({
      country: 'US',
      region: 'SC',
      city: 'Hilton Head Island',
    })
    expect(typeof meta1?.firstSeenAt).toBe('string')

    // Second credit with DIFFERENT location → first-seen preserved
    await credit('plant-added', ADDR, 'p-2', {
      ipMeta: { country: 'IT', region: '21', city: 'Roma' },
    })
    const meta2 = await mockKv.get<{ country: string }>(metaKey)
    expect(meta2?.country).toBe('US') // unchanged
  })

  it('skips user-meta write when ipMeta is absent', async () => {
    await credit('plant-added', ADDR, 'no-meta-test')
    const meta = await mockKv.get(__internal.userMetaKey(ADDR))
    expect(meta).toBeNull()
  })

  it('skips user-meta write when ipMeta has no country/region/city', async () => {
    // Empty ipMeta (Vercel headers missing) — don't write a placeholder record
    await credit('plant-added', ADDR, 'empty-meta-test', { ipMeta: {} })
    const meta = await mockKv.get(__internal.userMetaKey(ADDR))
    expect(meta).toBeNull()
  })

  it('normalizes mixed-case addresses to lowercase in storage keys', async () => {
    await credit('plant-added', ADDR, 'plant-mixed-case')

    // Read via lowercase address — should find the summary
    const lowerSummary = await mockKv.get(`rp:offchain:${ADDR_LOWER}`)
    expect(lowerSummary).not.toBeNull()

    // Read via mixed-case — should NOT find a separate record
    const mixedSummary = await mockKv.get(`rp:offchain:${ADDR}`)
    expect(mixedSummary).toBeNull()
  })

  it('accumulates total across multiple verbs', async () => {
    // Temporarily make a second verb live for this test
    const originalLive = VERBS['bed-created'].live
    VERBS['bed-created'].live = true
    try {
      await credit('plant-added', ADDR, 'p1')
      await credit('plant-added', ADDR, 'p2')
      await credit('bed-created', ADDR, 'bed-1')

      const summary = await getUserSummary(ADDR)
      expect(summary.total).toBe(25 + 25 + 50) // 100
      expect(summary.byVerb['plant-added']?.count).toBe(2)
      expect(summary.byVerb['bed-created']?.count).toBe(1)
    } finally {
      VERBS['bed-created'].live = originalLive
    }
  })

  it('does NOT throw when KV fails — returns { ok: false }', async () => {
    mockKv.failNext = true
    const result = await credit('plant-added', ADDR, 'fail-test')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/simulated KV failure/)
    }
  })

  it('writes an audit record at rp:offchain:event:{eventId}', async () => {
    await credit('plant-added', ADDR, 'audit-test-plant')
    const eventId = __internal.computeEventId('plant-added', 'audit-test-plant')
    const record = await mockKv.get(__internal.eventKey(eventId))
    expect(record).toMatchObject({
      eventId,
      verbId: 'plant-added',
      privyAddress: ADDR_LOWER,
      rpAmount: 25,
      dedupKey: 'audit-test-plant',
    })
  })

  it('eventId is stable for a given (verb, dedupKey) pair', async () => {
    // Same verb + dedup key → same eventId every time
    const id1 = __internal.computeEventId('plant-added', 'stable-test')
    const id2 = __internal.computeEventId('plant-added', 'stable-test')
    expect(id1).toBe(id2)
    expect(id1.length).toBe(16) // 64-bit hex digest

    // Different dedup key → different eventId
    const id3 = __internal.computeEventId('plant-added', 'different-key')
    expect(id3).not.toBe(id1)

    // Different verb, same dedup key → different eventId
    const id4 = __internal.computeEventId('sage-daily', 'stable-test')
    expect(id4).not.toBe(id1)
  })
})

describe('offchainRP — getUserSummary()', () => {
  beforeEach(() => {
    mockKv.store.clear()
  })

  it('returns zero-valued default for never-credited address', async () => {
    const summary = await getUserSummary('0x0000000000000000000000000000000000000001')
    expect(summary.total).toBe(0)
    expect(summary.byVerb).toEqual({})
  })

  it('returns zero-valued default for empty string address', async () => {
    const summary = await getUserSummary('')
    expect(summary.total).toBe(0)
  })
})

describe('offchainRP — VERBS registry sanity', () => {
  it('every declared VerbId has a matching entry', () => {
    // All entries must self-reference their id
    for (const [key, cfg] of Object.entries(VERBS)) {
      expect(cfg.id).toBe(key)
    }
  })

  it('live verbs match the currently shipped set', () => {
    // As of May 15 2026 (Batch A):
    //   - plant-added (Phase 1.0)
    //   - sage-daily (Phase 1.5)
    //   - bed-created, plant-update, harvest-logged, plant-photo,
    //     bed-photo (Batch A — all wired via /api/my-garden PUT diff)
    // Coming next (Batch B+): plant-photo perceptual-hash defense,
    // public-profile-published, care-alert-acted-on, share-card-sent,
    // listing-created, recruited-gardener-activated, sage-depth-bonus.
    const expectedLive = new Set([
      'plant-added',
      'sage-daily',
      'bed-created',
      'plant-update',
      'harvest-logged',
      'bed-photo',
      // Batch B (May 15 2026):
      'public-profile-published',
      'care-alert-acted-on',
      'share-card-sent',
      // Batch C (May 15 2026):
      'listing-created',
      // Not yet live (need additional infrastructure):
      // - plant-photo: GardenPlant lacks photoIpfs field
      // - recruited-gardener-activated: needs subgraph poll or apply
      //   at merkle-snapshot time
      // - sage-depth-bonus: deferred pending real chat data
    ])
    for (const [key, cfg] of Object.entries(VERBS)) {
      if (expectedLive.has(key)) {
        expect(cfg.live, `${key} should be live=true`).toBe(true)
      } else {
        expect(cfg.live, `${key} should be live=false until its surface is wired`).toBe(false)
      }
    }
  })

  it('the engaged-user daily max stays at the planned ~515 RP/day budget', () => {
    // Defense: if someone bumps a daily cap or rate without re-running
    // the budget math from the plan doc, this test fires.
    //
    // From plan §1 "Why these numbers":
    //   sage-daily + sage-depth = 25 RP
    //   plant-added × 4 = 100 RP
    //   plant-photo × 3 = 90 RP
    //   care-alert × 5 = 75 RP
    //   plant-update × 5 = 25 RP
    //   harvest × 5 = 200 RP
    //   ──────────────────────
    //   Total engaged-user-day: 515 RP
    const dailyBudget =
      VERBS['sage-daily'].rpAmount * (VERBS['sage-daily'].dailyCap ?? 0) +
      VERBS['sage-depth-bonus'].rpAmount * (VERBS['sage-depth-bonus'].dailyCap ?? 0) +
      VERBS['plant-added'].rpAmount * (VERBS['plant-added'].dailyCap ?? 0) +
      VERBS['plant-photo'].rpAmount * (VERBS['plant-photo'].dailyCap ?? 0) +
      VERBS['care-alert-acted-on'].rpAmount * (VERBS['care-alert-acted-on'].dailyCap ?? 0) +
      VERBS['plant-update'].rpAmount * (VERBS['plant-update'].dailyCap ?? 0) +
      VERBS['harvest-logged'].rpAmount * (VERBS['harvest-logged'].dailyCap ?? 0)
    expect(dailyBudget).toBe(515)
  })
})
