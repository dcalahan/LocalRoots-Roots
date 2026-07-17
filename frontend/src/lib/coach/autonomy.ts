/**
 * Sage Coach — Autonomy Ladder L2 + L2.5 persistence (KV).
 *
 * Mirrors undercontract/src/lib/coach/autonomy.ts, adapted from Postgres to
 * Upstash KV. Three channels, two risk profiles:
 *
 *   1. Repro-case bank (the L3 asset) — every high/medium finding + every
 *      delight banks a minimal replay case. Accumulates from night one; the
 *      L3 eval runner (not built yet) will replay these.
 *   2. Brain PRs (L2) — global prompt-rule patches stored for HUMAN review,
 *      NEVER auto-applied. "Already covered by rule N" → non-compliance flag
 *      instead of a duplicate proposal.
 *   3. Auto-memory (L2.5, the safe channel) — per-user suppression/preference
 *      memories written automatically to `garden:memories:{userId}`. This is
 *      the channel that autonomously fixes an individual's experience (e.g.
 *      Sage badgering someone with filler questions). Guardrails: max 3/user/
 *      night, dedup, preferences only (never capabilities), logged, reversible.
 */

import { kv } from '@/lib/kv'
import type { MemoryFact } from '@/lib/ai-runtime/types'
import type {
  StoredFinding,
  StoredReproCase,
  StoredBrainProposal,
  StoredMemWrite,
} from './types'

const REPRO_INDEX_KEY = 'sage:coach:repro:index'
const REPRO_CAP = 500
const PROPOSALS_KEY = 'sage:coach:proposals'
const PROPOSALS_CAP = 200
const MEMWRITES_KEY = (date: string) => `sage:coach:memwrites:${date}`
const MAX_MEMORY_WRITES_PER_USER_PER_NIGHT = 3
const MEMORY_CAP = 100

// Facts about what the app can/cannot do belong in the prompt's capability
// docs, never in per-user memories — filter them even if the analyst slips.
const CAPABILITY_PATTERN =
  /\b(feature|is not available|isn'?t available|doesn'?t support|can'?t (send|email|text|list|sell|buy|post)|cannot (send|email|text|list|sell|buy|post)|the (app|system|product|marketplace) can)/i

export interface AutonomyResult {
  reproBanked: number
  proposalsQueued: number
  nonComplianceFlags: number
  memWrites: StoredMemWrite[]
}

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Apply the ladder to a night's findings. Returns counts + the memory writes
 * for the digest. All KV writes are best-effort — a single failure is logged
 * and skipped, never fails the night.
 */
export async function applyAutonomyLadder(
  findings: StoredFinding[],
  digestDate: string,
): Promise<AutonomyResult> {
  const nowISO = new Date().toISOString()

  // ── 1. Repro-case bank ──────────────────────────────────────────────
  let reproBanked = 0
  const newReproIds: string[] = []
  for (const f of findings) {
    const rc = f.repro_case
    if (!rc) continue
    const shouldBank = f.finding_type === 'delight' || f.severity === 'high' || f.severity === 'medium'
    if (!shouldBank) continue
    const id = newId()
    const stored: StoredReproCase = {
      id,
      kind: f.finding_type === 'delight' ? 'delight' : 'failure',
      finding_type: f.finding_type,
      userId: f.userId,
      transcript_excerpt: rc.transcript_excerpt.slice(0, 4000),
      expected_behavior: rc.expected_behavior.slice(0, 2000),
      forbidden_behavior: rc.forbidden_behavior?.slice(0, 2000) ?? null,
      context_notes: rc.context_notes?.slice(0, 1000) ?? null,
      createdAt: nowISO,
      status: 'active',
    }
    try {
      await kv.set(`sage:coach:repro:${id}`, stored)
      newReproIds.push(id)
      reproBanked++
    } catch (err) {
      console.error('[Sage Coach] repro bank write failed:', err instanceof Error ? err.message : err)
    }
  }
  if (newReproIds.length > 0) {
    try {
      const index = (await kv.get<string[]>(REPRO_INDEX_KEY)) ?? []
      const merged = [...newReproIds, ...index].slice(0, REPRO_CAP)
      await kv.set(REPRO_INDEX_KEY, merged)
    } catch (err) {
      console.error('[Sage Coach] repro index write failed:', err instanceof Error ? err.message : err)
    }
  }

  // ── 2. Brain PRs (L2) — stored, never auto-applied ──────────────────
  let proposalsQueued = 0
  let nonComplianceFlags = 0
  const newProposals: StoredBrainProposal[] = []
  for (const f of findings) {
    const bp = f.brain_proposal
    if (!bp) continue
    if (bp.already_covered_by) {
      // Non-compliance: surfaced in the digest, but not queued as a new rule.
      nonComplianceFlags++
      continue
    }
    newProposals.push({
      id: newId(),
      proposed_rule: bp.proposed_rule.slice(0, 3000),
      placement_hint: bp.placement_hint?.slice(0, 500) ?? null,
      rationale: bp.rationale?.slice(0, 1000) ?? null,
      finding_type: f.finding_type,
      evidence: f.evidence.slice(0, 500),
      repro_excerpt: f.repro_case?.transcript_excerpt?.slice(0, 1000) ?? null,
      status: 'proposed',
      createdAt: nowISO,
      reviewedAt: null,
      appliedInVersion: null,
    })
  }
  if (newProposals.length > 0) {
    try {
      const existing = (await kv.get<StoredBrainProposal[]>(PROPOSALS_KEY)) ?? []
      const merged = [...newProposals, ...existing].slice(0, PROPOSALS_CAP)
      await kv.set(PROPOSALS_KEY, merged)
      proposalsQueued = newProposals.length
    } catch (err) {
      console.error('[Sage Coach] proposals write failed:', err instanceof Error ? err.message : err)
    }
  }

  // ── 3. Auto-memory (L2.5, the safe channel) ─────────────────────────
  const memWrites: StoredMemWrite[] = []
  const perUserCount = new Map<string, number>()
  for (const f of findings) {
    const mem = f.auto_memory
    if (!mem || !f.userId) continue
    const bare = mem.fact.trim()
    const fact = `Coach-applied: ${bare}`.slice(0, 500)
    if (CAPABILITY_PATTERN.test(fact)) continue
    if ((perUserCount.get(f.userId) ?? 0) >= MAX_MEMORY_WRITES_PER_USER_PER_NIGHT) continue
    try {
      const memoriesKey = `garden:memories:${f.userId}`
      const memories = (await kv.get<MemoryFact[]>(memoriesKey)) ?? []
      const factLower = fact.toLowerCase()
      const bareLower = bare.toLowerCase()
      // Dedup: skip if an existing memory already says this.
      if (
        memories.some((m) => {
          const mLower = m.fact.toLowerCase()
          return mLower === factLower || mLower === bareLower || mLower.includes(bareLower)
        })
      ) {
        continue
      }
      const merged = [...memories, { fact, category: 'preference', created_at: nowISO }].slice(-MEMORY_CAP)
      await kv.set(memoriesKey, merged)
      perUserCount.set(f.userId, (perUserCount.get(f.userId) ?? 0) + 1)
      memWrites.push({ userId: f.userId, userLabel: f.userLabel, fact, createdAt: nowISO, revertedAt: null })
    } catch (err) {
      console.error('[Sage Coach] auto-memory write failed (non-fatal):', err instanceof Error ? err.message : err)
    }
  }
  if (memWrites.length > 0) {
    try {
      const existing = (await kv.get<StoredMemWrite[]>(MEMWRITES_KEY(digestDate))) ?? []
      await kv.set(MEMWRITES_KEY(digestDate), [...existing, ...memWrites])
    } catch (err) {
      console.error('[Sage Coach] memwrites log failed:', err instanceof Error ? err.message : err)
    }
  }

  return { reproBanked, proposalsQueued, nonComplianceFlags, memWrites }
}
