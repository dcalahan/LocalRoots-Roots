'use client';

import { useAccount, useReadContract } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

/**
 * Hook to check if the connected wallet is an admin
 * Supports both wagmi (external wallets) and Privy (embedded wallets)
 */
export function useAdminStatus() {
  // Check wagmi (external wallets)
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  // Check Privy (embedded wallets)
  const { user, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  // Find Privy embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = embeddedWallet?.address || user?.wallet?.address;

  // Use wagmi address first, fall back to Privy address
  const address = wagmiAddress || (privyAddress as `0x${string}` | undefined);
  const isConnected = wagmiConnected || (authenticated && !!privyAddress);

  const { data: isAdmin, isLoading, error, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'isAdmin',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const { data: adminList, isLoading: isLoadingAdmins } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'getAdmins',
    query: {
      enabled: isConnected,
    },
  });

  return {
    isConnected,
    isAdmin: isAdmin ?? false,
    adminList: (adminList as string[]) ?? [],
    isLoading: isLoading || isLoadingAdmins || !walletsReady,
    error,
    refetch,
    address, // Expose the address being checked
  };
}
