'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { useGaslessTransaction } from './useGaslessTransaction';
import type { Hex } from 'viem';

/**
 * Hook to register as an ambassador under an upline
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useRegisterAmbassador() {
  // Gasless transaction support - ambassadors always use Privy wallet
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = useGaslessTransaction();

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

  const registerAmbassador = async (uplineId: bigint, profileIpfs: string, useGasless: boolean = true) => {
    console.log('[useRegisterAmbassador] Registering with upline:', uplineId.toString());
    console.log('[useRegisterAmbassador] Profile IPFS:', profileIpfs);
    console.log('[useRegisterAmbassador] Using gasless:', useGasless);

    // Clear any previous errors/state
    setGaslessLocalError(null);
    setGaslessTxHash(null);

    // Note: uplineId = 0n is valid for independent registration (no referral required)

    // Validate profile IPFS
    if (!profileIpfs) {
      setGaslessLocalError(new Error('Profile is required'));
      return;
    }

    // Use gasless transaction by default (no ETH needed!)
    // Ambassadors always use their Privy wallet
    if (useGasless) {
      console.log('[useRegisterAmbassador] Using gasless meta-transaction (Privy wallet)');
      try {
        const txHash = await executeGasless({
          to: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'registerAmbassador',
          args: [uplineId, profileIpfs],
          gas: 300000n,
        });
        if (txHash) {
          console.log('[useRegisterAmbassador] Gasless transaction sent:', txHash);
          setGaslessTxHash(txHash);
        }
      } catch (err) {
        console.error('[useRegisterAmbassador] Gasless transaction failed:', err);
        setGaslessLocalError(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    // Fallback: Use wagmi for direct transactions (requires ETH)
    writeContract({
      address: AMBASSADOR_REWARDS_ADDRESS,
      abi: ambassadorAbi,
      functionName: 'registerAmbassador',
      args: [uplineId, profileIpfs],
      chainId: baseSepolia.id,
      gas: 300000n,
    });
  };

  return {
    registerAmbassador,
    isWriting,
    isConfirming,
    isSuccess,
    isPending: isWriting || isConfirming,
    error: writeError || confirmError,
    txHash: hash,
    reset,
  };
}
