'use client';

import { useState, useCallback } from 'react';
import { useGaslessTransaction } from './useGaslessTransaction';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { type Address } from 'viem';

interface AdminActionsResult {
  // Admin management
  addAdmin: (newAdmin: Address) => Promise<boolean>;
  removeAdmin: (admin: Address) => Promise<boolean>;
  // Seller actions
  suspendSeller: (sellerId: bigint, reason: string) => Promise<boolean>;
  unsuspendSeller: (sellerId: bigint) => Promise<boolean>;
  // Ambassador actions
  suspendAmbassador: (ambassadorId: bigint, reason: string) => Promise<boolean>;
  unsuspendAmbassador: (ambassadorId: bigint) => Promise<boolean>;
  // Order actions
  cancelOrder: (orderId: bigint, reason: string) => Promise<boolean>;
  // State
  isLoading: boolean;
  error: string | null;
  lastTxHash: string | null;
}

/**
 * Hook for admin write actions using gasless transactions
 */
export function useAdminActions(): AdminActionsResult {
  const { executeGasless, isLoading: isGaslessLoading, error: gaslessError } = useGaslessTransaction();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Add a new admin to the marketplace
  const addAdmin = useCallback(
    async (newAdmin: Address): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'addAdmin',
          args: [newAdmin],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Admin added:', newAdmin, 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add admin';
        setError(message);
        console.error('[useAdminActions] addAdmin error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Remove an admin from the marketplace
  const removeAdmin = useCallback(
    async (admin: Address): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'removeAdmin',
          args: [admin],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Admin removed:', admin, 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove admin';
        setError(message);
        console.error('[useAdminActions] removeAdmin error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Suspend a seller
  const suspendSeller = useCallback(
    async (sellerId: bigint, reason: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'suspendSeller',
          args: [sellerId, reason],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Seller suspended:', sellerId.toString(), 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to suspend seller';
        setError(message);
        console.error('[useAdminActions] suspendSeller error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Unsuspend a seller
  const unsuspendSeller = useCallback(
    async (sellerId: bigint): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'unsuspendSeller',
          args: [sellerId],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Seller unsuspended:', sellerId.toString(), 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to unsuspend seller';
        setError(message);
        console.error('[useAdminActions] unsuspendSeller error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Suspend an ambassador
  const suspendAmbassador = useCallback(
    async (ambassadorId: bigint, reason: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'adminSuspendAmbassador',
          args: [ambassadorId, reason],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Ambassador suspended:', ambassadorId.toString(), 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to suspend ambassador';
        setError(message);
        console.error('[useAdminActions] suspendAmbassador error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Unsuspend an ambassador (requires contract with adminUnsuspendAmbassador)
  const unsuspendAmbassador = useCallback(
    async (ambassadorId: bigint): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: AMBASSADOR_REWARDS_ADDRESS,
          abi: ambassadorAbi,
          functionName: 'adminUnsuspendAmbassador',
          args: [ambassadorId],
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Ambassador unsuspended:', ambassadorId.toString(), 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to unsuspend ambassador';
        setError(message);
        console.error('[useAdminActions] unsuspendAmbassador error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  // Cancel an order (refunds buyer, claws back rewards)
  const cancelOrder = useCallback(
    async (orderId: bigint, reason: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);
      setLastTxHash(null);

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'adminCancelOrder',
          args: [orderId, reason],
          gas: 1000000n, // Higher gas limit for complex operation
        });

        if (txHash) {
          setLastTxHash(txHash);
          console.log('[useAdminActions] Order cancelled:', orderId.toString(), 'tx:', txHash);
          return true;
        }
        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel order';
        setError(message);
        console.error('[useAdminActions] cancelOrder error:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [executeGasless]
  );

  return {
    addAdmin,
    removeAdmin,
    suspendSeller,
    unsuspendSeller,
    suspendAmbassador,
    unsuspendAmbassador,
    cancelOrder,
    isLoading: isLoading || isGaslessLoading,
    error: error || gaslessError,
    lastTxHash,
  };
}
