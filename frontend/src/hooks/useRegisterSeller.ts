'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { geohashToBytes8 } from '@/lib/geohash';
import type { Hex } from 'viem';

interface RegisterSellerParams {
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
}

/**
 * Hook to register a new seller
 */
export function useRegisterSeller() {
  const {
    data: hash,
    writeContract,
    isPending: isWriting,
    error: writeError,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const registerSeller = async (params: RegisterSellerParams) => {
    const geohashBytes = geohashToBytes8(params.geohash) as Hex;

    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'registerSeller',
      args: [
        geohashBytes,
        params.storefrontIpfs,
        params.offersDelivery,
        params.offersPickup,
        BigInt(params.deliveryRadiusKm),
      ],
    });
  };

  return {
    registerSeller,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
