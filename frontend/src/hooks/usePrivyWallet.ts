'use client';

import { useCallback, useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

/**
 * Hook to ensure Privy embedded wallet is available
 * Will create one if the user is authenticated but doesn't have a wallet
 */
export function usePrivyWallet() {
  const { user, authenticated, createWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Find embedded wallet from wallets list
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = embeddedWallet?.address || user?.wallet?.address;

  const isReady = authenticated && !!privyAddress;
  const needsWallet = authenticated && walletsReady && !privyAddress;

  // Auto-create wallet if needed
  const ensureWallet = useCallback(async () => {
    if (!authenticated) {
      setCreateError('Please sign in first');
      return null;
    }

    if (privyAddress) {
      return privyAddress;
    }

    if (!walletsReady) {
      // Wait a bit for wallets to load
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Check again after waiting
    const currentWallet = wallets.find(w => w.walletClientType === 'privy');
    if (currentWallet?.address) {
      return currentWallet.address;
    }

    // Need to create wallet
    setIsCreating(true);
    setCreateError(null);

    try {
      console.log('[usePrivyWallet] Creating embedded wallet...');
      const newWallet = await createWallet();
      console.log('[usePrivyWallet] Wallet created:', newWallet?.address);
      return newWallet?.address || null;
    } catch (err) {
      console.error('[usePrivyWallet] Failed to create wallet:', err);
      const message = err instanceof Error ? err.message : 'Failed to create wallet';
      setCreateError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [authenticated, privyAddress, walletsReady, wallets, createWallet]);

  return {
    address: privyAddress as `0x${string}` | undefined,
    isReady,
    needsWallet,
    isCreating,
    createError,
    ensureWallet,
    embeddedWallet,
  };
}
