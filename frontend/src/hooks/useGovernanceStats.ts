'use client';

import { useState, useEffect } from 'react';
import { createFreshPublicClient } from '@/lib/viemClient';
import {
  DISPUTE_RESOLUTION_ADDRESS,
  disputeResolutionAbi,
} from '@/lib/contracts/disputeResolution';
import {
  GOVERNMENT_REQUESTS_ADDRESS,
  governmentRequestsAbi,
} from '@/lib/contracts/governmentRequests';

interface GovernanceStats {
  // Disputes
  totalDisputes: number;
  openDisputes: number;
  resolvedDisputes: number;
  qualifiedVoters: number;
  // Government Requests
  totalGovRequests: number;
  activeGovRequests: number;
  // Loading state
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to fetch governance statistics for the dashboard
 */
export function useGovernanceStats(): GovernanceStats {
  const [stats, setStats] = useState<GovernanceStats>({
    totalDisputes: 0,
    openDisputes: 0,
    resolvedDisputes: 0,
    qualifiedVoters: 0,
    totalGovRequests: 0,
    activeGovRequests: 0,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const client = createFreshPublicClient();

      try {
        const results: Partial<GovernanceStats> = {
          isLoading: false,
          error: null,
        };

        // Fetch dispute stats if contract is configured
        if (DISPUTE_RESOLUTION_ADDRESS !== '0x0000000000000000000000000000000000000000') {
          try {
            const [nextDisputeId, openDisputeIds, qualifiedVoters] = await Promise.all([
              client.readContract({
                address: DISPUTE_RESOLUTION_ADDRESS,
                abi: disputeResolutionAbi,
                functionName: 'nextDisputeId',
              }) as Promise<bigint>,
              client.readContract({
                address: DISPUTE_RESOLUTION_ADDRESS,
                abi: disputeResolutionAbi,
                functionName: 'getOpenDisputes',
              }) as Promise<bigint[]>,
              client.readContract({
                address: DISPUTE_RESOLUTION_ADDRESS,
                abi: disputeResolutionAbi,
                functionName: 'getQualifiedVoterCount',
              }) as Promise<bigint>,
            ]);

            const total = Number(nextDisputeId) - 1; // IDs start at 1
            const open = openDisputeIds.length;

            results.totalDisputes = Math.max(0, total);
            results.openDisputes = open;
            results.resolvedDisputes = Math.max(0, total - open);
            results.qualifiedVoters = Number(qualifiedVoters);
          } catch (err) {
            console.error('[useGovernanceStats] Dispute fetch error:', err);
          }
        }

        // Fetch government request stats if contract is configured
        if (GOVERNMENT_REQUESTS_ADDRESS !== '0x0000000000000000000000000000000000000000') {
          try {
            const [nextRequestId, activeRequestIds] = await Promise.all([
              client.readContract({
                address: GOVERNMENT_REQUESTS_ADDRESS,
                abi: governmentRequestsAbi,
                functionName: 'nextRequestId',
              }) as Promise<bigint>,
              client.readContract({
                address: GOVERNMENT_REQUESTS_ADDRESS,
                abi: governmentRequestsAbi,
                functionName: 'getActiveRequests',
              }) as Promise<bigint[]>,
            ]);

            const total = Number(nextRequestId) - 1; // IDs start at 1
            results.totalGovRequests = Math.max(0, total);
            results.activeGovRequests = activeRequestIds.length;
          } catch (err) {
            console.error('[useGovernanceStats] Gov request fetch error:', err);
          }
        }

        setStats(prev => ({
          ...prev,
          ...results,
        }));
      } catch (err) {
        console.error('[useGovernanceStats] Error:', err);
        setStats(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch stats',
        }));
      }
    };

    fetchStats();
  }, []);

  return stats;
}
