'use client';

/**
 * useSellerRecruiter — looks up which ambassador recruited a given seller.
 *
 * Why this exists: today the relationship between a seller and their
 * recruiting ambassador goes invisible after registration — even though
 * it's stored on-chain in the AmbassadorRewards contract. The seller
 * dashboard surfaces this so the ambassador stays connected to the
 * gardener they brought into the network.
 *
 * Source: `getSellerRecruitment(sellerId)` on AmbassadorRewards returns
 * `SellerRecruitment.ambassadorId`. If 0, the seller registered without
 * a referral.
 *
 * Returns the ambassador's on-chain record + IPFS profile + loading state.
 * Callers should handle the no-recruiter case gracefully (ambassadorId === 0n).
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

interface SellerRecruiter {
  /** Recruiter ambassador's on-chain record. Null when seller had no recruiter. */
  ambassador: Ambassador | null;
  /** Recruiter ambassador's IPFS profile. Null when not yet loaded or unset. */
  profile: AmbassadorProfile | null;
  /** True while either the contract read or the IPFS fetch is in flight. */
  isLoading: boolean;
}

export function useSellerRecruiter(sellerId: string | null | undefined): SellerRecruiter {
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sellerId) {
      setAmbassador(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const client = createFreshPublicClient();

        // 1. Get the seller's recruiter ambassadorId
        const recruitment = (await client.readContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'getSellerRecruitment',
          args: [BigInt(sellerId)],
        })) as {
          ambassadorId: bigint;
          recruitedAt: bigint;
          totalSalesVolume: bigint;
          totalRewardsPaid: bigint;
          completedOrderCount: bigint;
          uniqueBuyerCount: bigint;
          activated: boolean;
        };

        if (cancelled) return;

        if (!recruitment.ambassadorId || recruitment.ambassadorId === 0n) {
          setAmbassador(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        // 2. Fetch the ambassador record
        const data = (await client.readContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'getAmbassador',
          args: [recruitment.ambassadorId],
        })) as Ambassador;

        if (cancelled) return;

        const amb: Ambassador = {
          wallet: data.wallet,
          uplineId: data.uplineId,
          totalEarned: data.totalEarned,
          totalPending: data.totalPending,
          recruitedSellers: data.recruitedSellers,
          recruitedAmbassadors: data.recruitedAmbassadors,
          createdAt: data.createdAt,
          active: data.active,
          suspended: data.suspended,
          regionGeohash: data.regionGeohash,
          profileIpfs: data.profileIpfs || '',
        };
        setAmbassador(amb);

        // 3. Fetch the IPFS profile (best-effort — recruiter card still
        //    renders without it, just with less polish)
        if (amb.profileIpfs) {
          try {
            const url = getIpfsUrl(amb.profileIpfs);
            const res = await fetch(url);
            if (res.ok && !cancelled) {
              const json = (await res.json()) as AmbassadorProfile;
              setProfile(json);
            }
          } catch {
            /* swallow — non-critical */
          }
        }
      } catch (err) {
        console.warn('[useSellerRecruiter] lookup failed:', err);
        if (!cancelled) {
          setAmbassador(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  return { ambassador, profile, isLoading };
}
