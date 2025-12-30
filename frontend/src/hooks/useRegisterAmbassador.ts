'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { useGaslessTransaction } from './useGaslessTransaction';
import type { Hex } from 'viem';

/**
 * Hook to register as an ambassador under an upline
 * Supports gasless transactions (default) - no ETH needed!
 */
export function useRegisterAmbassador() {
  const { connector } = useAccount();

  // Gasless transaction support
  const {
    executeGasless,
    isLoading: isGaslessLoading,
    error: gaslessError,
  } = useGaslessTransaction();

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

  const registerAmbassador = async (uplineId: bigint, profileIpfs: string, useGasless: boolean = true) => {
    console.log('[useRegisterAmbassador] Registering with upline:', uplineId.toString());
    console.log('[useRegisterAmbassador] Profile IPFS:', profileIpfs);
    console.log('[useRegisterAmbassador] Connector:', connector?.id, 'Is test wallet:', isTestWallet);
    console.log('[useRegisterAmbassador] Using gasless:', useGasless);

    // Clear any previous errors/state
    setDirectError(null);
    setGaslessTxHash(null);

    // Validate upline ID
    if (uplineId === 0n) {
      setDirectError(new Error('Invalid referral - please use a valid ambassador referral link'));
      return;
    }

    // Validate profile IPFS
    if (!profileIpfs) {
      setDirectError(new Error('Profile is required'));
      return;
    }

    // Use direct viem method for test wallet (test wallets have ETH)
    if (isTestWallet && isTestWalletAvailable()) {
      console.log('[useRegisterAmbassador] Using direct test wallet transaction');
      setIsDirectWriting(true);
      try {
        const txHash = await testWalletWriteContract({
          address: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'registerAmbassador',
          args: [uplineId, profileIpfs],
          gas: 300000n,
        });
        console.log('[useRegisterAmbassador] Test wallet transaction sent:', txHash);
        setDirectTxHash(txHash);
      } catch (err) {
        console.error('[useRegisterAmbassador] Test wallet transaction failed:', err);
        setDirectError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsDirectWriting(false);
      }
      return;
    }

    // Use gasless transaction by default (no ETH needed!)
    if (useGasless) {
      console.log('[useRegisterAmbassador] Using gasless meta-transaction');
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
        setDirectError(err instanceof Error ? err : new Error(String(err)));
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
