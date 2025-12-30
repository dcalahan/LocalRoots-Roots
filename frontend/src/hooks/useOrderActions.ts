'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';

/**
 * Hook for completing an order (buyer confirms receipt)
 */
export function useCompleteOrder() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isTestWallet = connector?.id === 'testWallet';

  const completeOrder = useCallback(async (orderId: bigint): Promise<boolean> => {
    if (!address || !publicClient) {
      setError('Wallet not connected');
      return false;
    }

    if (!isTestWallet && !walletClient) {
      setError('Wallet not connected');
      return false;
    }

    setIsCompleting(true);
    setError(null);
    setIsSuccess(false);

    try {
      let hash: `0x${string}`;

      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[useCompleteOrder] Using direct test wallet transaction');
        hash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [orderId],
          gas: 200000n,
        });
      } else {
        hash = await walletClient!.writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [orderId],
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });
      setIsSuccess(true);
      return true;
    } catch (err: unknown) {
      console.error('Complete order error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete order';
      setError(errorMessage);
      return false;
    } finally {
      setIsCompleting(false);
    }
  }, [walletClient, address, publicClient, isTestWallet]);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    completeOrder,
    isCompleting,
    error,
    isSuccess,
    reset,
  };
}

/**
 * Hook for raising a dispute on an order
 */
export function useRaiseDispute() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isDisputing, setIsDisputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isTestWallet = connector?.id === 'testWallet';

  const raiseDispute = useCallback(async (orderId: bigint): Promise<boolean> => {
    if (!address || !publicClient) {
      setError('Wallet not connected');
      return false;
    }

    if (!isTestWallet && !walletClient) {
      setError('Wallet not connected');
      return false;
    }

    setIsDisputing(true);
    setError(null);
    setIsSuccess(false);

    try {
      let hash: `0x${string}`;

      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[useRaiseDispute] Using direct test wallet transaction');
        hash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'raiseDispute',
          args: [orderId],
          gas: 200000n,
        });
      } else {
        hash = await walletClient!.writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'raiseDispute',
          args: [orderId],
        });
      }

      await publicClient.waitForTransactionReceipt({ hash });
      setIsSuccess(true);
      return true;
    } catch (err: unknown) {
      console.error('Raise dispute error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to raise dispute';
      setError(errorMessage);
      return false;
    } finally {
      setIsDisputing(false);
    }
  }, [walletClient, address, publicClient, isTestWallet]);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    raiseDispute,
    isDisputing,
    error,
    isSuccess,
    reset,
  };
}
