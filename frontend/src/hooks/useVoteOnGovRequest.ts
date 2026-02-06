'use client';

import { useState, useCallback } from 'react';
import { useGaslessTransaction } from './useGaslessTransaction';
import {
  GOVERNMENT_REQUESTS_ADDRESS,
  governmentRequestsAbi,
} from '@/lib/contracts/governmentRequests';

interface VoteOnRequestResult {
  vote: (requestId: bigint, approve: boolean) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for ambassadors to vote on government data requests (gasless)
 */
export function useVoteOnGovRequest(): VoteOnRequestResult {
  const { executeGasless, isLoading: gaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = useCallback(async (requestId: bigint, approve: boolean): Promise<boolean> => {
    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Government requests contract not configured');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txHash = await executeGasless({
        to: GOVERNMENT_REQUESTS_ADDRESS,
        abi: governmentRequestsAbi,
        functionName: 'voteOnRequest',
        args: [requestId, approve],
      });

      if (!txHash) {
        throw new Error(gaslessError || 'Transaction failed');
      }

      console.log('[useVoteOnGovRequest] Vote submitted:', txHash);
      return true;
    } catch (err) {
      console.error('[useVoteOnGovRequest] Error:', err);
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
 * Hook for submitting a government data request (public, no gasless needed)
 * Government agencies submit directly with their own gas
 */
export function useSubmitGovRequest() {
  // Note: Government requests are submitted by external parties
  // They would need their own wallet and gas
  // For now, we just provide the interface - actual submission
  // would be via direct wallet connection

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequest = useCallback(async (
    agencyName: string,
    agencyEmail: string,
    jurisdiction: string,
    requestType: string,
    justification: string,
    credentialsIpfs: string
  ): Promise<boolean> => {
    // This would typically be called via a direct wallet transaction
    // since government agents aren't LocalRoots users with Privy wallets
    setError('Government request submission requires a direct wallet connection');
    return false;
  }, []);

  return {
    submitRequest,
    isLoading,
    error,
  };
}

/**
 * Hook for resolving a government request after voting ends (gasless)
 */
export function useResolveGovRequest() {
  const { executeGasless, isLoading: gaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveRequest = useCallback(async (requestId: bigint): Promise<boolean> => {
    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Government requests contract not configured');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const txHash = await executeGasless({
        to: GOVERNMENT_REQUESTS_ADDRESS,
        abi: governmentRequestsAbi,
        functionName: 'resolveRequest',
        args: [requestId],
      });

      if (!txHash) {
        throw new Error(gaslessError || 'Transaction failed');
      }

      console.log('[useResolveGovRequest] Request resolved:', txHash);
      return true;
    } catch (err) {
      console.error('[useResolveGovRequest] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve request');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [executeGasless, gaslessError]);

  return {
    resolveRequest,
    isLoading: isLoading || gaslessLoading,
    error: error || gaslessError,
  };
}
