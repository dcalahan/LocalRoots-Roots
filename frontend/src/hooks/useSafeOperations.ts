'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import {
  OPERATIONS_SAFE_ADDRESS,
  getSafeInfo,
  getPendingTransactions,
  isSafeSigner,
  getSafeAppUrl,
  getSafeTransactionUrl,
} from '@/lib/safe';
import type { SafeInfo, PendingTransaction } from '@/lib/safe';

interface UseSafeOperationsReturn {
  // State
  safeInfo: SafeInfo | null;
  pendingTransactions: PendingTransaction[];
  isLoading: boolean;
  error: string | null;
  isSigner: boolean;

  // Actions
  refresh: () => Promise<void>;

  // URLs
  safeAppUrl: string | null;
  getTransactionUrl: (safeTxHash: string) => string | null;
}

export function useSafeOperations(): UseSafeOperationsReturn {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigner, setIsSigner] = useState(false);

  const safeAddress = OPERATIONS_SAFE_ADDRESS;

  // Fetch Safe info and pending transactions
  const refresh = useCallback(async () => {
    if (!safeAddress) {
      setError('Operations Safe address not configured');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch Safe info
      const info = await getSafeInfo(safeAddress);
      setSafeInfo(info);

      // Fetch pending transactions
      const pending = await getPendingTransactions(safeAddress);
      setPendingTransactions(pending);

      // Check if current user is a signer
      if (address) {
        const signerStatus = await isSafeSigner(safeAddress, address);
        setIsSigner(signerStatus);
      } else {
        setIsSigner(false);
      }
    } catch (err) {
      console.error('[useSafeOperations] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Safe data');
    } finally {
      setIsLoading(false);
    }
  }, [safeAddress, address]);

  // Initial load and refresh on address change
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Get Safe app URL
  const safeAppUrl = safeAddress ? getSafeAppUrl(safeAddress) : null;

  // Get transaction URL
  const getTransactionUrl = useCallback(
    (safeTxHash: string) => {
      if (!safeAddress) return null;
      return getSafeTransactionUrl(safeAddress, safeTxHash);
    },
    [safeAddress]
  );

  return {
    safeInfo,
    pendingTransactions,
    isLoading,
    error,
    isSigner,
    refresh,
    safeAppUrl,
    getTransactionUrl,
  };
}
