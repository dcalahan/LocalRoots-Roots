'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { useCallback, useMemo } from 'react';

// Target chain for the app
const TARGET_CHAIN = baseSepolia;

export function useChainValidation() {
  const { chain, isConnected } = useAccount();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();

  const isCorrectChain = useMemo(() => {
    if (!isConnected || !chain) return false;
    return chain.id === TARGET_CHAIN.id;
  }, [isConnected, chain]);

  const chainName = TARGET_CHAIN.name;

  const requestSwitch = useCallback(async (): Promise<boolean> => {
    if (!isConnected) return false;
    if (isCorrectChain) return true;

    try {
      await switchChain({ chainId: TARGET_CHAIN.id });
      return true;
    } catch (err) {
      console.error('[useChainValidation] Failed to switch chain:', err);
      return false;
    }
  }, [isConnected, isCorrectChain, switchChain]);

  return {
    isCorrectChain,
    currentChain: chain,
    targetChain: TARGET_CHAIN,
    chainName,
    requestSwitch,
    isSwitching,
    switchError: switchError?.message || null,
  };
}
