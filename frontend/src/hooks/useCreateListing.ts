'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useSwitchChain, useConnectorClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { createPublicClient, http, type Hex } from 'viem';

interface CreateListingParams {
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: number;
}

/**
 * Hook to create a new listing
 * Uses direct viem calls for test wallet, wagmi for regular wallets
 */
export function useCreateListing() {
  const { chain, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();

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

  const createListing = async (params: CreateListingParams) => {
    console.log('[useCreateListing] Starting createListing with params:', {
      metadataIpfs: params.metadataIpfs.substring(0, 50) + '...',
      pricePerUnit: params.pricePerUnit.toString(),
      quantityAvailable: params.quantityAvailable,
    });
    console.log('[useCreateListing] Current chain:', chain?.id, 'Expected:', baseSepolia.id);
    console.log('[useCreateListing] Connector ID:', connector?.id);
    console.log('[useCreateListing] Is test wallet:', isTestWallet);
    console.log('[useCreateListing] Test wallet available:', isTestWalletAvailable());
    console.log('[useCreateListing] Will use direct method:', isTestWallet && isTestWalletAvailable());

    // Clear any previous errors
    setDirectError(null);

    // Ensure we're on Base Sepolia (only for non-test wallets)
    if (!isTestWallet && chain?.id !== baseSepolia.id) {
      console.log('[useCreateListing] Chain mismatch, attempting to switch...');
      try {
        await switchChainAsync({ chainId: baseSepolia.id });
        console.log('[useCreateListing] Chain switch successful');
      } catch (switchError) {
        console.error('[useCreateListing] Failed to switch chain:', switchError);
        throw new Error('Please switch to Base Sepolia network to create a listing.');
      }
    }

    // Use direct viem method for test wallet
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

    // Use wagmi for regular wallets
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
