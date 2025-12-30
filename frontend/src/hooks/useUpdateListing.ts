'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import type { Hex } from 'viem';

interface UpdateListingParams {
  listingId: bigint;
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: number;
  active: boolean;
}

/**
 * Hook to update an existing listing
 * Uses direct viem calls for test wallet, wagmi for regular wallets
 */
export function useUpdateListing() {
  const { connector } = useAccount();

  // State for test wallet direct transactions
  const [directTxHash, setDirectTxHash] = useState<Hex | null>(null);
  const [directError, setDirectError] = useState<Error | null>(null);
  const [isDirectWriting, setIsDirectWriting] = useState(false);

  // Wagmi hooks for regular wallets
  const {
    data: wagmiHash,
    writeContract,
    isPending: isWagmiWriting,
    error: wagmiWriteError,
    reset: wagmiReset,
  } = useWriteContract();

  // Use whichever hash is available
  const hash = directTxHash || wagmiHash;

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const isTestWallet = connector?.id === 'testWallet';
  const isWriting = isDirectWriting || isWagmiWriting;
  const writeError = directError || wagmiWriteError;

  const reset = () => {
    setDirectTxHash(null);
    setDirectError(null);
    setIsDirectWriting(false);
    wagmiReset();
  };

  const updateListing = async (params: UpdateListingParams) => {
    console.log('[useUpdateListing] Updating listing:', {
      listingId: params.listingId.toString(),
      pricePerUnit: params.pricePerUnit.toString(),
      quantityAvailable: params.quantityAvailable,
      active: params.active,
    });
    console.log('[useUpdateListing] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors
    setDirectError(null);

    // Use direct viem method for test wallet
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useUpdateListing] Using direct test wallet transaction');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'updateListing',
          args: [
            params.listingId,
            params.metadataIpfs,
            params.pricePerUnit,
            BigInt(params.quantityAvailable),
            params.active,
          ],
          gas: 300000n,
        });
        console.log('[useUpdateListing] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useUpdateListing] Test wallet transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsDirectWriting(false);
      }
      return;
    }

    // Use wagmi for regular wallets
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'updateListing',
      args: [
        params.listingId,
        params.metadataIpfs,
        params.pricePerUnit,
        BigInt(params.quantityAvailable),
        params.active,
      ],
      chainId: baseSepolia.id,
      gas: 300000n,
    });
  };

  return {
    updateListing,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
