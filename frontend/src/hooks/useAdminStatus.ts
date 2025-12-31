'use client';

import { useAccount, useReadContract } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

/**
 * Hook to check if the connected wallet is an admin
 */
export function useAdminStatus() {
  const { address, isConnected } = useAccount();

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
    isLoading: isLoading || isLoadingAdmins,
    error,
    refetch,
  };
}
