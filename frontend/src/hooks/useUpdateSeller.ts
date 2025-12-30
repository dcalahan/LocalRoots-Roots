'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import type { Hex } from 'viem';

interface UpdateSellerParams {
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  active: boolean;
}

/**
 * Hook to update seller profile
 * Uses direct viem calls for test wallet, wagmi for regular wallets
 */
export function useUpdateSeller() {
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

  const updateSeller = async (params: UpdateSellerParams) => {
    console.log('[useUpdateSeller] Updating seller profile:', {
      offersDelivery: params.offersDelivery,
      offersPickup: params.offersPickup,
      deliveryRadiusKm: params.deliveryRadiusKm,
      active: params.active,
    });
    console.log('[useUpdateSeller] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors
    setDirectError(null);

    // Use direct viem method for test wallet
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useUpdateSeller] Using direct test wallet transaction');
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

    // Use wagmi for regular wallets
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
