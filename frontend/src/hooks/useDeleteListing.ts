'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { usePrivyGaslessTransaction } from './usePrivyGaslessTransaction';
import type { Hex } from 'viem';

interface DeleteListingParams {
  listingId: bigint;
  metadataIpfs: string;
  pricePerUnit: bigint;
  useGasless?: boolean; // Default true - no ETH needed
}

/**
 * Hook to delete a listing (sets active = false)
 * On blockchain, data cannot be truly deleted, so we deactivate it
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useDeleteListing() {
  const { connector } = useAccount();
  const { authenticated } = usePrivy();

  // Gasless transaction support - use Privy wallet for sellers
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = usePrivyGaslessTransaction();

  // State for gasless transactions
  const [gaslessTxHash, setGaslessTxHash] = useState<Hex | null>(null);

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

  // Use whichever hash is available (priority: gasless > direct > wagmi)
  const hash = gaslessTxHash || directTxHash || wagmiHash;

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const isTestWallet = connector?.id === 'testWallet';
  const isWriting = isGaslessLoading || isDirectWriting || isWagmiWriting;
  const writeError = directError || wagmiWriteError || (gaslessError ? new Error(gaslessError) : null);

  const reset = () => {
    setGaslessTxHash(null);
    setDirectTxHash(null);
    setDirectError(null);
    setIsDirectWriting(false);
    wagmiReset();
  };

  const deleteListing = async (params: DeleteListingParams) => {
    const useGasless = params.useGasless !== false; // Default to gasless

    console.log('[useDeleteListing] Deleting listing:', {
      listingId: params.listingId.toString(),
      metadataIpfs: params.metadataIpfs.substring(0, 50) + '...',
      pricePerUnit: params.pricePerUnit.toString(),
      useGasless,
    });
    console.log('[useDeleteListing] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors/state
    setDirectError(null);
    setGaslessTxHash(null);

    // IMPORTANT: When Privy is authenticated, always use gasless transactions
    // This ensures the Privy wallet (seller's identity) makes the deletion
    const shouldUseGasless = authenticated && useGasless;

    console.log('[useDeleteListing] Auth state:', { authenticated, useGasless, shouldUseGasless, isTestWallet });

    // Use gasless transaction when Privy is authenticated (seller's Privy wallet)
    if (shouldUseGasless) {
      console.log('[useDeleteListing] Using gasless meta-transaction (Privy wallet)');
      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'updateListing',
          args: [
            params.listingId,
            params.metadataIpfs,
            params.pricePerUnit,
            0n, // Set quantity to 0
            false, // Set active to false
          ],
          gas: 300000n,
        });
        if (txHash) {
          console.log('[useDeleteListing] Gasless transaction sent:', txHash);
          setGaslessTxHash(txHash);
        }
      } catch (err) {
        console.error('[useDeleteListing] Gasless transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    // Use test wallet when Privy is NOT authenticated (dev-only fallback)
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useDeleteListing] Using test wallet (no Privy auth)');
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

    // Fallback: Use wagmi for direct transactions (requires ETH)
    // To "delete", we set active = false and quantity = 0
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'updateListing',
      args: [
        params.listingId,
        params.metadataIpfs,
        params.pricePerUnit,
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
