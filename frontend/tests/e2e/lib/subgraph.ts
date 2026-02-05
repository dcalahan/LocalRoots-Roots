import type { Address } from 'viem';

const SUBGRAPH_URL = process.env.SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/1722311/localroots-subgraph/v0.0.2';

export interface SeedsBalance {
  id: string;
  user: string;
  purchases: string;
  sales: string;
  referrals: string;
  milestones: string;
  recruitments: string;
  total: string;
  lastUpdated: string;
  eventCount: string;
}

/**
 * Query Seeds balance from the subgraph.
 * Includes a delay to allow for indexing.
 */
export async function querySeedsBalance(
  address: Address,
  delayMs = 15_000
): Promise<SeedsBalance | null> {
  if (delayMs > 0) {
    console.log(`[Subgraph] Waiting ${delayMs / 1000}s for indexing...`);
    await new Promise(r => setTimeout(r, delayMs));
  }

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        seedsBalance(id: "${address.toLowerCase()}") {
          id
          user
          purchases
          sales
          referrals
          milestones
          recruitments
          total
          lastUpdated
          eventCount
        }
      }`,
    }),
  });

  const { data } = await res.json();
  return data?.seedsBalance || null;
}

/**
 * Query Seeds events for a user.
 */
export async function querySeedsEvents(
  address: Address,
  limit = 20
): Promise<Array<{
  id: string;
  reason: string;
  amount: string;
  adjustedAmount: string;
  orderId: string | null;
  timestamp: string;
}>> {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        seedsEvents(
          first: ${limit}
          where: { user: "${address.toLowerCase()}" }
          orderBy: timestamp
          orderDirection: desc
        ) {
          id
          reason
          amount
          adjustedAmount
          orderId
          timestamp
        }
      }`,
    }),
  });

  const { data } = await res.json();
  return data?.seedsEvents || [];
}
