'use client';

/**
 * useOffchainRP — read the current user's off-chain Roots Points summary.
 *
 * Companion to the existing on-chain RP read path (useSeeds, etc. read from
 * the subgraph). This hook reads the off-chain KV store via the
 * /api/offchain-rp endpoint.
 *
 * Returns `{ total, byVerb, isLoading, error, refetch }`. Designed for
 * lightweight always-mounted use in the header (RootsPointsPill) — fetches
 * once on mount, refetches when the user signs in/out or when refetch() is
 * called from a mutating surface (e.g. after AddPlantsModal saves).
 *
 * Auto-refetch on mount + on userId change. No polling — the header pill
 * doesn't need real-time precision and we don't want to hammer KV.
 *
 * If userId is null/undefined (anonymous user), returns a zero-valued
 * summary without making a network request. Matches the library's
 * "anonymous earns nothing" rule.
 */

import { useCallback, useEffect, useState } from 'react';
import type { UserRPSummary } from '@/lib/offchainRP';

/**
 * Per-verb counts + RP earned TODAY. Populated server-side from the
 * existing `rp:offchain:daily:{addr}:{verbId}:{YYYY-MM-DD}` keys.
 * Used by /profile's "Today's Earnings" panel to give users a quiet
 * way to see what they've earned today without exposing cap arithmetic.
 */
export interface TodayByVerb {
  [verbId: string]: { count: number; rp: number };
}

type OffchainRPResponse = UserRPSummary & { todayByVerb?: TodayByVerb };

const EMPTY_SUMMARY: UserRPSummary = {
  total: 0,
  lastUpdated: new Date(0).toISOString(),
  byVerb: {},
};

export function useOffchainRP(userId: string | null | undefined) {
  const [summary, setSummary] = useState<UserRPSummary>(EMPTY_SUMMARY);
  const [todayByVerb, setTodayByVerb] = useState<TodayByVerb>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setSummary(EMPTY_SUMMARY);
      setTodayByVerb({});
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/offchain-rp?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as OffchainRPResponse;
      setSummary({
        total: data.total,
        lastUpdated: data.lastUpdated,
        byVerb: data.byVerb,
      });
      setTodayByVerb(data.todayByVerb ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Roots Points');
      // Don't clobber the existing summary on a transient failure — keep
      // the last-known total visible so the header pill doesn't flicker
      // to "0 RP" on a flaky network.
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refetch when any surface fires `app:rp-credited`. This is the
  // global event-bus pattern that keeps the hook + the credit-emitting
  // surfaces decoupled. Every off-chain RP earning verb (plant-added
  // today, sage-daily / photos / etc. in Phase 2) fires the same event;
  // every consumer of this hook reacts uniformly.
  //
  // We only refetch for events tied to the current userId — multi-tab or
  // shared-device cases where another user's event could fire here would
  // otherwise show stale numbers. The detail includes userId from the
  // dispatcher (useMyGarden); we filter.
  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string }>).detail;
      if (!detail || detail.userId === userId) {
        refetch();
      }
    };
    window.addEventListener('app:rp-credited', handler);
    return () => window.removeEventListener('app:rp-credited', handler);
  }, [userId, refetch]);

  return {
    summary,
    total: summary.total,
    byVerb: summary.byVerb,
    todayByVerb,
    isLoading,
    error,
    refetch,
  };
}
