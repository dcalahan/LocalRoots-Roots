'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createFreshPublicClient } from '@/lib/viemClient';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi, type Ambassador } from '@/lib/contracts/ambassador';

interface AmbassadorStatus {
  isAmbassador: boolean;
  ambassadorId: string | null;
  ambassador: Ambassador | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check if connected wallet is an ambassador and get their details
 * Uses ONLY Privy wallet for ambassadors - external wallets (wagmi) are not supported
 * for ambassador functionality since ambassadors must use Privy embedded wallets
 */
export function useAmbassadorStatus(): AmbassadorStatus {
  const { user, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  // Get Privy embedded wallet - check multiple sources
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

  // Try multiple ways to get the address
  const privyAddress = (
    embeddedWallet?.address ||
    user?.wallet?.address ||
    // Also check if any wallet in the array has an address
    wallets[0]?.address
  ) as `0x${string}` | undefined;

  // Debug logging
  console.log(`[useAmbassadorStatus] auth=${authenticated} ready=${walletsReady} wallets=${wallets.length} types=${wallets.map(w => w.walletClientType).join(',')} addr=${privyAddress} contract=${AMBASSADOR_REWARDS_ADDRESS}`);

  // Ambassadors MUST use Privy wallet - do NOT fall back to wagmi
  const address = privyAddress;
  const isConnected = authenticated && walletsReady && !!privyAddress;
  const [isAmbassador, setIsAmbassador] = useState(false);
  const [ambassadorId, setAmbassadorId] = useState<string | null>(null); // Store as string to avoid BigInt serialization issues
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null);
  // Start loading if authenticated - we need to check status
  const [isLoading, setIsLoading] = useState(authenticated);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    console.log(`[useAmbassadorStatus] fetchStatus called, address=${address}`);
    if (!address) {
      console.log('[useAmbassadorStatus] No address, setting not ambassador');
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
      console.log(`[useAmbassadorStatus] Calling contract for ${address}`);

      // Get ambassador ID for this wallet
      const id = await client.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'ambassadorIdByWallet',
        args: [address],
      }) as bigint;

      console.log(`[useAmbassadorStatus] Got ambassador ID: ${id}`);

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

      console.log(`[useAmbassadorStatus] Setting isAmbassador=true, id=${id}`);
      setIsAmbassador(true);
      setAmbassadorId(id.toString());
      setAmbassador(amb);
    } catch (err) {
      console.error('[useAmbassadorStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ambassador status');
    } finally {
      setIsLoading(false);
    }
    // Only depend on address - walletsReady causes unnecessary refetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // When authentication status changes, update loading state
  useEffect(() => {
    if (authenticated && !walletsReady) {
      // User is authenticated but wallets not ready yet - we're loading
      setIsLoading(true);
    }
  }, [authenticated, walletsReady]);

  useEffect(() => {
    console.log(`[useAmbassadorStatus] Effect: walletsReady=${walletsReady} address=${address} authenticated=${authenticated}`);
    // Fetch when we have a stable address and wallets are ready
    if (walletsReady && address) {
      console.log('[useAmbassadorStatus] Calling fetchStatus...');
      fetchStatus();
    } else if (walletsReady && !address) {
      // Wallets ready but no Privy address - not connected
      console.log('[useAmbassadorStatus] Wallets ready but no address');
      setIsAmbassador(false);
      setAmbassadorId(null);
      setAmbassador(null);
      setIsLoading(false);
    } else if (!authenticated) {
      // Not authenticated at all
      console.log('[useAmbassadorStatus] Not authenticated');
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, walletsReady, authenticated]);

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
