'use client';

import { useState, useCallback } from 'react';
import { useGaslessTransaction } from './useGaslessTransaction';
import {
  DISPUTE_RESOLUTION_ADDRESS,
  disputeResolutionAbi,
} from '@/lib/contracts/disputeResolution';

interface VoteOnDisputeResult {
  vote: (disputeId: bigint, voteForBuyer: boolean) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for ambassadors to vote on disputes (gasless)
 */
export function useVoteOnDispute(): VoteOnDisputeResult {
  const { executeGasless, isLoading: gaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = useCallback(async (disputeId: bigint, voteForBuyer: boolean): Promise<boolean> => {
    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Dispute resolution contract not configured');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'vote',
        args: [disputeId, voteForBuyer],
      });

      if (!txHash) {
        throw new Error(gaslessError || 'Transaction failed');
      }

      console.log('[useVoteOnDispute] Vote submitted:', txHash);
      return true;
    } catch (err) {
      console.error('[useVoteOnDispute] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [executeGasless, gaslessError]);

  return {
    vote,
    isLoading: isLoading || gaslessLoading,
    error: error || gaslessError,
  };
}

/**
 * Hook for sellers to submit a response to a dispute (gasless)
 */
export function useSubmitSellerResponse() {
  const { executeGasless, isLoading: gaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitResponse = useCallback(async (
    disputeId: bigint,
    response: string,
    evidenceIpfs: string
  ): Promise<boolean> => {
    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Dispute resolution contract not configured');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'submitSellerResponse',
        args: [disputeId, response, evidenceIpfs],
      });

      if (!txHash) {
        throw new Error(gaslessError || 'Transaction failed');
      }

      console.log('[useSubmitSellerResponse] Response submitted:', txHash);
      return true;
    } catch (err) {
      console.error('[useSubmitSellerResponse] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit response');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [executeGasless, gaslessError]);

  return {
    submitResponse,
    isLoading: isLoading || gaslessLoading,
    error: error || gaslessError,
  };
}

/**
 * Hook for resolving a dispute after voting ends (gasless)
 */
export function useResolveDispute() {
  const { executeGasless, isLoading: gaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveDispute = useCallback(async (disputeId: bigint): Promise<boolean> => {
    if (DISPUTE_RESOLUTION_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Dispute resolution contract not configured');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txHash = await executeGasless({
        to: DISPUTE_RESOLUTION_ADDRESS,
        abi: disputeResolutionAbi,
        functionName: 'resolveDispute',
        args: [disputeId],
      });

      if (!txHash) {
        throw new Error(gaslessError || 'Transaction failed');
      }

      console.log('[useResolveDispute] Dispute resolved:', txHash);
      return true;
    } catch (err) {
      console.error('[useResolveDispute] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve dispute');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [executeGasless, gaslessError]);

  return {
    resolveDispute,
    isLoading: isLoading || gaslessLoading,
    error: error || gaslessError,
  };
}
