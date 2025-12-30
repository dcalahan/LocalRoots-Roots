'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter, usePathname } from 'next/navigation';

const WALLET_CONNECT_RETURN_PATH = 'localroots_wallet_return_path';

/**
 * Hook to handle redirecting users back to their original page after
 * connecting a wallet from a mobile app (which can cause a page reload/redirect).
 */
export function useWalletRedirect() {
  const { isConnected } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isConnected && typeof window !== 'undefined') {
      const returnPath = sessionStorage.getItem(WALLET_CONNECT_RETURN_PATH);
      if (returnPath && returnPath !== pathname) {
        sessionStorage.removeItem(WALLET_CONNECT_RETURN_PATH);
        // Small delay to ensure wagmi state is fully initialized
        setTimeout(() => {
          router.push(returnPath);
        }, 100);
      }
    }
  }, [isConnected, pathname, router]);
}
