'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { usePrivyGaslessTransaction } from './usePrivyGaslessTransaction';
import type { Hex } from 'viem';

interface UpdateSellerParams {
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  active: boolean;
  useGasless?: boolean; // Default true - no ETH needed
}

/**
 * Hook to update seller profile
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useUpdateSeller() {
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

  const updateSeller = async (params: UpdateSellerParams) => {
    const useGasless = params.useGasless !== false; // Default to gasless

    console.log('[useUpdateSeller] Updating seller profile:', {
      offersDelivery: params.offersDelivery,
      offersPickup: params.offersPickup,
      deliveryRadiusKm: params.deliveryRadiusKm,
      active: params.active,
      useGasless,
    });
    console.log('[useUpdateSeller] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors/state
    setDirectError(null);
    setGaslessTxHash(null);

    // IMPORTANT: When Privy is authenticated, always use gasless transactions
    // This ensures the Privy wallet (seller's identity) makes the update
    const shouldUseGasless = authenticated && useGasless;

    console.log('[useUpdateSeller] Auth state:', { authenticated, useGasless, shouldUseGasless, isTestWallet });

    // Use gasless transaction when Privy is authenticated (seller's Privy wallet)
    if (shouldUseGasless) {
      console.log('[useUpdateSeller] Using gasless meta-transaction (Privy wallet)');
      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'updateSeller',
          args: [
            params.storefrontIpfs,
            params.offersDelivery,
            params.offersPickup,
            BigInt(params.deliveryRadiusKm),
            params.active,
          ],
          gas: 300000n,
        });
        if (txHash) {
          console.log('[useUpdateSeller] Gasless transaction sent:', txHash);
          setGaslessTxHash(txHash);
        }
      } catch (err) {
        console.error('[useUpdateSeller] Gasless transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    // Use test wallet when Privy is NOT authenticated (dev-only fallback)
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useUpdateSeller] Using test wallet (no Privy auth)');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'updateSeller',
          args: [
            params.storefrontIpfs,
            params.offersDelivery,
            params.offersPickup,
            BigInt(params.deliveryRadiusKm),
            params.active,
          ],
          gas: 300000n,
        });
        console.log('[useUpdateSeller] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useUpdateSeller] Test wallet transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsDirectWriting(false);
      }
      return;
    }

    // Fallback: Use wagmi for direct transactions (requires ETH)
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'updateSeller',
      args: [
        params.storefrontIpfs,
        params.offersDelivery,
        params.offersPickup,
        BigInt(params.deliveryRadiusKm),
        params.active,
      ],
      chainId: baseSepolia.id,
      gas: 300000n,
    });
  };

  return {
    updateSeller,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
