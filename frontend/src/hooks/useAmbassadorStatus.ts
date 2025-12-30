'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { createFreshPublicClient } from '@/lib/viemClient';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi, type Ambassador } from '@/lib/contracts/ambassador';

interface AmbassadorStatus {
  isAmbassador: boolean;
  ambassadorId: bigint | null;
  ambassador: Ambassador | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check if connected wallet is an ambassador and get their details
 */
export function useAmbassadorStatus(): AmbassadorStatus {
  const { address, isConnected } = useAccount();
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [ambassadorId, setAmbassadorId] = useState<bigint | null>(null);
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setIsAmbassador(false);
      setAmbassadorId(null);
      setAmbassador(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Get ambassador ID for this wallet
      const id = await client.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'ambassadorIdByWallet',
        args: [address],
      }) as bigint;

      if (id === 0n) {
        setIsAmbassador(false);
        setAmbassadorId(null);
        setAmbassador(null);
        setIsLoading(false);
        return;
      }

      // Fetch ambassador details
      const ambassadorData = await client.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getAmbassador',
        args: [id],
      }) as any;

      const amb: Ambassador = {
        wallet: ambassadorData.wallet,
        uplineId: ambassadorData.uplineId,
        totalEarned: ambassadorData.totalEarned,
        totalPending: ambassadorData.totalPending,
        recruitedSellers: ambassadorData.recruitedSellers,
        recruitedAmbassadors: ambassadorData.recruitedAmbassadors,
        createdAt: ambassadorData.createdAt,
        active: ambassadorData.active,
        suspended: ambassadorData.suspended,
        regionGeohash: ambassadorData.regionGeohash,
        profileIpfs: ambassadorData.profileIpfs || '',
      };

      setIsAmbassador(true);
      setAmbassadorId(id);
      setAmbassador(amb);
    } catch (err) {
      console.error('[useAmbassadorStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ambassador status');
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isAmbassador,
    ambassadorId,
    ambassador,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}

/**
 * Hook to get ambassador details by ID
 */
export function useAmbassadorById(id: bigint | null) {
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || id === 0n) {
      setAmbassador(null);
      return;
    }

    const fetchAmbassador = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const client = createFreshPublicClient();

        const ambassadorData = await client.readContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'getAmbassador',
          args: [id],
        }) as any;

        // Check if this is a valid ambassador (wallet != 0x0)
        if (ambassadorData.wallet === '0x0000000000000000000000000000000000000000') {
          setAmbassador(null);
          setError('Ambassador not found');
          setIsLoading(false);
          return;
        }

        const amb: Ambassador = {
          wallet: ambassadorData.wallet,
          uplineId: ambassadorData.uplineId,
          totalEarned: ambassadorData.totalEarned,
          totalPending: ambassadorData.totalPending,
          recruitedSellers: ambassadorData.recruitedSellers,
          recruitedAmbassadors: ambassadorData.recruitedAmbassadors,
          createdAt: ambassadorData.createdAt,
          active: ambassadorData.active,
          suspended: ambassadorData.suspended,
          regionGeohash: ambassadorData.regionGeohash,
          profileIpfs: ambassadorData.profileIpfs || '',
        };

        setAmbassador(amb);
      } catch (err) {
        console.error('[useAmbassadorById] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch ambassador');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAmbassador();
  }, [id]);

  return { ambassador, isLoading, error };
}
