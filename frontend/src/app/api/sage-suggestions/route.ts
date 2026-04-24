/**
 * Sage Suggestions API — admin-only read + update.
 *
 * Captures themselves are written server-side from the garden-ai route's
 * after() block via `saveSuggestion()` in lib/sageSuggestions.ts. There is
 * no public POST endpoint — Sage's confirmation in conversation is the
 * only path to creation.
 *
 * Endpoints:
 *   GET    /api/sage-suggestions?adminAddress=0x...   — list, newest first
 *   PATCH  /api/sage-suggestions                       — update status / notes (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { ACTIVE_CHAIN } from '@/lib/chainConfig';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import {
  listSuggestions,
  updateSuggestion,
} from '@/lib/sageSuggestions';
import {
  SUGGESTION_STATUSES,
  type SuggestionStatus,
} from '@/types/sage-suggestion';

async function isAdmin(address: string | null): Promise<boolean> {
  if (!address) return false;
  try {
    const client = createPublicClient({ chain: ACTIVE_CHAIN, transport: http() });
    const result = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'isAdmin',
      args: [address as `0x${string}`],
    });
    return result as boolean;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const adminAddress = searchParams.get('adminAddress');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  if (!(await isAdmin(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const suggestions = await listSuggestions(limit, offset);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[GET /api/sage-suggestions] error:', err);
    return NextResponse.json(
      { error: 'Failed to list suggestions' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, adminAddress, status, notes } = body as {
      id?: string;
      adminAddress?: string;
      status?: string;
      notes?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }
    if (!(await isAdmin(adminAddress || null))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (
      status !== undefined &&
      !SUGGESTION_STATUSES.includes(status as SuggestionStatus)
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes must be a string' }, { status: 400 });
    }

    const patch: Parameters<typeof updateSuggestion>[1] = {};
    if (status !== undefined) {
      patch.status = status as SuggestionStatus;
    }
    if (notes !== undefined) {
      patch.notes = notes.slice(0, 4000);
    }
    patch.reviewedAt = new Date().toISOString();
    patch.reviewedBy = adminAddress!;

    const updated = await updateSuggestion(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ suggestion: updated });
  } catch (err) {
    console.error('[PATCH /api/sage-suggestions] error:', err);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 },
    );
  }
}
