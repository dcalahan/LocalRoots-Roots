'use client';

import { useState, useEffect, useCallback } from 'react';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';

export interface PhaseInfo {
  isPhase1: boolean;
  isPhase2: boolean;
  marketplacePhase: number;
  ambassadorPhase: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Phase enum values from contracts
export const LaunchPhase = {
  Phase1_USDC: 0,
  Phase2_ROOTS: 1,
} as const;

/**
 * Hook to read current phase from both Marketplace and AmbassadorRewards contracts
 *
 * Phase 1 (Phase1_USDC = 0):
 *   - Payment: USDC only
 *   - Rewards: Seeds (on-chain events, no token transfers)
 *   - Ambassador payments: Manual cash (Venmo/PayPal)
 *   - Display: "Seeds"
 *
 * Phase 2 (Phase2_ROOTS = 1):
 *   - Payment: ROOTS tokens (or stablecoins swapped to ROOTS)
 *   - Rewards: Direct ROOTS tokens with 7-day vesting
 *   - Ambassador payments: Automatic ROOTS tokens
 *   - Display: "$ROOTS"
 */
export function usePhase(): PhaseInfo {
  const [marketplacePhase, setMarketplacePhase] = useState<number>(LaunchPhase.Phase1_USDC);
  const [ambassadorPhase, setAmbassadorPhase] = useState<number>(LaunchPhase.Phase1_USDC);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhase = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Fetch phases from both contracts in parallel
      const [mpPhase, ambPhase] = await Promise.all([
        client.readContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'currentPhase',
        }) as Promise<number>,
        client.readContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'currentPhase',
        }) as Promise<number>,
      ]);

      setMarketplacePhase(Number(mpPhase));
      setAmbassadorPhase(Number(ambPhase));
    } catch (err) {
      console.error('[usePhase] Error fetching phase:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch phase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhase();
  }, [fetchPhase]);

  // Both contracts should be in the same phase
  // If they differ, we consider it Phase 1 for safety (more restrictive)
  const effectivePhase = Math.min(marketplacePhase, ambassadorPhase);

  return {
    isPhase1: effectivePhase === LaunchPhase.Phase1_USDC,
    isPhase2: effectivePhase === LaunchPhase.Phase2_ROOTS,
    marketplacePhase,
    ambassadorPhase,
    isLoading,
    error,
    refetch: fetchPhase,
  };
}

/**
 * Get the display label for rewards based on current phase
 */
export function getRewardLabel(isPhase2: boolean): string {
  return isPhase2 ? '$ROOTS' : 'Seeds';
}

/**
 * Format amount based on phase
 * Phase 1: Seeds have 6 decimals (display as whole numbers)
 * Phase 2: ROOTS have 18 decimals (display with 2 decimal places)
 */
export function formatRewardAmount(amount: bigint | string, isPhase2: boolean): string {
  const num = typeof amount === 'string' ? BigInt(amount) : amount;

  if (isPhase2) {
    // ROOTS: 18 decimals, display with 2 decimal places
    const whole = num / BigInt(1e18);
    const remainder = num % BigInt(1e18);
    const decimal = Number(remainder) / 1e18;
    return (Number(whole) + decimal).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    // Seeds: 6 decimals, display as whole number
    const whole = num / BigInt(1e6);
    return whole.toLocaleString();
  }
}
