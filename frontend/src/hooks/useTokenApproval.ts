'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { MARKETPLACE_ADDRESS, ROOTS_TOKEN_ADDRESS, erc20Abi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';

export function useTokenApproval() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestWallet = connector?.id === 'testWallet';

  const checkAllowance = useCallback(async (): Promise<bigint> => {
    if (!publicClient || !address) return 0n;

    try {
      const allowance = await publicClient.readContract({
        address: ROOTS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, MARKETPLACE_ADDRESS],
      }) as bigint;

      return allowance;
    } catch (err) {
      console.error('Error checking allowance:', err);
      return 0n;
    }
  }, [publicClient, address]);

  const approve = useCallback(async (amount: bigint): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    // For non-test wallets, we need the wallet client
    if (!isTestWallet && !walletClient) {
      setError('Wallet not connected');
      return false;
    }

    setIsApproving(true);
    setError(null);

    try {
      // Check current allowance
      const currentAllowance = await checkAllowance();

      if (currentAllowance >= amount) {
        // Already approved
        return true;
      }

      let hash: `0x${string}`;

      // Use direct viem method for test wallet
      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[useTokenApproval] Using direct test wallet transaction');
        hash = await testWalletWriteContract({
          address: ROOTS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amount],
          gas: 100000n,
        });
      } else {
        // Request approval for the exact amount needed
        hash = await walletClient!.writeContract({
          address: ROOTS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amount],
        });
      }

      // Wait for transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      return true;
    } catch (err: unknown) {
      console.error('Approval error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [walletClient, address, publicClient, checkAllowance, isTestWallet]);

  const getBalance = useCallback(async (): Promise<bigint> => {
    if (!publicClient || !address) return 0n;

    try {
      const balance = await publicClient.readContract({
        address: ROOTS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      return balance;
    } catch (err) {
      console.error('Error getting balance:', err);
      return 0n;
    }
  }, [publicClient, address]);

  return {
    checkAllowance,
    approve,
    getBalance,
    isApproving,
    error,
  };
}
