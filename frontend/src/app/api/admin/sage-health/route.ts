/**
 * Sage health — admin-only read of the Venice provider's live state.
 *
 * Returns the most recent snapshot of Venice response headers (balances +
 * rate-limit remaining), the most recent fallback event, and today's
 * fallback count. Surfaces visibility into a path that is otherwise
 * invisible: Sage silently switches from Grok→Claude on any Venice failure.
 *
 *   GET /api/admin/sage-health?adminAddress=0x...
 *
 * Future: a small tile on /admin renders this snapshot. For now the JSON is
 * the source of truth — curl it or build a tile when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { getSageProvider } from '@/lib/ai/sageProvider';
import { readSageHealth } from '@/lib/ai/sageHealth';

async function isAdmin(address: string | null): Promise<boolean> {
  if (!address) return false;
  try {
    const client = createFreshPublicClient();
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

  if (!(await isAdmin(adminAddress))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const config = getSageProvider();
    const veniceConfigured = config.name === 'venice';
    const report = await readSageHealth(config.name, veniceConfigured);
    return NextResponse.json({
      ...report,
      model: config.model,
      displayName: config.displayName,
    });
  } catch (err) {
    console.error('[GET /api/admin/sage-health] error:', err);
    return NextResponse.json(
      { error: 'Failed to read sage health' },
      { status: 500 },
    );
  }
}
