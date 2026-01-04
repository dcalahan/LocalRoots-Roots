'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { useSellerStatus } from './useSellerStatus';
import { usePrivyGaslessTransaction } from './usePrivyGaslessTransaction';
import { usePrivyWallet } from './usePrivyWallet';
import { getIpfsUrl } from '@/lib/pinata';
import { OrderStatus, DISPUTE_WINDOW_SECONDS } from '@/types/order';

// Re-export OrderStatus for convenience
export { OrderStatus };

// Helper to fetch listing metadata from IPFS
async function fetchListingMetadata(metadataIpfs: string): Promise<{ produceName: string } | null> {
  if (!metadataIpfs) return null;

  try {
    const url = metadataIpfs.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${metadataIpfs.slice(7)}`
      : metadataIpfs.startsWith('data:')
        ? null // Handle data URI
        : `https://gateway.pinata.cloud/ipfs/${metadataIpfs}`;

    if (!url) {
      // Handle data URI format
      if (metadataIpfs.startsWith('data:application/json,')) {
        const jsonStr = decodeURIComponent(metadataIpfs.slice('data:application/json,'.length));
        const data = JSON.parse(jsonStr);
        return { produceName: data.produceName || 'Unknown Product' };
      }
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return { produceName: data.produceName || 'Unknown Product' };
  } catch {
    return null;
  }
}

// Helper to fetch buyer info from IPFS
async function fetchBuyerInfo(buyerInfoIpfs: string): Promise<DeliveryInfo | null> {
  if (!buyerInfoIpfs) return null;

  try {
    const url = getIpfsUrl(buyerInfoIpfs);
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      address: data.address || '',
      phone: data.phone,
      notes: data.notes,
      savedAt: data.uploadedAt || Date.now(),
    };
  } catch (err) {
    console.error('[fetchBuyerInfo] Failed to fetch buyer info:', err);
    return null;
  }
}

export interface DeliveryInfo {
  address: string;
  notes?: string;
  phone?: string;
  savedAt: number;
}

export interface SellerOrder {
  orderId: string;
  listingId: string;
  buyer: string;
  quantity: number;
  totalPrice: string;
  isDelivery: boolean;
  status: OrderStatus;
  createdAt: Date;
  completedAt: Date | null;
  proofIpfs: string;
  proofUploadedAt: Date | null;
  fundsReleased: boolean;
  // Metadata from listing
  produceName?: string;
  // Delivery info (from local storage)
  deliveryInfo?: DeliveryInfo;
}

export function useSellerOrders() {
  const { sellerId } = useSellerStatus();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!sellerId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create fresh client for each fetch to avoid caching issues
      const client = createFreshPublicClient();

      // Get next order ID to know how many orders exist
      const nextOrderId = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'nextOrderId',
      }) as bigint;

      // Add buffer to catch orders the RPC might be behind on
      const checkUpTo = nextOrderId + 5n;

      const sellerOrders: SellerOrder[] = [];

      // Iterate through all orders and filter by seller
      for (let i = 1n; i < checkUpTo; i++) {
        try {
          const order = await client.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'orders',
            args: [i],
          }) as [bigint, bigint, string, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string];

          const [
            listingId,
            orderSellerId,
            buyer,
            quantity,
            totalPrice,
            isDelivery,
            status,
            createdAt,
            completedAt,
            ,
            proofIpfs,
            proofUploadedAt,
            fundsReleased,
            buyerInfoIpfs,
          ] = order;

          // Only include orders for this seller (compare as strings)
          if (orderSellerId.toString() === sellerId) {
            // Fetch listing to get metadata IPFS
            let produceName = 'Unknown Product';
            try {
              const listing = await client.readContract({
                address: MARKETPLACE_ADDRESS,
                abi: marketplaceAbi,
                functionName: 'listings',
                args: [listingId],
              }) as [bigint, string, bigint, bigint, boolean];

              const metadataIpfs = listing[1];
              const metadata = await fetchListingMetadata(metadataIpfs);
              if (metadata?.produceName) {
                produceName = metadata.produceName;
              }
            } catch (err) {
              console.error(`Error fetching listing ${listingId} metadata:`, err);
            }

            // Get delivery info from IPFS if this is a delivery order
            let deliveryInfo: DeliveryInfo | undefined;
            if (isDelivery && buyerInfoIpfs) {
              deliveryInfo = (await fetchBuyerInfo(buyerInfoIpfs)) || undefined;
            }
            console.log(`[useSellerOrders] Order ${i}: isDelivery=${isDelivery}, buyerInfoIpfs=${buyerInfoIpfs}, deliveryInfo=`, deliveryInfo);

            sellerOrders.push({
              orderId: i.toString(),
              listingId: listingId.toString(),
              buyer,
              quantity: Number(quantity),
              totalPrice: totalPrice.toString(),
              isDelivery,
              status: status as OrderStatus,
              createdAt: new Date(Number(createdAt) * 1000),
              completedAt: completedAt > 0n ? new Date(Number(completedAt) * 1000) : null,
              proofIpfs,
              proofUploadedAt: proofUploadedAt > 0n ? new Date(Number(proofUploadedAt) * 1000) : null,
              fundsReleased,
              produceName,
              deliveryInfo: deliveryInfo || undefined,
            });
          }
        } catch (err) {
          console.error(`Error fetching order ${i}:`, err);
        }
      }

      // Sort by date, newest first
      sellerOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setOrders(sellerOrders);
    } catch (err) {
      console.error('Error fetching seller orders:', err);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders };
}

// Hook for accepting an order - uses gasless meta-transactions
export function useAcceptOrder() {
  const { authenticated } = usePrivy();
  const { address: privyAddress, isReady, ensureWallet, isCreating } = usePrivyWallet();
  const { executeGasless, isLoading, error: gaslessError } = usePrivyGaslessTransaction();

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const acceptOrder = useCallback(
    async (orderId: bigint): Promise<boolean> => {
      setError(null);
      setIsSuccess(false);

      console.log('[useAcceptOrder] ========== ACCEPT ORDER START ==========');
      console.log('[useAcceptOrder] orderId:', orderId.toString());
      console.log('[useAcceptOrder] isReady:', isReady);
      console.log('[useAcceptOrder] privyAddress:', privyAddress);
      console.log('[useAcceptOrder] authenticated:', authenticated);

      // If authenticated but no wallet, try to create one
      let walletAddress = privyAddress;
      if (authenticated && !privyAddress) {
        console.log('[useAcceptOrder] No wallet found, attempting to create...');
        walletAddress = await ensureWallet() as `0x${string}` | undefined;
        if (!walletAddress) {
          console.error('[useAcceptOrder] Failed to create wallet!');
          setError(new Error('Unable to set up your account. Please try logging out and back in.'));
          return false;
        }
        console.log('[useAcceptOrder] Wallet created:', walletAddress);
      }

      if (!authenticated || !walletAddress) {
        console.error('[useAcceptOrder] Not authenticated or no wallet!');
        setError(new Error('Please sign in first'));
        return false;
      }

      try {
        console.log('[useAcceptOrder] Sending gasless transaction...');

        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'acceptOrder',
          args: [orderId],
          gas: 150000n,
        });

        if (txHash) {
          console.log('[useAcceptOrder] Transaction confirmed:', txHash);
          setIsSuccess(true);
          console.log('[useAcceptOrder] ========== ACCEPT ORDER END ==========');
          return true;
        } else {
          throw new Error(gaslessError || 'Transaction failed');
        }
      } catch (err) {
        console.error('[useAcceptOrder] Transaction error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        console.log('[useAcceptOrder] ========== ACCEPT ORDER END ==========');
        return false;
      }
    },
    [executeGasless, authenticated, privyAddress, ensureWallet, gaslessError, isReady]
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    acceptOrder,
    isPending: isLoading || isCreating,
    isSuccess,
    error: error || (gaslessError ? new Error(gaslessError) : null),
    reset,
  };
}

// Hook for marking order ready for pickup - uses gasless meta-transactions
export function useMarkReadyForPickup() {
  const { authenticated } = usePrivy();
  const { address: privyAddress, ensureWallet, isCreating } = usePrivyWallet();
  const { executeGasless, isLoading, error: gaslessError } = usePrivyGaslessTransaction();

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markReady = useCallback(
    async (orderId: bigint, proofIpfs: string): Promise<boolean> => {
      setError(null);
      setIsSuccess(false);

      console.log('[useMarkReadyForPickup] Called with orderId:', orderId.toString());

      // Ensure wallet exists
      let walletAddress = privyAddress;
      if (authenticated && !privyAddress) {
        walletAddress = await ensureWallet() as `0x${string}` | undefined;
        if (!walletAddress) {
          setError(new Error('Unable to set up your account. Please try logging out and back in.'));
          return false;
        }
      }

      if (!authenticated || !walletAddress) {
        setError(new Error('Please sign in first'));
        return false;
      }

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'markReadyForPickup',
          args: [orderId, proofIpfs],
          gas: 300000n,
        });

        if (txHash) {
          console.log('[useMarkReadyForPickup] Transaction confirmed:', txHash);
          setIsSuccess(true);
          return true;
        } else {
          throw new Error(gaslessError || 'Transaction failed');
        }
      } catch (err) {
        console.error('[useMarkReadyForPickup] Transaction error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [executeGasless, authenticated, privyAddress, ensureWallet, gaslessError]
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    markReady,
    isPending: isLoading || isCreating,
    isSuccess,
    error: error || (gaslessError ? new Error(gaslessError) : null),
    reset,
  };
}

// Hook for marking order out for delivery - uses gasless meta-transactions
export function useMarkOutForDelivery() {
  const { authenticated } = usePrivy();
  const { address: privyAddress, ensureWallet, isCreating } = usePrivyWallet();
  const { executeGasless, isLoading, error: gaslessError } = usePrivyGaslessTransaction();

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markOutForDelivery = useCallback(
    async (orderId: bigint, proofIpfs: string): Promise<boolean> => {
      setError(null);
      setIsSuccess(false);

      console.log('[useMarkOutForDelivery] Called with orderId:', orderId.toString());

      // Ensure wallet exists
      let walletAddress = privyAddress;
      if (authenticated && !privyAddress) {
        walletAddress = await ensureWallet() as `0x${string}` | undefined;
        if (!walletAddress) {
          setError(new Error('Unable to set up your account. Please try logging out and back in.'));
          return false;
        }
      }

      if (!authenticated || !walletAddress) {
        setError(new Error('Please sign in first'));
        return false;
      }

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'markOutForDelivery',
          args: [orderId, proofIpfs],
          gas: 300000n,
        });

        if (txHash) {
          console.log('[useMarkOutForDelivery] Transaction confirmed:', txHash);
          setIsSuccess(true);
          return true;
        } else {
          throw new Error(gaslessError || 'Transaction failed');
        }
      } catch (err) {
        console.error('[useMarkOutForDelivery] Transaction error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [executeGasless, authenticated, privyAddress, ensureWallet, gaslessError]
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    markOutForDelivery,
    isPending: isLoading || isCreating,
    isSuccess,
    error: error || (gaslessError ? new Error(gaslessError) : null),
    reset,
  };
}

// Hook for claiming funds after dispute window expires - uses gasless meta-transactions
export function useClaimFunds() {
  const { authenticated } = usePrivy();
  const { address: privyAddress, ensureWallet, isCreating } = usePrivyWallet();
  const { executeGasless, isLoading, error: gaslessError } = usePrivyGaslessTransaction();

  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimFunds = useCallback(
    async (orderId: bigint): Promise<boolean> => {
      setError(null);
      setIsSuccess(false);

      console.log('[useClaimFunds] Called with orderId:', orderId.toString());

      // Ensure wallet exists
      let walletAddress = privyAddress;
      if (authenticated && !privyAddress) {
        walletAddress = await ensureWallet() as `0x${string}` | undefined;
        if (!walletAddress) {
          setError(new Error('Unable to set up your account. Please try logging out and back in.'));
          return false;
        }
      }

      if (!authenticated || !walletAddress) {
        setError(new Error('Please sign in first'));
        return false;
      }

      try {
        const txHash = await executeGasless({
          to: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'claimFunds',
          args: [orderId],
          gas: 300000n,
        });

        if (txHash) {
          console.log('[useClaimFunds] Transaction confirmed:', txHash);
          setIsSuccess(true);
          return true;
        } else {
          throw new Error(gaslessError || 'Transaction failed');
        }
      } catch (err) {
        console.error('[useClaimFunds] Transaction error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [executeGasless, authenticated, privyAddress, ensureWallet, gaslessError]
  );

  const reset = useCallback(() => {
    setIsSuccess(false);
    setError(null);
  }, []);

  return {
    claimFunds,
    isPending: isLoading || isCreating,
    isSuccess,
    error: error || (gaslessError ? new Error(gaslessError) : null),
    reset,
  };
}

// Hook for auto-claiming funds for all eligible orders (past 48-hour window)
export function useAutoClaimFunds(orders: SellerOrder[], onClaimed: () => void) {
  const { claimFunds, isPending } = useClaimFunds();
  const [claimingOrderIds, setClaimingOrderIds] = useState<Set<string>>(new Set());
  const [claimedOrderIds, setClaimedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Find orders eligible for claiming:
    // - Status is ReadyForPickup or OutForDelivery
    // - Has proof uploaded
    // - Proof uploaded more than 48 hours ago
    // - Funds not yet released
    // - Not already being claimed or claimed in this session
    const eligibleOrders = orders.filter(order => {
      if (order.fundsReleased) return false;
      if (!order.proofUploadedAt) return false;
      if (order.status !== OrderStatus.ReadyForPickup && order.status !== OrderStatus.OutForDelivery) return false;
      if (claimingOrderIds.has(order.orderId) || claimedOrderIds.has(order.orderId)) return false;

      const now = Date.now();
      const releaseTime = order.proofUploadedAt.getTime() + (DISPUTE_WINDOW_SECONDS * 1000);
      return now >= releaseTime;
    });

    if (eligibleOrders.length === 0 || isPending) return;

    // Claim the first eligible order (we'll do them one at a time to avoid issues)
    const orderToClaim = eligibleOrders[0];

    const claimOrder = async () => {
      console.log('[useAutoClaimFunds] Auto-claiming funds for order:', orderToClaim.orderId);
      setClaimingOrderIds(prev => new Set(prev).add(orderToClaim.orderId));

      const success = await claimFunds(BigInt(orderToClaim.orderId));

      if (success) {
        console.log('[useAutoClaimFunds] Successfully claimed order:', orderToClaim.orderId);
        setClaimedOrderIds(prev => new Set(prev).add(orderToClaim.orderId));
        onClaimed(); // Refresh orders list
      }

      setClaimingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(orderToClaim.orderId);
        return next;
      });
    };

    claimOrder();
  }, [orders, claimFunds, isPending, claimingOrderIds, claimedOrderIds, onClaimed]);

  return { isAutoClaiming: isPending || claimingOrderIds.size > 0 };
}
