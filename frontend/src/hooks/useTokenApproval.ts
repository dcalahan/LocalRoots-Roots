'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { type Address } from 'viem';
import { MARKETPLACE_ADDRESS, ROOTS_TOKEN_ADDRESS, erc20Abi } from '@/lib/contracts/marketplace';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';

export function useTokenApproval() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestWallet = connector?.id === 'testWallet';

  /**
   * Check the current allowance for a token
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const checkAllowance = useCallback(async (tokenAddress?: Address): Promise<bigint> => {
    console.log('[useTokenApproval] checkAllowance called, address:', address, 'token:', tokenAddress);
    if (!publicClient || !address) {
      console.log('[useTokenApproval] No publicClient or address, returning 0');
      return 0n;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    try {
      const allowance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, MARKETPLACE_ADDRESS],
      }) as bigint;
      console.log('[useTokenApproval] Allowance:', allowance.toString());
      return allowance;
    } catch (err) {
      console.error('[useTokenApproval] Error checking allowance:', err);
      return 0n;
    }
  }, [publicClient, address]);

  /**
   * Approve a token for spending by the marketplace
   * @param amount Amount to approve
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const approve = useCallback(async (amount: bigint, tokenAddress?: Address): Promise<boolean> => {
    if (!address) {
      setError('Wallet not connected');
      return false;
    }

    // For non-test wallets, we need the wallet client
    if (!isTestWallet && !walletClient) {
      setError('Wallet not connected');
      return false;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    setIsApproving(true);
    setError(null);

    try {
      // Check current allowance for this specific token
      const currentAllowance = await checkAllowance(token);

      if (currentAllowance >= amount) {
        // Already approved
        return true;
      }

      let hash: `0x${string}`;

      // Use direct viem method for test wallet
      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[useTokenApproval] Using direct test wallet transaction for token:', token);
        hash = await testWalletWriteContract({
          address: token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, amount],
          gas: 100000n,
        });
      } else {
        // Request approval for the exact amount needed
        hash = await walletClient!.writeContract({
          address: token,
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
      console.error('[useTokenApproval] Approval error:', err);
      // Log detailed error
      if (err instanceof Error) {
        console.error('[useTokenApproval] Error details:', {
          name: err.name,
          message: err.message,
          cause: (err as any).cause,
        });
      }
      const errorMessage = err instanceof Error ? err.message : 'Approval failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [walletClient, address, publicClient, checkAllowance, isTestWallet]);

  /**
   * Get the balance of a token
   * @param tokenAddress Optional token address (defaults to ROOTS)
   */
  const getBalance = useCallback(async (tokenAddress?: Address): Promise<bigint> => {
    console.log('[useTokenApproval] getBalance called, address:', address, 'token:', tokenAddress);
    if (!publicClient || !address) {
      console.log('[useTokenApproval] No publicClient or address, returning 0');
      return 0n;
    }

    const token = tokenAddress || ROOTS_TOKEN_ADDRESS;

    try {
      const balance = await publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;
      console.log('[useTokenApproval] Balance:', balance.toString());
      return balance;
    } catch (err) {
      console.error('[useTokenApproval] Error getting balance:', err);
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
