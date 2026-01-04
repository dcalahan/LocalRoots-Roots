'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { geohashToBytes8 } from '@/lib/geohash';
import { usePrivyGaslessTransaction } from './usePrivyGaslessTransaction';
import type { Hex } from 'viem';

interface RegisterSellerParams {
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  ambassadorId?: bigint; // Optional ambassador referral ID (0 = no referral)
  useGasless?: boolean; // Default true - no ETH needed
}

/**
 * Hook to register a new seller
 * Supports gasless transactions (default) - no ETH needed!
 * Falls back to direct transactions for test wallet or if gasless disabled
 */
export function useRegisterSeller() {
  const { authenticated } = usePrivy();

  // Gasless transaction support - sellers always use Privy wallet
  // This ensures the Privy wallet address becomes the registered seller
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = usePrivyGaslessTransaction();

  // State for gasless transactions
  const [gaslessTxHash, setGaslessTxHash] = useState<Hex | null>(null);
  const [gaslessLocalError, setGaslessLocalError] = useState<Error | null>(null);

  // Wagmi hooks for external wallets (fallback if gasless fails)
  const {
    data: wagmiHash,
    writeContract,
    isPending: isWagmiWriting,
    error: wagmiWriteError,
    reset: wagmiReset,
  } = useWriteContract();

  // Use whichever hash is available (priority: gasless > wagmi)
  const hash = gaslessTxHash || wagmiHash;

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const isWriting = isGaslessLoading || isWagmiWriting;
  const writeError = gaslessLocalError || wagmiWriteError || (gaslessError ? new Error(gaslessError) : null);

  const reset = () => {
    setGaslessTxHash(null);
    setGaslessLocalError(null);
    wagmiReset();
  };

  const registerSeller = async (params: RegisterSellerParams) => {
    const geohashBytes = geohashToBytes8(params.geohash) as Hex;
    const useGasless = params.useGasless !== false; // Default to gasless
    const ambassadorId = params.ambassadorId ?? 0n; // Default to 0 (no referral)

    console.log('[useRegisterSeller] Registering seller:', {
      geohash: params.geohash,
      geohashBytes,
      offersDelivery: params.offersDelivery,
      offersPickup: params.offersPickup,
      deliveryRadiusKm: params.deliveryRadiusKm,
      ambassadorId: ambassadorId.toString(),
      useGasless,
    });

    // Clear any previous errors/state
    setGaslessLocalError(null);
    setGaslessTxHash(null);

    // Sellers always use gasless transactions via Privy wallet
    // This ensures the Privy wallet address receives seller payments
    if (authenticated && useGasless) {
      console.log('[useRegisterSeller] Using gasless meta-transaction (Privy wallet will be registered)');
      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'registerSeller',
          args: [
            geohashBytes,
            params.storefrontIpfs,
            params.offersDelivery,
            params.offersPickup,
            BigInt(params.deliveryRadiusKm),
            ambassadorId,
          ],
          gas: 500000n,
        });
        if (txHash) {
          console.log('[useRegisterSeller] Gasless transaction sent:', txHash);
          setGaslessTxHash(txHash);
        }
      } catch (err) {
        console.error('[useRegisterSeller] Gasless transaction failed:', err);
        setGaslessLocalError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    // Fallback: Use wagmi for direct transactions (requires ETH)
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
        ambassadorId,
      ],
      chainId: baseSepolia.id,
      gas: 500000n,
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
