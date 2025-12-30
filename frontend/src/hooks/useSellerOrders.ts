'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { useSellerStatus } from './useSellerStatus';
import { isTestWalletAvailable, testWalletWriteContract } from '@/lib/testWalletConnector';
import { getIpfsUrl } from '@/lib/pinata';
import { OrderStatus } from '@/types/order';

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

          // Only include orders for this seller
          if (orderSellerId === sellerId) {
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

// Hook for accepting an order
export function useAcceptOrder() {
  const { connector } = useAccount();
  const { writeContract, data: wagmiHash, isPending: isWagmiPending, error: wagmiError } = useWriteContract();
  const [directHash, setDirectHash] = useState<`0x${string}` | null>(null);
  const [directError, setDirectError] = useState<Error | null>(null);
  const [isDirectPending, setIsDirectPending] = useState(false);

  const hash = directHash || wagmiHash;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isTestWallet = connector?.id === 'testWallet';
  const isPending = isDirectPending || isWagmiPending || isConfirming;
  const error = directError || wagmiError;

  const acceptOrder = useCallback(
    async (orderId: bigint) => {
      setDirectError(null);

      if (isTestWallet && isTestWalletAvailable()) {
        setIsDirectPending(true);
        try {
          const txHash = await testWalletWriteContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'acceptOrder',
            args: [orderId],
            gas: 100000n,
          });
          setDirectHash(txHash);
        } catch (err) {
          setDirectError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsDirectPending(false);
        }
        return;
      }

      writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'acceptOrder',
        args: [orderId],
        gas: 100000n,
      });
    },
    [writeContract, isTestWallet]
  );

  return {
    acceptOrder,
    isPending,
    isSuccess,
    error,
  };
}

// Hook for marking order ready for pickup
export function useMarkReadyForPickup() {
  const { connector } = useAccount();
  const { writeContract, data: wagmiHash, isPending: isWagmiPending, error: wagmiError } = useWriteContract();
  const [directHash, setDirectHash] = useState<`0x${string}` | null>(null);
  const [directError, setDirectError] = useState<Error | null>(null);
  const [isDirectPending, setIsDirectPending] = useState(false);

  const hash = directHash || wagmiHash;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isTestWallet = connector?.id === 'testWallet';
  const isPending = isDirectPending || isWagmiPending || isConfirming;
  const error = directError || wagmiError;

  const markReady = useCallback(
    async (orderId: bigint, proofIpfs: string) => {
      setDirectError(null);

      if (isTestWallet && isTestWalletAvailable()) {
        setIsDirectPending(true);
        try {
          const txHash = await testWalletWriteContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'markReadyForPickup',
            args: [orderId, proofIpfs],
            gas: 300000n,
          });
          setDirectHash(txHash);
        } catch (err) {
          setDirectError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsDirectPending(false);
        }
        return;
      }

      writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'markReadyForPickup',
        args: [orderId, proofIpfs],
        gas: 300000n,
      });
    },
    [writeContract, isTestWallet]
  );

  return {
    markReady,
    isPending,
    isSuccess,
    error,
  };
}

// Hook for marking order out for delivery
export function useMarkOutForDelivery() {
  const { connector } = useAccount();
  const { writeContract, data: wagmiHash, isPending: isWagmiPending, error: wagmiError } = useWriteContract();
  const [directHash, setDirectHash] = useState<`0x${string}` | null>(null);
  const [directError, setDirectError] = useState<Error | null>(null);
  const [isDirectPending, setIsDirectPending] = useState(false);

  const hash = directHash || wagmiHash;
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const isTestWallet = connector?.id === 'testWallet';
  const isPending = isDirectPending || isWagmiPending || isConfirming;
  const error = directError || wagmiError;

  const markOutForDelivery = useCallback(
    async (orderId: bigint, proofIpfs: string) => {
      setDirectError(null);

      if (isTestWallet && isTestWalletAvailable()) {
        setIsDirectPending(true);
        try {
          const txHash = await testWalletWriteContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'markOutForDelivery',
            args: [orderId, proofIpfs],
            gas: 300000n,
          });
          setDirectHash(txHash);
        } catch (err) {
          setDirectError(err instanceof Error ? err : new Error(String(err)));
        } finally {
          setIsDirectPending(false);
        }
        return;
      }

      writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'markOutForDelivery',
        args: [orderId, proofIpfs],
        gas: 300000n,
      });
    },
    [writeContract, isTestWallet]
  );

  return {
    markOutForDelivery,
    isPending,
    isSuccess,
    error,
  };
}
