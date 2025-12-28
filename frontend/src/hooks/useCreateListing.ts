'use client';

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

interface CreateListingParams {
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: number;
}

/**
 * Hook to create a new listing
 */
export function useCreateListing() {
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

  const createListing = async (params: CreateListingParams) => {
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'createListing',
      args: [
        params.metadataIpfs,
        params.pricePerUnit,
        BigInt(params.quantityAvailable),
      ],
    });
  };

  return {
    createListing,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
