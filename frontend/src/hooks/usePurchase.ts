'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog } from 'viem';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { useTokenApproval } from './useTokenApproval';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { useGaslessTransaction } from './useGaslessTransaction';

interface PurchaseParams {
  listingId: bigint;
  quantity: bigint;
  isDelivery: boolean;
  totalPrice: bigint;
  buyerInfoIpfs: string; // IPFS hash of buyer's delivery info (required for delivery)
  useGasless?: boolean; // Default true - no ETH needed for the purchase tx
}

interface PurchaseResult {
  orderId: bigint;
  txHash: `0x${string}`;
}

export function usePurchase() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { approve, checkAllowance, isApproving } = useTokenApproval();
  const { executeGasless, isLoading: isGaslessLoading, error: gaslessError } = useGaslessTransaction();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestWallet = connector?.id === 'testWallet';

  const purchase = useCallback(async (params: PurchaseParams): Promise<PurchaseResult | null> => {
    const useGasless = params.useGasless !== false; // Default to gasless

    console.log('[usePurchase] Called with params:', {
      listingId: params.listingId.toString(),
      quantity: params.quantity.toString(),
      isDelivery: params.isDelivery,
      buyerInfoIpfs: params.buyerInfoIpfs,
      useGasless,
    });

    if (!address || !publicClient) {
      setError('Wallet not connected');
      return null;
    }

    // For non-test/non-gasless wallets, we need the wallet client
    if (!isTestWallet && !useGasless && !walletClient) {
      setError('Wallet not connected');
      return null;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      // Check and request approval if needed
      // Note: Token approval still requires ETH for now - future improvement would use ERC20Permit
      const currentAllowance = await checkAllowance();

      if (currentAllowance < params.totalPrice) {
        const approved = await approve(params.totalPrice);
        if (!approved) {
          setError('Token approval failed');
          return null;
        }
      }

      let hash: `0x${string}`;

      // Use direct viem method for test wallet
      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[usePurchase] Using direct test wallet transaction');
        hash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: [params.listingId, params.quantity, params.isDelivery, params.buyerInfoIpfs],
          gas: 500000n,
        });
      } else if (useGasless) {
        // Use gasless transaction
        console.log('[usePurchase] Using gasless meta-transaction');
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: [params.listingId, params.quantity, params.isDelivery, params.buyerInfoIpfs],
          gas: 500000n,
        });
        if (!txHash) {
          setError(gaslessError || 'Gasless transaction failed');
          return null;
        }
        hash = txHash;
      } else {
        // Use wallet client for regular wallets
        hash = await walletClient!.writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: [params.listingId, params.quantity, params.isDelivery, params.buyerInfoIpfs],
        });
      }

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse OrderPlaced event to get orderId
      let orderId = 0n;
      console.log('[usePurchase] Parsing receipt logs, count:', receipt.logs.length);
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: marketplaceAbi,
            data: log.data,
            topics: log.topics,
          });
          console.log('[usePurchase] Decoded event:', decoded.eventName);
          if (decoded.eventName === 'OrderPlaced') {
            orderId = (decoded.args as { orderId: bigint }).orderId;
            console.log('[usePurchase] Found OrderPlaced, orderId:', orderId.toString());
            break;
          }
        } catch {
          // Skip logs that don't match OrderPlaced
        }
      }

      return {
        orderId,
        txHash: hash,
      };
    } catch (err: unknown) {
      console.error('Purchase error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsPurchasing(false);
    }
  }, [walletClient, address, publicClient, approve, checkAllowance, isTestWallet, executeGasless, gaslessError]);

  return {
    purchase,
    isPurchasing: isPurchasing || isApproving || isGaslessLoading,
    error,
  };
}

interface CheckoutResult {
  allSucceeded: boolean;
  successCount: number;
  failedCount: number;
  failedListingIds: bigint[];
}

export function useCheckout() {
  const { purchase, isPurchasing, error } = usePurchase();
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<{ success: PurchaseResult[]; failed: PurchaseParams[] }>({
    success: [],
    failed: [],
  });

  const checkout = useCallback(async (items: PurchaseParams[]): Promise<CheckoutResult> => {
    setProgress({ current: 0, total: items.length });
    setResults({ success: [], failed: [] });

    const successResults: PurchaseResult[] = [];
    const failedItems: PurchaseParams[] = [];

    for (let i = 0; i < items.length; i++) {
      setProgress({ current: i + 1, total: items.length });

      const result = await purchase(items[i]);

      if (result) {
        successResults.push(result);
      } else {
        failedItems.push(items[i]);
      }
    }

    setResults({ success: successResults, failed: failedItems });

    return {
      allSucceeded: failedItems.length === 0,
      successCount: successResults.length,
      failedCount: failedItems.length,
      failedListingIds: failedItems.map(item => item.listingId),
    };
  }, [purchase]);

  return {
    checkout,
    isPurchasing,
    error,
    progress,
    results,
  };
}
