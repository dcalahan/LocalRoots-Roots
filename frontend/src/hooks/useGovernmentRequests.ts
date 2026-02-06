'use client';

import { useState, useEffect, useCallback } from 'react';
import { createFreshPublicClient } from '@/lib/viemClient';
import {
  GOVERNMENT_REQUESTS_ADDRESS,
  governmentRequestsAbi,
  type DataRequest
} from '@/lib/contracts/governmentRequests';

interface GovernmentRequestsState {
  requests: (DataRequest & { id: bigint })[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all government data requests (for public transparency)
 */
export function useGovernmentRequests(): GovernmentRequestsState {
  const [requests, setRequests] = useState<(DataRequest & { id: bigint })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Get all request IDs
      const allRequestIds = await client.readContract({
        address: GOVERNMENT_REQUESTS_ADDRESS,
        abi: governmentRequestsAbi,
        functionName: 'getAllRequests',
      }) as bigint[];

      // Fetch details for each request
      const requestPromises = allRequestIds.map(async (id) => {
        const request = await client.readContract({
          address: GOVERNMENT_REQUESTS_ADDRESS,
          abi: governmentRequestsAbi,
          functionName: 'getRequest',
          args: [id],
        }) as DataRequest;

        return { ...request, id };
      });

      const allRequests = await Promise.all(requestPromises);
      setRequests(allRequests);
    } catch (err) {
      console.error('[useGovernmentRequests] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    refetch: fetchRequests,
  };
}

/**
 * Hook to fetch only active (unresolved) government requests
 */
export function useActiveGovernmentRequests() {
  const [requests, setRequests] = useState<(DataRequest & { id: bigint })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Get active request IDs
      const activeRequestIds = await client.readContract({
        address: GOVERNMENT_REQUESTS_ADDRESS,
        abi: governmentRequestsAbi,
        functionName: 'getActiveRequests',
      }) as bigint[];

      // Fetch details for each request
      const requestPromises = activeRequestIds.map(async (id) => {
        const request = await client.readContract({
          address: GOVERNMENT_REQUESTS_ADDRESS,
          abi: governmentRequestsAbi,
          functionName: 'getRequest',
          args: [id],
        }) as DataRequest;

        return { ...request, id };
      });

      const allRequests = await Promise.all(requestPromises);
      setRequests(allRequests);
    } catch (err) {
      console.error('[useActiveGovernmentRequests] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return {
    requests,
    isLoading,
    error,
    refetch: fetchRequests,
  };
}

/**
 * Hook to fetch a single request by ID
 */
export function useGovernmentRequestById(requestId: bigint | null) {
  const [request, setRequest] = useState<DataRequest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!requestId || requestId === 0n) {
      setRequest(null);
      return;
    }

    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Government requests contract not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      const requestData = await client.readContract({
        address: GOVERNMENT_REQUESTS_ADDRESS,
        abi: governmentRequestsAbi,
        functionName: 'getRequest',
        args: [requestId],
      }) as DataRequest;

      setRequest(requestData);
    } catch (err) {
      console.error('[useGovernmentRequestById] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch request');
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  return { request, isLoading, error, refetch: fetchRequest };
}

/**
 * Hook to check if the connected ambassador has voted on a request
 */
export function useHasVotedOnRequest(requestId: bigint | null, ambassadorId: string | null) {
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!requestId || !ambassadorId || requestId === 0n) {
      setHasVoted(false);
      return;
    }

    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return;
    }

    const checkVoted = async () => {
      setIsLoading(true);
      try {
        const client = createFreshPublicClient();

        const voted = await client.readContract({
          address: GOVERNMENT_REQUESTS_ADDRESS,
          abi: governmentRequestsAbi,
          functionName: 'hasVotedOnRequest',
          args: [requestId, BigInt(ambassadorId)],
        }) as boolean;

        setHasVoted(voted);
      } catch (err) {
        console.error('[useHasVotedOnRequest] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkVoted();
  }, [requestId, ambassadorId]);

  return { hasVoted, isLoading };
}

/**
 * Hook to get the count of active government requests (for badge display)
 */
export function useActiveRequestCount() {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (GOVERNMENT_REQUESTS_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setCount(0);
      setIsLoading(false);
      return;
    }

    const fetchCount = async () => {
      try {
        const client = createFreshPublicClient();

        const activeRequestIds = await client.readContract({
          address: GOVERNMENT_REQUESTS_ADDRESS,
          abi: governmentRequestsAbi,
          functionName: 'getActiveRequests',
        }) as bigint[];

        setCount(activeRequestIds.length);
      } catch (err) {
        console.error('[useActiveRequestCount] Error:', err);
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
