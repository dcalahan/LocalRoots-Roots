/**
 * /api/admin/sage-coach — admin read + proposal-status update for the
 * Sage Coach. Pull-based review surface (no push digest in v1).
 *
 *   GET  ?adminAddress=0x...            → { latestDigest, digestDates, proposals, reproCount, recentMemWrites }
 *   GET  ?adminAddress=0x...&date=YYYY-MM-DD  → { digest } for a specific day
 *   PATCH { adminAddress, id, status }  → update a brain proposal's status
 *
 * Admin-gated via isAdminAddress (marketplace.isAdmin). Proposals are NEVER
 * auto-applied — this endpoint only tracks their review status. Applying an
 * approved rule means a human edits garden-brain.ts + sageRules.ts and stamps
 * appliedInVersion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@/lib/kv'
import { isAdminAddress } from '@/lib/adminAuth'
import type { CoachDigest, StoredBrainProposal, StoredMemWrite } from '@/lib/coach/types'

const PROPOSALS_KEY = 'sage:coach:proposals'
const DIGEST_INDEX_KEY = 'sage:coach:digest:index'
const REPRO_INDEX_KEY = 'sage:coach:repro:index'
const VALID_STATUSES = new Set(['proposed', 'approved', 'applied', 'rejected'])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const adminAddress = searchParams.get('adminAddress')
  if (!(await isAdminAddress(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const date = searchParams.get('date')
  try {
    if (date) {
      const digest = await kv.get<CoachDigest>(`sage:coach:digest:${date}`)
      return NextResponse.json({ digest: digest ?? null })
    }

    const digestDates = (await kv.get<string[]>(DIGEST_INDEX_KEY)) ?? []
    const latestDigest = digestDates[0]
      ? await kv.get<CoachDigest>(`sage:coach:digest:${digestDates[0]}`)
      : null
    const proposals = (await kv.get<StoredBrainProposal[]>(PROPOSALS_KEY)) ?? []
    const reproIndex = (await kv.get<string[]>(REPRO_INDEX_KEY)) ?? []

    // Recent auto-memory writes across the last 7 days.
    const recentMemWrites: StoredMemWrite[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
      const w = (await kv.get<StoredMemWrite[]>(`sage:coach:memwrites:${dt}`)) ?? []
      recentMemWrites.push(...w)
    }

    return NextResponse.json({
      latestDigest: latestDigest ?? null,
      digestDates,
      proposals,
      reproCount: reproIndex.length,
      recentMemWrites,
    })
  } catch (err) {
    console.error('[admin/sage-coach GET] error:', err)
    return NextResponse.json({ error: 'Failed to read coach data' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      adminAddress?: string
      id?: string
      status?: string
      appliedInVersion?: string
    }
    if (!(await isAdminAddress(body.adminAddress))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!body.id || !body.status || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'id and valid status required' }, { status: 400 })
    }

    const proposals = (await kv.get<StoredBrainProposal[]>(PROPOSALS_KEY)) ?? []
    const idx = proposals.findIndex((p) => p.id === body.id)
    if (idx === -1) {
      return NextResponse.json({ error: 'proposal not found' }, { status: 404 })
    }
    proposals[idx] = {
      ...proposals[idx],
      status: body.status as StoredBrainProposal['status'],
      reviewedAt: new Date().toISOString(),
      appliedInVersion: body.appliedInVersion ?? proposals[idx].appliedInVersion ?? null,
    }
    await kv.set(PROPOSALS_KEY, proposals)
    return NextResponse.json({ ok: true, proposal: proposals[idx] })
  } catch (err) {
    console.error('[admin/sage-coach PATCH] error:', err)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }
}
