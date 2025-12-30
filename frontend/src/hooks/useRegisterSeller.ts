'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { geohashToBytes8 } from '@/lib/geohash';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
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
 * Uses direct viem calls for test wallet, wagmi for regular wallets
 */
export function useRegisterSeller() {
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

  const registerSeller = async (params: RegisterSellerParams) => {
    const geohashBytes = geohashToBytes8(params.geohash) as Hex;

    console.log('[useRegisterSeller] Registering seller:', {
      geohash: params.geohash,
      geohashBytes,
      offersDelivery: params.offersDelivery,
      offersPickup: params.offersPickup,
      deliveryRadiusKm: params.deliveryRadiusKm,
    });
    console.log('[useRegisterSeller] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors
    setDirectError(null);

    // Use direct viem method for test wallet
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useRegisterSeller] Using direct test wallet transaction');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
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
          gas: 500000n,
        });
        console.log('[useRegisterSeller] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useRegisterSeller] Test wallet transaction failed:', err);
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
      functionName: 'registerSeller',
      args: [
        geohashBytes,
        params.storefrontIpfs,
        params.offersDelivery,
        params.offersPickup,
        BigInt(params.deliveryRadiusKm),
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
