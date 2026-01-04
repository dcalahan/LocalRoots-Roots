import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';

const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

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

export interface GlobalSeedsStats {
  totalSeeds: string;
  totalSeedsFromPurchases: string;
  totalSeedsFromSales: string;
  totalSeedsFromReferrals: string;
  totalSeedsFromMilestones: string;
  totalSeedsFromRecruitments: string;
  uniqueEarners: string;
}

export interface SeedsEvent {
  id: string;
  user: string;
  amount: string;
  adjustedAmount: string;
  reason: string;
  orderId: string | null;
  milestone: string | null;
  multiplier: number;
  timestamp: string;
}

// Fetch a user's Seeds balance
export function useSeeds(address: Address | undefined) {
  return useQuery({
    queryKey: ['seeds', address],
    enabled: !!address && !!SUBGRAPH_URL,
    queryFn: async () => {
      if (!SUBGRAPH_URL) return null;

      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            seedsBalance(id: "${address?.toLowerCase()}") {
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
          }`
        })
      });
      const { data } = await res.json();
      return data?.seedsBalance as SeedsBalance | null;
    },
    staleTime: 30000, // 30 seconds
  });
}

// Fetch global Seeds stats
export function useGlobalSeedsStats() {
  return useQuery({
    queryKey: ['globalSeedsStats'],
    enabled: !!SUBGRAPH_URL,
    queryFn: async () => {
      if (!SUBGRAPH_URL) return null;

      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            globalSeedsStats(id: "global") {
              totalSeeds
              totalSeedsFromPurchases
              totalSeedsFromSales
              totalSeedsFromReferrals
              totalSeedsFromMilestones
              totalSeedsFromRecruitments
              uniqueEarners
            }
          }`
        })
      });
      const { data } = await res.json();
      return data?.globalSeedsStats as GlobalSeedsStats | null;
    },
    staleTime: 30000,
  });
}

// Fetch leaderboard (top Seeds earners)
export function useSeedsLeaderboard(limit: number = 50, skip: number = 0) {
  return useQuery({
    queryKey: ['seedsLeaderboard', limit, skip],
    enabled: !!SUBGRAPH_URL,
    queryFn: async () => {
      if (!SUBGRAPH_URL) return [];

      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            seedsBalances(
              first: ${limit}
              skip: ${skip}
              orderBy: total
              orderDirection: desc
            ) {
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
          }`
        })
      });
      const { data } = await res.json();
      return (data?.seedsBalances || []) as SeedsBalance[];
    },
    staleTime: 60000, // 1 minute
  });
}

// Fetch user's Seeds event history
export function useSeedsHistory(address: Address | undefined, limit: number = 20) {
  return useQuery({
    queryKey: ['seedsHistory', address, limit],
    enabled: !!address && !!SUBGRAPH_URL,
    queryFn: async () => {
      if (!SUBGRAPH_URL) return [];

      const res = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{
            seedsEvents(
              first: ${limit}
              where: { user: "${address?.toLowerCase()}" }
              orderBy: timestamp
              orderDirection: desc
            ) {
              id
              user
              amount
              adjustedAmount
              reason
              orderId
              milestone
              multiplier
              timestamp
            }
          }`
        })
      });
      const { data } = await res.json();
      return (data?.seedsEvents || []) as SeedsEvent[];
    },
    staleTime: 30000,
  });
}

// Format Seeds amount (divide by 1e6 for display)
export function formatSeeds(amount: string | number | bigint): string {
  const num = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const whole = num / BigInt(1e6);
  return whole.toLocaleString();
}

// Format Seeds with decimals
export function formatSeedsWithDecimals(amount: string | number | bigint, decimals: number = 2): string {
  const num = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);
  const divisor = BigInt(1e6);
  const whole = num / divisor;
  const remainder = num % divisor;
  const decimal = Number(remainder) / 1e6;

  if (decimals === 0) {
    return whole.toLocaleString();
  }

  return (Number(whole) + decimal).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
