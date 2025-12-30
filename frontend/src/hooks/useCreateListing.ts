'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { useGaslessTransaction } from './useGaslessTransaction';
import type { Hex } from 'viem';

interface CreateListingParams {
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: number;
  useGasless?: boolean; // Default true - no ETH needed
}

/**
 * Hook to create a new listing
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useCreateListing() {
  const { chain, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  // Gasless transaction support
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = useGaslessTransaction();

  // State for gasless transactions
  const [gaslessTxHash, setGaslessTxHash] = useState<Hex | null>(null);

  // State for test wallet direct transactions
  const [directTxHash, setDirectTxHash] = useState<Hex | null>(null);
  const [directError, setDirectError] = useState<Error | null>(null);
  const [isDirectWriting, setIsDirectWriting] = useState(false);

  // Wagmi hooks for regular wallets (fallback)
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

  const createListing = async (params: CreateListingParams) => {
    const useGasless = params.useGasless !== false; // Default to gasless

    console.log('[useCreateListing] Starting createListing with params:', {
      metadataIpfs: params.metadataIpfs.substring(0, 50) + '...',
      pricePerUnit: params.pricePerUnit.toString(),
      quantityAvailable: params.quantityAvailable,
      useGasless,
    });
    console.log('[useCreateListing] Current chain:', chain?.id, 'Expected:', baseSepolia.id);
    console.log('[useCreateListing] Connector ID:', connector?.id);
    console.log('[useCreateListing] Is test wallet:', isTestWallet);

    // Clear any previous errors/state
    setDirectError(null);
    setGaslessTxHash(null);

    // Ensure we're on Base Sepolia (only for non-test/non-gasless wallets)
    if (!isTestWallet && !useGasless && chain?.id !== baseSepolia.id) {
      console.log('[useCreateListing] Chain mismatch, attempting to switch...');
      try {
        await switchChainAsync({ chainId: baseSepolia.id });
        console.log('[useCreateListing] Chain switch successful');
      } catch (switchError) {
        console.error('[useCreateListing] Failed to switch chain:', switchError);
        throw new Error('Please switch to Base Sepolia network to create a listing.');
      }
    }

    // Use direct viem method for test wallet (test wallets have ETH)
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useCreateListing] Using direct test wallet transaction');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'createListing',
          args: [
            params.metadataIpfs,
            params.pricePerUnit,
            BigInt(params.quantityAvailable),
          ],
          gas: 500000n,
        });
        console.log('[useCreateListing] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useCreateListing] Test wallet transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsDirectWriting(false);
      }
      return;
    }

    // Use gasless transaction by default (no ETH needed!)
    if (useGasless) {
      console.log('[useCreateListing] Using gasless meta-transaction');
      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'createListing',
          args: [
            params.metadataIpfs,
            params.pricePerUnit,
            BigInt(params.quantityAvailable),
          ],
          gas: 500000n,
        });
        if (txHash) {
          console.log('[useCreateListing] Gasless transaction sent:', txHash);
          setGaslessTxHash(txHash);
        }
      } catch (err) {
        console.error('[useCreateListing] Gasless transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    // Fallback: Use wagmi for direct transactions (requires ETH)
    console.log('[useCreateListing] Calling writeContract via wagmi...');
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'createListing',
      args: [
        params.metadataIpfs,
        params.pricePerUnit,
        BigInt(params.quantityAvailable),
      ],
      chainId: baseSepolia.id,
      gas: 500000n,
    });
    console.log('[useCreateListing] writeContract called');
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
