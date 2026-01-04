'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createThirdwebClient, defineChain } from 'thirdweb';
import { useSetActiveWallet, useActiveWallet } from 'thirdweb/react';
import { EIP1193 } from 'thirdweb/wallets';

// Only create client if we have a client ID
const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

export const thirdwebClient = clientId
  ? createThirdwebClient({ clientId })
  : null;

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpc: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  blockExplorers: [
    {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  ],
  testnet: true,
});

interface UseThirdwebPrivyResult {
  isReady: boolean;
  isConnected: boolean;
  isBridged: boolean;
  error: string | null;
  bridgeWallet: () => Promise<boolean>;
  privyAddress: string | null;
}

/**
 * Hook to bridge Privy embedded wallet to thirdweb
 * This allows using thirdweb Pay components with Privy authentication
 */
export function useThirdwebPrivy(): UseThirdwebPrivyResult {
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const setActiveWallet = useSetActiveWallet();
  const activeWallet = useActiveWallet();

  const [isBridged, setIsBridged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const privyAddress = user?.wallet?.address || null;
  const isConnected = authenticated && !!privyAddress;

  // Auto-bridge when Privy wallet is available
  const bridgeWallet = useCallback(async (): Promise<boolean> => {
    if (!thirdwebClient) {
      setError('thirdweb client not configured');
      return false;
    }

    if (!wallets || wallets.length === 0) {
      setError('No Privy wallet available');
      return false;
    }

    try {
      setError(null);
      const privyWallet = wallets[0];

      // Get the ethereum provider from Privy
      const provider = await privyWallet.getEthereumProvider();

      // Create thirdweb wallet from EIP1193 provider
      const thirdwebWallet = EIP1193.fromProvider({
        provider: provider as any,
      });

      // Connect the wallet
      await thirdwebWallet.connect({ client: thirdwebClient });

      // Set as active wallet for thirdweb
      setActiveWallet(thirdwebWallet);

      setIsBridged(true);
      console.log('[useThirdwebPrivy] Wallet bridged successfully');
      return true;
    } catch (err) {
      console.error('[useThirdwebPrivy] Bridge error:', err);
      setError(err instanceof Error ? err.message : 'Failed to bridge wallet');
      return false;
    }
  }, [wallets, setActiveWallet]);

  // Auto-bridge when wallet becomes available
  useEffect(() => {
    if (ready && isConnected && wallets.length > 0 && !isBridged && thirdwebClient) {
      bridgeWallet();
    }
  }, [ready, isConnected, wallets, isBridged, bridgeWallet]);

  return {
    isReady: ready && !!thirdwebClient,
    isConnected,
    isBridged: isBridged && !!activeWallet,
    error,
    bridgeWallet,
    privyAddress,
  };
}

export { thirdwebClient as client };
