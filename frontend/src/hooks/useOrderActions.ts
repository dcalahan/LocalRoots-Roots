'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { useGaslessTransaction } from './useGaslessTransaction';

/**
 * Hook for completing an order (buyer confirms receipt)
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useCompleteOrder() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { executeGasless, isLoading: isGaslessLoading, error: gaslessError } = useGaslessTransaction();

  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isTestWallet = connector?.id === 'testWallet';

  const completeOrder = useCallback(async (orderId: bigint, useGasless: boolean = true): Promise<boolean> => {
    if (!address || !publicClient) {
      setError('Wallet not connected');
      return false;
    }

    if (!isTestWallet && !useGasless && !walletClient) {
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
      } else if (useGasless) {
        console.log('[useCompleteOrder] Using gasless meta-transaction');
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [orderId],
          gas: 200000n,
        });
        if (!txHash) {
          setError(gaslessError || 'Gasless transaction failed');
          return false;
        }
        hash = txHash;
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
  }, [walletClient, address, publicClient, isTestWallet, executeGasless, gaslessError]);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    completeOrder,
    isCompleting: isCompleting || isGaslessLoading,
    error,
    isSuccess,
    reset,
  };
}

/**
 * Hook for raising a dispute on an order
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useRaiseDispute() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { executeGasless, isLoading: isGaslessLoading, error: gaslessError } = useGaslessTransaction();

  const [isDisputing, setIsDisputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const isTestWallet = connector?.id === 'testWallet';

  const raiseDispute = useCallback(async (orderId: bigint, useGasless: boolean = true): Promise<boolean> => {
    if (!address || !publicClient) {
      setError('Wallet not connected');
      return false;
    }

    if (!isTestWallet && !useGasless && !walletClient) {
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
      } else if (useGasless) {
        console.log('[useRaiseDispute] Using gasless meta-transaction');
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'raiseDispute',
          args: [orderId],
          gas: 200000n,
        });
        if (!txHash) {
          setError(gaslessError || 'Gasless transaction failed');
          return false;
        }
        hash = txHash;
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
  }, [walletClient, address, publicClient, isTestWallet, executeGasless, gaslessError]);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  return {
    raiseDispute,
    isDisputing: isDisputing || isGaslessLoading,
    error,
    isSuccess,
    reset,
  };
}
