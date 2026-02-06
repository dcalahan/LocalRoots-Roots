'use client';

import { useState, useEffect, useCallback } from 'react';
import { createFreshPublicClient } from '@/lib/viemClient';
import {
  DISPUTE_RESOLUTION_ADDRESS,
  disputeResolutionAbi,
  type Dispute
} from '@/lib/contracts/disputeResolution';

interface DisputesState {
  disputes: (Dispute & { id: bigint })[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all open disputes for ambassador voting
 */
export function useDisputes(): DisputesState {
  const [disputes, setDisputes] = useState<(Dispute & { id: bigint })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisputes = useCallback(async () => {
    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setDisputes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Get all open dispute IDs
      const openDisputeIds = await client.readContract({
        address: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'getOpenDisputes',
      }) as bigint[];

      // Fetch details for each dispute
      const disputePromises = openDisputeIds.map(async (id) => {
        const dispute = await client.readContract({
          address: DISPUTE_RESOLUTION_ADDRESS,
          abi: disputeResolutionAbi,
          functionName: 'getDispute',
          args: [id],
        }) as Dispute;

        return { ...dispute, id };
      });

      const allDisputes = await Promise.all(disputePromises);
      setDisputes(allDisputes);
    } catch (err) {
      console.error('[useDisputes] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return {
    disputes,
    isLoading,
    error,
    refetch: fetchDisputes,
  };
}

/**
 * Hook to fetch a single dispute by ID
 */
export function useDisputeById(disputeId: bigint | null) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDispute = useCallback(async () => {
    if (!disputeId || disputeId === 0n) {
      setDispute(null);
      return;
    }

    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Dispute resolution contract not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      const disputeData = await client.readContract({
        address: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'getDispute',
        args: [disputeId],
      }) as Dispute;

      setDispute(disputeData);
    } catch (err) {
      console.error('[useDisputeById] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch dispute');
    } finally {
      setIsLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    fetchDispute();
  }, [fetchDispute]);

  return { dispute, isLoading, error, refetch: fetchDispute };
}

/**
 * Hook to check if the connected ambassador has voted on a dispute
 */
export function useHasVoted(disputeId: bigint | null, ambassadorId: string | null) {
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!disputeId || !ambassadorId || disputeId === 0n) {
      setHasVoted(false);
      return;
    }

    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    const checkVoted = async () => {
      setIsLoading(true);
      try {
        const client = createFreshPublicClient();

        const voted = await client.readContract({
          address: DISPUTE_RESOLUTION_ADDRESS,
          abi: disputeResolutionAbi,
          functionName: 'hasVoted',
          args: [disputeId, BigInt(ambassadorId)],
        }) as boolean;

        setHasVoted(voted);
      } catch (err) {
        console.error('[useHasVoted] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkVoted();
  }, [disputeId, ambassadorId]);

  return { hasVoted, isLoading };
}

/**
 * Hook to get the count of open disputes (for badge display)
 */
export function useOpenDisputeCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setCount(0);
      setIsLoading(false);
      return;
    }

    const fetchCount = async () => {
      try {
        const client = createFreshPublicClient();

        const openDisputeIds = await client.readContract({
          address: DISPUTE_RESOLUTION_ADDRESS,
          abi: disputeResolutionAbi,
          functionName: 'getOpenDisputes',
        }) as bigint[];

        setCount(openDisputeIds.length);
      } catch (err) {
        console.error('[useOpenDisputeCount] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCount();

    // Poll every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return { count, isLoading };
}
