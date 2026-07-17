/**
 * /api/cron/sage-coach — the Sage Nightly Coach.
 *
 * Reviews the last 24h of Sage conversations with a Claude-Haiku analyst
 * (a separate model from Sage's Grok — the witness doesn't share the
 * subject's blind spots), stores findings, banks repro cases (the L3 asset),
 * queues brain proposals (L2, human-apply), and autonomously writes per-user
 * suppression memories (L2.5 — the channel that fixes an individual's
 * experience without a human step). Renders a digest to KV for the admin tab.
 *
 * Two access paths (mirrors /api/admin/rp-index):
 *   GET /api/cron/sage-coach
 *     Vercel Cron — `Authorization: Bearer ${CRON_SECRET}`. Runs at 10:00 UTC.
 *   GET /api/cron/sage-coach?force=true&adminAddress=0x...
 *     Manual trigger from the admin UI. Requires isAdminAddress.
 *
 * No SAGE_BRAIN_VERSION bump, no Sage prompt change — additive infra.
 * Ladder: docs live in ~/.claude/plans/sage-coach.md + undercontract
 * COACH-AUTONOMY-LADDER.md. This is L2 + L2.5; L3 auto-apply is NOT built.
 */

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { isAdminAddress } from '@/lib/adminAuth'
import { gatherConversations, reviewConversation } from '@/lib/coach/review'
import { applyAutonomyLadder } from '@/lib/coach/autonomy'
import type { StoredFinding, CoachDigest } from '@/lib/coach/types'

export const maxDuration = 300 // analyst calls fan out over the day's conversations

const TYPE_LABELS: Record<string, string> = {
  advice_error: '🌡️ Wrong advice',
  fabrication: '🫥 Fabrication',
  repetition: '🔁 Repetition',
  ignored_instruction: '🙉 Ignored instruction',
  persona_slip: '🎭 Persona slip',
  knowledge_gap: '📚 Knowledge gap',
  user_correction: '↩️ User correction',
  friction: '🧱 Friction',
  feature_request: '💡 Feature request',
  delight: '💎 Delight',
}
const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }
const DIGEST_INDEX_KEY = 'sage:coach:digest:index'
const DIGEST_INDEX_CAP = 90

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'
  const adminAddress = searchParams.get('adminAddress')

  // ── Auth (mirrors /api/admin/rp-index) ──────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isCronCall = cronSecret ? authHeader === `Bearer ${cronSecret}` : !force
  let authPath: 'cron' | 'admin' | 'denied' = 'denied'
  if (isCronCall) authPath = 'cron'
  else if (force && adminAddress && (await isAdminAddress(adminAddress))) authPath = 'admin'
  if (authPath === 'denied') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const digestDate = todayUTC()
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()

  // ── Gather ──────────────────────────────────────────────────────────
  const bundles = await gatherConversations(since)
  if (bundles.length === 0) {
    return NextResponse.json({ reviewed: 0, findings: 0, note: 'no conversations in window' })
  }

  // ── Review (tolerate individual failures) ───────────────────────────
  const all: StoredFinding[] = []
  const seen = new Set<string>()
  for (const b of bundles) {
    try {
      const findings = await reviewConversation(b)
      for (const f of findings) {
        const key = `${f.finding_type}|${f.evidence.slice(0, 120)}`
        if (seen.has(key)) continue
        seen.add(key)
        all.push({ ...f, userId: b.userId, userLabel: b.userLabel, ref: b.ref, digestDate })
      }
    } catch (err) {
      console.error(`[Sage Coach] review failed for ${b.ref}:`, err instanceof Error ? err.message : err)
    }
  }

  // Store the day's findings (append — a manual re-run adds, dedup by content above)
  if (all.length > 0) {
    try {
      const existing = (await kv.get<StoredFinding[]>(`sage:coach:findings:${digestDate}`)) ?? []
      const existingKeys = new Set(existing.map((f) => `${f.finding_type}|${f.evidence.slice(0, 120)}`))
      const fresh = all.filter((f) => !existingKeys.has(`${f.finding_type}|${f.evidence.slice(0, 120)}`))
      await kv.set(`sage:coach:findings:${digestDate}`, [...existing, ...fresh])
    } catch (err) {
      console.error('[Sage Coach] findings write failed:', err instanceof Error ? err.message : err)
    }
  }

  // ── Autonomy Ladder L2 + L2.5 ───────────────────────────────────────
  const ladder = await applyAutonomyLadder(all, digestDate)

  // ── Trend: open findings by type over the last 14 days ──────────────
  const trend: Record<string, number> = {}
  try {
    for (let d = 0; d < 14; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
      const dayFindings = (await kv.get<StoredFinding[]>(`sage:coach:findings:${date}`)) ?? []
      for (const f of dayFindings) trend[f.finding_type] = (trend[f.finding_type] ?? 0) + 1
    }
  } catch {
    /* trend is best-effort */
  }

  // ── Render digest ───────────────────────────────────────────────────
  const sorted = [...all].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3))
  const delights = sorted.filter((f) => f.finding_type === 'delight')
  const issues = sorted.filter((f) => f.finding_type !== 'delight')

  const section = (items: StoredFinding[]) =>
    items
      .map(
        (f) => `<div style="margin:0 0 14px 0;padding:12px;border-left:3px solid ${
          f.severity === 'high' ? '#EB6851' : '#ddd'
        };background:#faf8f7">
      <div style="font-weight:600">${TYPE_LABELS[f.finding_type] ?? f.finding_type} · ${f.severity.toUpperCase()} · ${escapeHtml(f.userLabel)}${
        (trend[f.finding_type] ?? 0) > 1 ? ` · seen ${trend[f.finding_type]}× in 14d` : ''
      }</div>
      <div style="margin:6px 0;color:#444;font-style:italic">"${escapeHtml(f.evidence)}"</div>
      <div style="color:#2D2D2D">→ ${escapeHtml(f.suggestion ?? '')}</div>
    </div>`,
      )
      .join('')

  const memHtml = ladder.memWrites.length
    ? `<h3>🔁 Auto-applied per-user memories (reversible)</h3>
       <ul>${ladder.memWrites
         .map((m) => `<li><strong>${escapeHtml(m.userLabel)}</strong>: ${escapeHtml(m.fact)}</li>`)
         .join('')}</ul>
       <p style="color:#818181;font-size:12px">Scoped to one user each; logged in sage:coach:memwrites. This is the channel that fixes an individual's Sage without a human step.</p>`
    : ''

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:640px;color:#2D2D2D">
      <h2 style="margin:0 0 4px 0">Sage — Nightly Coach</h2>
      <p style="color:#818181;margin:0 0 20px 0">${bundles.length} conversation${
        bundles.length === 1 ? '' : 's'
      } reviewed · ${issues.length} finding${issues.length === 1 ? '' : 's'} · ${delights.length} delight${
        delights.length === 1 ? '' : 's'
      } · ${digestDate}</p>
      ${issues.length ? `<h3>Findings</h3>${section(issues)}` : '<p>Clean day — no findings.</p>'}
      ${
        ladder.proposalsQueued || ladder.nonComplianceFlags
          ? `<h3>🧠 Brain PRs</h3><p>${ladder.proposalsQueued} new rule proposal${
              ladder.proposalsQueued === 1 ? '' : 's'
            } queued for review · ${ladder.nonComplianceFlags} non-compliance flag${
              ladder.nonComplianceFlags === 1 ? '' : 's'
            }. Review + apply in the Sage Coach admin tab (never auto-applied).</p>`
          : ''
      }
      ${memHtml}
      ${delights.length ? `<h3>💎 What worked</h3>${section(delights)}` : ''}
      <p style="color:#818181;font-size:12px;margin-top:24px">${
        ladder.reproBanked
      } repro case${ladder.reproBanked === 1 ? '' : 's'} banked for the eval suite (L3 asset). Evidence quotes may contain user PII — internal only.</p>
    </div>`

  const digest: CoachDigest = {
    date: digestDate,
    reviewed: bundles.length,
    findingsCount: issues.length,
    delightsCount: delights.length,
    proposalsCount: ladder.proposalsQueued,
    memWritesCount: ladder.memWrites.length,
    reproBankedCount: ladder.reproBanked,
    html,
    generatedAt: new Date().toISOString(),
  }
  try {
    await kv.set(`sage:coach:digest:${digestDate}`, digest)
    const index = (await kv.get<string[]>(DIGEST_INDEX_KEY)) ?? []
    if (!index.includes(digestDate)) {
      await kv.set(DIGEST_INDEX_KEY, [digestDate, ...index].slice(0, DIGEST_INDEX_CAP))
    }
  } catch (err) {
    console.error('[Sage Coach] digest write failed:', err instanceof Error ? err.message : err)
  }

  return NextResponse.json({
    triggeredBy: authPath,
    reviewed: bundles.length,
    findings: issues.length,
    delights: delights.length,
    reproBanked: ladder.reproBanked,
    proposalsQueued: ladder.proposalsQueued,
    nonComplianceFlags: ladder.nonComplianceFlags,
    memWrites: ladder.memWrites.length,
    date: digestDate,
  })
}
