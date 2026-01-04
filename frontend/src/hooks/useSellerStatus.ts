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

  // Privy wallet takes priority - that's where sellers receive funds
  // Test wallet is only used for sending transactions (paying gas in dev)
  const address = privyAddress || testWalletAddress;
  const isConnected = (authenticated && walletsReady && !!privyAddress) || (isTestWallet && wagmiConnected && !!testWalletAddress);

  const [isSeller, setIsSeller] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null); // Store as string to avoid BigInt serialization issues
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setIsSeller(false);
      setSellerId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const client = createFreshPublicClient();

      // Check if address is a seller
      const isSellerResult = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'isSeller',
        args: [address],
      }) as boolean;

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

      setIsSeller(true);
      setSellerId(sellerIdResult.toString());
    } catch (err) {
      console.error('[useSellerStatus] Error:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch seller status'));
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, walletsReady]);

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
