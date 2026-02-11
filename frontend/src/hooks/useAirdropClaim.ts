'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { createFreshPublicClient } from '@/lib/viemClient';
import {
  SEEDS_AIRDROP_ADDRESS,
  seedsAirdropAbi,
  type AirdropClaimInfo,
  type AirdropStatus,
} from '@/lib/contracts/seedsAirdrop';

// URL where proofs.json is hosted (set via env var after generating Merkle tree)
const PROOFS_URL = process.env.NEXT_PUBLIC_AIRDROP_PROOFS_URL || '/api/airdrop/proofs';

interface AirdropClaim {
  // Eligibility info
  isEligible: boolean;
  claimInfo: AirdropClaimInfo | null;
  hasClaimed: boolean;

  // Airdrop status
  airdropStatus: AirdropStatus | null;
  isAirdropActive: boolean;

  // Loading states
  isCheckingEligibility: boolean;
  isClaiming: boolean;

  // Transaction state
  claimTxHash: `0x${string}` | undefined;
  claimError: string | null;
  claimSuccess: boolean;

  // Actions
  checkEligibility: () => Promise<void>;
  claim: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for checking airdrop eligibility and claiming ROOTS tokens
 *
 * Flow:
 * 1. Connect wallet
 * 2. Call checkEligibility() to fetch proof from proofs.json
 * 3. If eligible, display Seeds → ROOTS conversion
 * 4. Call claim() to execute on-chain claim
 */
export function useAirdropClaim(): AirdropClaim {
  const { address, isConnected } = useAccount();

  // State
  const [isEligible, setIsEligible] = useState(false);
  const [claimInfo, setClaimInfo] = useState<AirdropClaimInfo | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [airdropStatus, setAirdropStatus] = useState<AirdropStatus | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Contract write
  const {
    data: claimTxHash,
    writeContract: writeClaim,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction
  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  // Fetch airdrop status from contract
  const fetchAirdropStatus = useCallback(async () => {
    if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const client = createFreshPublicClient();

      const [merkleRoot, claimDeadline, timeUntilDeadline, claimPeriodEnded, availableBalance] =
        await Promise.all([
          client.readContract({
            address: SEEDS_AIRDROP_ADDRESS,
            abi: seedsAirdropAbi,
            functionName: 'merkleRoot',
          }),
          client.readContract({
            address: SEEDS_AIRDROP_ADDRESS,
            abi: seedsAirdropAbi,
            functionName: 'claimDeadline',
          }),
          client.readContract({
            address: SEEDS_AIRDROP_ADDRESS,
            abi: seedsAirdropAbi,
            functionName: 'timeUntilDeadline',
          }),
          client.readContract({
            address: SEEDS_AIRDROP_ADDRESS,
            abi: seedsAirdropAbi,
            functionName: 'claimPeriodEnded',
          }),
          client.readContract({
            address: SEEDS_AIRDROP_ADDRESS,
            abi: seedsAirdropAbi,
            functionName: 'availableBalance',
          }),
        ]);

      return {
        merkleRoot: merkleRoot as `0x${string}`,
        claimDeadline: claimDeadline as bigint,
        timeUntilDeadline: timeUntilDeadline as bigint,
        claimPeriodEnded: claimPeriodEnded as boolean,
        availableBalance: availableBalance as bigint,
      };
    } catch (err) {
      console.error('[useAirdropClaim] Failed to fetch airdrop status:', err);
      return null;
    }
  }, []);

  // Check if user has already claimed
  const checkHasClaimed = useCallback(async (userAddress: string) => {
    if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
      return false;
    }

    try {
      const client = createFreshPublicClient();
      const claimed = await client.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'hasClaimed',
        args: [userAddress as `0x${string}`],
      });
      return claimed as boolean;
    } catch (err) {
      console.error('[useAirdropClaim] Failed to check hasClaimed:', err);
      return false;
    }
  }, []);

  // Fetch proof from proofs.json
  const fetchProof = useCallback(async (userAddress: string): Promise<AirdropClaimInfo | null> => {
    try {
      // Fetch proofs.json (contains all eligible addresses with their proofs)
      const response = await fetch(PROOFS_URL);
      if (!response.ok) {
        console.log('[useAirdropClaim] Proofs not available yet');
        return null;
      }

      const proofs: Record<string, AirdropClaimInfo> = await response.json();

      // Look up user's claim info (addresses are lowercase keys)
      const claimInfo = proofs[userAddress.toLowerCase()];
      return claimInfo || null;
    } catch (err) {
      console.error('[useAirdropClaim] Failed to fetch proofs:', err);
      return null;
    }
  }, []);

  // Check eligibility (combines proof lookup + contract verification)
  const checkEligibility = useCallback(async () => {
    if (!address || !isConnected) {
      setIsEligible(false);
      setClaimInfo(null);
      return;
    }

    setIsCheckingEligibility(true);
    setClaimError(null);

    try {
      // 1. Fetch airdrop status
      const status = await fetchAirdropStatus();
      setAirdropStatus(status);

      if (!status || status.claimPeriodEnded) {
        setIsEligible(false);
        setClaimInfo(null);
        setIsCheckingEligibility(false);
        return;
      }

      // 2. Check if already claimed
      const claimed = await checkHasClaimed(address);
      setHasClaimed(claimed);

      if (claimed) {
        setIsEligible(false);
        setClaimInfo(null);
        setIsCheckingEligibility(false);
        return;
      }

      // 3. Fetch proof from proofs.json
      const info = await fetchProof(address);
      if (!info) {
        setIsEligible(false);
        setClaimInfo(null);
        setIsCheckingEligibility(false);
        return;
      }

      // 4. Verify on-chain that the proof is valid
      const client = createFreshPublicClient();
      const canClaim = await client.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [address, BigInt(info.rootsAmount), info.proof],
      });

      if (canClaim) {
        setIsEligible(true);
        setClaimInfo(info);
      } else {
        setIsEligible(false);
        setClaimInfo(null);
      }
    } catch (err) {
      console.error('[useAirdropClaim] Error checking eligibility:', err);
      setClaimError(err instanceof Error ? err.message : 'Failed to check eligibility');
      setIsEligible(false);
      setClaimInfo(null);
    } finally {
      setIsCheckingEligibility(false);
    }
  }, [address, isConnected, fetchAirdropStatus, checkHasClaimed, fetchProof]);

  // Execute claim
  const claim = useCallback(async () => {
    if (!isEligible || !claimInfo || !address) {
      setClaimError('Not eligible to claim');
      return;
    }

    setClaimError(null);
    setClaimSuccess(false);

    try {
      writeClaim({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'claim',
        args: [BigInt(claimInfo.rootsAmount), claimInfo.proof],
      });
    } catch (err) {
      console.error('[useAirdropClaim] Claim error:', err);
      setClaimError(err instanceof Error ? err.message : 'Failed to claim');
    }
  }, [isEligible, claimInfo, address, writeClaim]);

  // Watch for write errors
  useEffect(() => {
    if (writeError) {
      setClaimError(writeError.message);
    }
  }, [writeError]);

  // Watch for confirmation
  useEffect(() => {
    if (isConfirmed) {
      setClaimSuccess(true);
      setHasClaimed(true);
      setIsEligible(false);
    }
  }, [isConfirmed]);

  // Check eligibility on mount/address change
  useEffect(() => {
    if (address && isConnected) {
      checkEligibility();
    }
  }, [address, isConnected, checkEligibility]);

  const isAirdropActive =
    airdropStatus !== null &&
    !airdropStatus.claimPeriodEnded &&
    airdropStatus.merkleRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  return {
    isEligible,
    claimInfo,
    hasClaimed,
    airdropStatus,
    isAirdropActive,
    isCheckingEligibility,
    isClaiming: isWritePending || isConfirming,
    claimTxHash,
    claimError,
    claimSuccess,
    checkEligibility,
    claim,
    refetch: checkEligibility,
  };
}

/**
 * Format Seeds to display string (6 decimals → whole number)
 */
export function formatSeedsForDisplay(seeds: string | bigint): string {
  const num = typeof seeds === 'string' ? BigInt(seeds) : seeds;
  return (num / BigInt(1e6)).toLocaleString();
}

/**
 * Format ROOTS to display string (18 decimals → 2 decimal places)
 */
export function formatRootsForDisplay(roots: string | bigint): string {
  const num = typeof roots === 'string' ? BigInt(roots) : roots;
  const whole = num / BigInt(1e18);
  const remainder = num % BigInt(1e18);
  const decimal = Number(remainder) / 1e18;
  return (Number(whole) + decimal).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
