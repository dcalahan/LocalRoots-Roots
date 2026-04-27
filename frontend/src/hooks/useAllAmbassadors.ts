'use client';

/**
 * useAllAmbassadors — enumerates all active, non-suspended ambassadors
 * with their IPFS profiles loaded.
 *
 * Pre-launch we have few enough ambassadors (single digits → maybe
 * dozens) that iterating from id 1 to nextAmbassadorId is fine. When
 * we hit hundreds, this needs pagination + caching. Subgraph would be
 * the right destination eventually.
 *
 * Privacy: ambassador identity (wallet, recruited counts, region) is
 * already public on-chain. The IPFS profile (name, bio, photo) is
 * already public via the gateway. This hook is just aggregation —
 * no new privacy surface.
 */

import { useEffect, useState } from 'react';
import { createFreshPublicClient } from '@/lib/viemClient';
import {
  AMBASSADOR_REWARDS_ADDRESS,
  ambassadorAbi,
  type Ambassador,
  type AmbassadorProfile,
} from '@/lib/contracts/ambassador';
import { getIpfsUrl } from '@/lib/pinata';

export interface AmbassadorWithProfile {
  id: string;
  ambassador: Ambassador;
  profile: AmbassadorProfile | null;
}

export function useAllAmbassadors() {
  const [data, setData] = useState<AmbassadorWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const client = createFreshPublicClient();
        const next = (await client.readContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'nextAmbassadorId',
        })) as bigint;

        if (next === 0n || next === 1n) {
          if (!cancelled) {
            setData([]);
            setIsLoading(false);
          }
          return;
        }

        // Ambassadors are 1-indexed. nextAmbassadorId is the NEXT id to assign,
        // so the highest assigned id is next - 1. Loop ids 1..(next-1).
        const ids = Array.from({ length: Number(next - 1n) }, (_, i) => BigInt(i + 1));

        const records = await Promise.all(
          ids.map(async (id) => {
            try {
              const a = (await client.readContract({
                address: AMBASSADOR_REWARDS_ADDRESS,
                abi: ambassadorAbi,
                functionName: 'getAmbassador',
                args: [id],
              })) as Ambassador;
              return { id: id.toString(), ambassador: a };
            } catch {
              return null;
            }
          }),
        );

        const live = records.filter(
          (r): r is { id: string; ambassador: Ambassador } =>
            r !== null && r.ambassador.active && !r.ambassador.suspended,
        );

        // Fetch IPFS profiles in parallel — best effort
        const withProfiles = await Promise.all(
          live.map(async ({ id, ambassador }) => {
            let profile: AmbassadorProfile | null = null;
            if (ambassador.profileIpfs) {
              try {
                const res = await fetch(getIpfsUrl(ambassador.profileIpfs));
                if (res.ok) profile = (await res.json()) as AmbassadorProfile;
              } catch {
                /* swallow */
              }
            }
            return { id, ambassador, profile };
          }),
        );

        if (cancelled) return;

        // Sort: Chiefs first (lead ambassadors get featured placement),
        // then by recruit count desc, then most recent registration.
        withProfiles.sort((a, b) => {
          const aChief = a.profile?.isChief ? 1 : 0;
          const bChief = b.profile?.isChief ? 1 : 0;
          if (aChief !== bChief) return bChief - aChief;
          const recruitDiff =
            Number(b.ambassador.recruitedSellers) - Number(a.ambassador.recruitedSellers);
          if (recruitDiff !== 0) return recruitDiff;
          return Number(b.ambassador.createdAt) - Number(a.ambassador.createdAt);
        });

        setData(withProfiles);
      } catch (err) {
        console.warn('[useAllAmbassadors]', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed to load');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading, error };
}
