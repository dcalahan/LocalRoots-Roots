'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import type { Hex } from 'viem';

/**
 * Hook to delete a listing (sets active = false)
 * On blockchain, data cannot be truly deleted, so we deactivate it
 * Uses direct viem calls for test wallet, wagmi for regular wallets
 */
export function useDeleteListing() {
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

  const deleteListing = async (listingId: bigint, metadataIpfs: string, pricePerUnit: bigint) => {
    console.log('[useDeleteListing] Deleting listing:', {
      listingId: listingId.toString(),
      metadataIpfs: metadataIpfs.substring(0, 50) + '...',
      pricePerUnit: pricePerUnit.toString()
    });
    console.log('[useDeleteListing] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors
    setDirectError(null);

    // Use direct viem method for test wallet
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useDeleteListing] Using direct test wallet transaction');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'updateListing',
          args: [
            listingId,
            metadataIpfs,
            pricePerUnit,
            0n, // Set quantity to 0
            false, // Set active to false
          ],
          gas: 300000n,
        });
        console.log('[useDeleteListing] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useDeleteListing] Test wallet transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsDirectWriting(false);
      }
      return;
    }

    // Use wagmi for regular wallets
    // To "delete", we set active = false and quantity = 0
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'updateListing',
      args: [
        listingId,
        metadataIpfs,
        pricePerUnit,
        0n, // Set quantity to 0
        false, // Set active to false
      ],
      chainId: baseSepolia.id,
      gas: 300000n,
    });
  };

  return {
    deleteListing,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
