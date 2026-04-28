'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog, type Address, zeroAddress } from 'viem';
import { ACTIVE_CHAIN_ID } from '@/lib/chainConfig';
import {
  MARKETPLACE_ADDRESS,
  marketplaceAbi,
  ROOTS_TOKEN_ADDRESS,
  type PaymentToken,
  getPaymentTokenAddress,
  PAYMENT_TOKENS,
  rootsToStablecoin,
} from '@/lib/contracts/marketplace';
import { useTokenApproval } from './useTokenApproval';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { useGaslessTransaction } from './useGaslessTransaction';

interface PurchaseParams {
  listingId: bigint;
  quantity: bigint;
  isDelivery: boolean;
  totalPrice: bigint; // Price in ROOTS (18 decimals)
  buyerInfoIpfs: string; // IPFS hash of buyer's delivery info (required for delivery)
  paymentToken?: PaymentToken; // Default: 'ROOTS' - can also be 'USDC' or 'USDT'
  useGasless?: boolean; // Default true - no ETH needed for the purchase tx
}

interface PurchaseResult {
  orderId: bigint;
  txHash: `0x${string}`;
}

export function usePurchase() {
  const { address, connector } = useAccount();
  const publicClient = usePublicClient({ chainId: ACTIVE_CHAIN_ID });
  const { data: walletClient } = useWalletClient();
  const { approve, checkAllowance, isApproving } = useTokenApproval();
  const { executeGasless, isLoading: isGaslessLoading, error: gaslessError } = useGaslessTransaction();

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestWallet = connector?.id === 'testWallet';

  const purchase = useCallback(async (params: PurchaseParams): Promise<PurchaseResult | null> => {
    const useGasless = params.useGasless !== false; // Default to gasless
    const paymentToken = params.paymentToken || 'ROOTS';
    const paymentTokenAddress = getPaymentTokenAddress(paymentToken);

    // Calculate the amount to approve based on payment token
    // For ROOTS: approve the full price in ROOTS (18 decimals)
    // For stablecoins: approve the equivalent USD amount (6 decimals)
    const approvalAmount = paymentToken === 'ROOTS'
      ? params.totalPrice
      : rootsToStablecoin(params.totalPrice);

    // Get the token address for approval (ROOTS address for ROOTS, stablecoin address otherwise)
    const tokenToApprove = paymentToken === 'ROOTS'
      ? ROOTS_TOKEN_ADDRESS
      : PAYMENT_TOKENS[paymentToken].address;

    console.log('[usePurchase] Called with params:', {
      listingId: params.listingId.toString(),
      quantity: params.quantity.toString(),
      isDelivery: params.isDelivery,
      buyerInfoIpfs: params.buyerInfoIpfs,
      paymentToken,
      paymentTokenAddress,
      approvalAmount: approvalAmount.toString(),
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
      // Check and request approval if needed for the correct token
      // Note: Token approval still requires ETH for now - future improvement would use ERC20Permit
      const currentAllowance = await checkAllowance(tokenToApprove);

      if (currentAllowance < approvalAmount) {
        const approved = await approve(approvalAmount, tokenToApprove);
        if (!approved) {
          setError('Token approval failed');
          return null;
        }
      }

      let hash: `0x${string}`;

      // Purchase arguments now include payment token address
      const purchaseArgs: [bigint, bigint, boolean, string, Address] = [
        params.listingId,
        params.quantity,
        params.isDelivery,
        params.buyerInfoIpfs,
        paymentTokenAddress,
      ];

      console.log('[usePurchase] Purchase args:', {
        listingId: params.listingId.toString(),
        quantity: params.quantity.toString(),
        isDelivery: params.isDelivery,
        buyerInfoIpfs: params.buyerInfoIpfs,
        paymentTokenAddress,
        isTestWallet,
        marketplaceAddress: MARKETPLACE_ADDRESS,
      });

      // Use direct viem method for test wallet
      if (isTestWallet && isTestWalletAvailable()) {
        console.log('[usePurchase] Using direct test wallet transaction');
        hash = await testWalletWriteContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: purchaseArgs,
          gas: 500000n,
        });
      } else if (useGasless) {
        // Gasless meta-transaction. The relay (/api/relay/route.ts) waits
        // for the receipt server-side AND decodes OrderPlaced for us, so
        // the result includes orderId — we don't need to poll the receipt
        // again on the client. That client-side poll is the doomed pattern
        // that hangs when public Base RPCs 403 under load. The same fix is
        // already in useCreateListing; this propagates it to buyer flow.
        console.log('[usePurchase] Using gasless meta-transaction');
        const result = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: purchaseArgs,
          gas: 500000n,
        });
        if (!result) {
          setError(gaslessError || 'Gasless transaction failed');
          return null;
        }
        return {
          orderId: result.orderId ?? 0n,
          txHash: result.hash,
        };
      } else {
        // Use wallet client for regular wallets
        hash = await walletClient!.writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: purchaseArgs,
        });
      }

      // Non-gasless paths (test wallet + walletClient) need to fetch the
      // receipt themselves. The wallet that signed has ETH and a working
      // provider; the public client times out cleanly via the explicit
      // timeout instead of hanging forever if RPCs misbehave.
      console.log('[usePurchase] Waiting for transaction receipt:', hash);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 60_000,
      });
      console.log('[usePurchase] Receipt status:', receipt.status, 'logs:', receipt.logs.length);

      if (receipt.status === 'reverted') {
        console.error('[usePurchase] Transaction reverted!');
        setError('Transaction reverted on-chain');
        return null;
      }

      // Parse OrderPlaced event to get orderId.
      let orderId = 0n;
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: marketplaceAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'OrderPlaced') {
            orderId = (decoded.args as { orderId: bigint }).orderId;
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
      console.error('[usePurchase] Purchase error:', err);
      // Extract detailed error message
      let errorMessage = 'Purchase failed';
      if (err instanceof Error) {
        errorMessage = err.message;
        // Log full error details
        console.error('[usePurchase] Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack,
          cause: (err as any).cause,
        });
      }
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
