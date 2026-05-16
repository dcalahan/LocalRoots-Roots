/**
 * Shared server-side admin authentication helper.
 *
 * Checks whether an address is in the LocalRootsMarketplace contract's
 * isAdmin mapping. Extracted from previously-duplicated logic in
 * /api/sage-suggestions, /api/payments — same pattern, three call sites.
 *
 * Usage:
 *   const isAdmin = await isAdminAddress(req.searchParams.get('adminAddress'));
 *   if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
 *
 * Returns false (never throws) for: null address, malformed address,
 * RPC failure, or non-admin address. This is the right default — admin
 * gating should fail closed.
 */

import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

export async function isAdminAddress(address: string | null | undefined): Promise<boolean> {
  if (!address || typeof address !== 'string') return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
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
