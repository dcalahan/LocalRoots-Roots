'use client';

import { useAccount, useReadContract } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

/**
 * Hook to check if the connected wallet is a registered seller
 */
export function useSellerStatus() {
  const { address, isConnected } = useAccount();

  const { data: isSeller, isLoading: isCheckingStatus, error } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'isSeller',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address,
    },
  });

  const { data: sellerId, isLoading: isLoadingSellerId } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'sellerIdByOwner',
    args: address ? [address] : undefined,
    query: {
      enabled: isConnected && !!address && isSeller === true,
    },
  });

  return {
    isConnected,
    isSeller: isSeller ?? false,
    sellerId: sellerId ?? null,
    isLoading: isCheckingStatus || isLoadingSellerId,
    error,
  };
}
