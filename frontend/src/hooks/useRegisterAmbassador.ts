'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import type { Hex } from 'viem';

/**
 * Hook to register as an ambassador under an upline
 */
export function useRegisterAmbassador() {
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

  const registerAmbassador = async (uplineId: bigint, profileIpfs: string) => {
    console.log('[useRegisterAmbassador] Registering with upline:', uplineId.toString());
    console.log('[useRegisterAmbassador] Profile IPFS:', profileIpfs);
    console.log('[useRegisterAmbassador] Connector:', connector?.id, 'Is test wallet:', isTestWallet);

    // Clear any previous errors
    setDirectError(null);

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

    // Use direct viem method for test wallet
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

    // Use wagmi for regular wallets
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
