'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

/**
 * Hook to check if the connected wallet is a registered seller
 * Uses Privy wallet for sellers, but in development also checks test wallet (wagmi)
 */
export function useSellerStatus() {
  const { user, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();

  // Get Privy embedded wallet - check both wallets array and user object
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = (embeddedWallet?.address || user?.wallet?.address) as `0x${string}` | undefined;

  // In development, also check for test wallet (wagmi connector)
  const isTestWallet = connector?.id === 'testWallet';
  const testWalletAddress = isTestWallet ? wagmiAddress : undefined;

  // Address resolution priority:
  //   1. Privy embedded wallet (preferred — that's where sellers receive funds)
  //   2. Test wallet (dev-only, for paying gas)
  //   3. Whatever wagmi reports (covers external wallets, AND Privy when
  //      it's surfacing through the wagmi adapter rather than the wallets[]
  //      array — Doug ran into this on mainnet)
  // Without the third fallback, a user connected through the wagmi adapter
  // shows their wallet in the header but useSellerStatus says isSeller=false
  // because `address` is undefined. Bug observed Apr 26 2026.
  const address = privyAddress || testWalletAddress || (wagmiConnected ? wagmiAddress : undefined);
  const isConnected =
    (authenticated && walletsReady && !!privyAddress) ||
    (isTestWallet && wagmiConnected && !!testWalletAddress) ||
    (wagmiConnected && !!wagmiAddress);

  const [isSeller, setIsSeller] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null); // Store as string to avoid BigInt serialization issues
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    console.log('[useSellerStatus] fetchStatus invoked', {
      isConnected,
      address,
      privyAddress,
      testWalletAddress,
      authenticated,
      walletsReady,
      MARKETPLACE_ADDRESS,
    });

    if (!isConnected || !address) {
      console.log('[useSellerStatus] not connected or no address — setting isSeller=false');
      setIsSeller(false);
      setSellerId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();
      console.log('[useSellerStatus] querying isSeller for', address, 'on', MARKETPLACE_ADDRESS);

      // Check if address is a seller
      const isSellerResult = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'isSeller',
        args: [address],
      }) as boolean;

      console.log('[useSellerStatus] isSeller(', address, ') =', isSellerResult);

      if (!isSellerResult) {
        setIsSeller(false);
        setSellerId(null);
        setIsLoading(false);
        return;
      }

      // Get seller ID
      const sellerIdResult = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'sellerIdByOwner',
        args: [address],
      }) as bigint;

      console.log('[useSellerStatus] sellerIdByOwner(', address, ') =', sellerIdResult.toString());

      setIsSeller(true);
      setSellerId(sellerIdResult.toString());
    } catch (err) {
      console.error('[useSellerStatus] Error fetching status:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch seller status'));
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, walletsReady, privyAddress, testWalletAddress, authenticated]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    isConnected,
    isSeller,
    sellerId,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}
