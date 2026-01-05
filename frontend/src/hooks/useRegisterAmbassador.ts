'use client';

import { useState, useMemo } from 'react';
import { useWaitForTransactionReceipt } from 'wagmi';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { useGaslessTransaction } from './useGaslessTransaction';
import type { Hex } from 'viem';

/**
 * Hook to register as an ambassador
 * Uses gasless meta-transactions via Privy embedded wallet
 */
export function useRegisterAmbassador() {
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = useGaslessTransaction();

  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash: txHash || undefined,
  });

  const registerAmbassador = async (uplineId: bigint, profileIpfs: string) => {
    console.log('[useRegisterAmbassador] Registering with upline:', uplineId.toString());
    console.log('[useRegisterAmbassador] Profile IPFS:', profileIpfs);

    setLocalError(null);
    setTxHash(null);

    if (!profileIpfs) {
      setLocalError('Profile is required');
      return;
    }

    try {
      const hash = await executeGasless({
        to: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'registerAmbassador',
        args: [uplineId, profileIpfs],
        gas: 300000n,
      });

      if (hash) {
        console.log('[useRegisterAmbassador] Transaction sent:', hash);
        setTxHash(hash);
      }
    } catch (err) {
      console.error('[useRegisterAmbassador] Failed:', err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  // Combine errors - memoize to avoid creating new Error objects on every render
  const errorMessage = localError || gaslessError || (confirmError?.message ?? null);
  const error = useMemo(
    () => errorMessage ? new Error(errorMessage) : null,
    [errorMessage]
  );

  return {
    registerAmbassador,
    isPending: isGaslessLoading || isConfirming,
    isSuccess,
    error,
    txHash,
    reset: () => {
      setTxHash(null);
      setLocalError(null);
    },
  };
}
