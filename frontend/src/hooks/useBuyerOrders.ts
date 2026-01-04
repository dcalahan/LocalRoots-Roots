'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { createFreshPublicClient } from '@/lib/viemClient';
import { getIpfsUrl } from '@/lib/pinata';
import { OrderStatus, type Order, type OrderWithMetadata } from '@/types/order';

interface ListingMetadata {
  produceName: string;
  description: string;
  imageUrl: string | null;
  unit: string;
}

interface SellerMetadata {
  name: string;
  address?: string; // Pickup address for the seller
}

// Test metadata for development (when IPFS metadata is not available)
const TEST_LISTING_METADATA: Record<string, ListingMetadata> = {
  'test-tomatoes': {
    produceName: 'Heirloom Tomatoes',
    description: 'Freshly picked Cherokee Purple and Brandywine heirloom tomatoes.',
    imageUrl: null,
    unit: 'lb',
  },
  'test-peppers': {
    produceName: 'Bell Peppers',
    description: 'Mix of red, yellow, and green bell peppers.',
    imageUrl: null,
    unit: 'each',
  },
  'test-basil': {
    produceName: 'Fresh Basil',
    description: 'Aromatic Genovese basil, freshly cut.',
    imageUrl: null,
    unit: 'bunch',
  },
};

const TEST_SELLER_METADATA: SellerMetadata = {
  name: 'Hilton Head Garden',
};

// Convert an image reference to a displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | null {
  if (!imageRef) return null;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

async function fetchIpfsMetadata<T>(ipfsHash: string): Promise<T | null> {
  // Check for test metadata first
  if (ipfsHash.startsWith('test-')) {
    const testData = TEST_LISTING_METADATA[ipfsHash];
    if (testData) return testData as T;
  }

  // Check for test seller metadata
  if (ipfsHash === 'test-seller-hiltonhead') {
    return TEST_SELLER_METADATA as T;
  }

  // Handle data URIs (used during MVP before IPFS upload)
  if (ipfsHash.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(ipfsHash.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        produceName: data.produceName || 'Unknown',
        description: data.description || '',
        imageUrl: resolveImageUrl(data.images?.[0]),
        unit: data.unitName || data.unitId || 'unit',
        name: data.name || 'Local Seller',
      } as T;
    } catch (err) {
      console.error('Error parsing data URI metadata:', err);
      return null;
    }
  }

  try {
    const url = ipfsHash.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${ipfsHash.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    // Convert image hash to URL and return normalized metadata
    return {
      produceName: data.produceName || 'Unknown',
      description: data.description || '',
      imageUrl: resolveImageUrl(data.images?.[0]),
      unit: data.unitName || data.unitId || 'unit',
      name: data.name || 'Local Seller',
    } as T;
  } catch {
    return null;
  }
}

export function useBuyerOrders() {
  const { address: wagmiAddress } = useAccount();
  const { user, authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();

  // Get Privy embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = (embeddedWallet?.address || user?.wallet?.address) as `0x${string}` | undefined;

  // For buyers, use wagmi address first (external wallet for purchases), then Privy
  const address = wagmiAddress || privyAddress;
  const isConnected = !!wagmiAddress || (authenticated && walletsReady && !!privyAddress);

  const [orders, setOrders] = useState<OrderWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    console.log('[useBuyerOrders] fetchOrders called, address:', address, 'isConnected:', isConnected);

    if (!address) {
      console.log('[useBuyerOrders] No address, returning early');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create fresh client for each fetch to avoid caching issues
      const client = createFreshPublicClient();

      // Get next order ID
      const nextOrderId = await client.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'nextOrderId',
      }) as bigint;

      // Add buffer to catch orders the RPC might be behind on
      const checkUpTo = nextOrderId + 5n;

      const orderPromises: Promise<OrderWithMetadata | null>[] = [];

      // Check each order to see if it belongs to this buyer
      for (let i = 1n; i < checkUpTo; i++) {
        orderPromises.push(fetchOrderIfBuyer(client, i, address));
      }

      const results = await Promise.all(orderPromises);
      const buyerOrders = results.filter((o): o is OrderWithMetadata => o !== null);

      console.log('[useBuyerOrders] Found', buyerOrders.length, 'orders for address', address, 'out of', Number(nextOrderId), 'total orders');

      // Sort by createdAt descending (newest first)
      buyerOrders.sort((a, b) => Number(b.createdAt - a.createdAt));

      setOrders(buyerOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [address, walletsReady]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, isLoading, error, refetch: fetchOrders, isConnected };
}

async function fetchOrderIfBuyer(
  client: ReturnType<typeof createFreshPublicClient>,
  orderId: bigint,
  buyerAddress: string
): Promise<OrderWithMetadata | null> {

  try {
    const order = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'orders',
      args: [orderId],
    }) as [bigint, bigint, string, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string];

    const [
      listingId, sellerId, buyer, quantity, totalPrice, isDelivery,
      status, createdAt, completedAt, rewardQueued, proofIpfs, proofUploadedAt, fundsReleased, buyerInfoIpfs
    ] = order;

    // Check if this order belongs to the buyer
    if (buyer.toLowerCase() !== buyerAddress.toLowerCase()) {
      return null;
    }

    // Fetch listing and seller metadata
    const listing = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'listings',
      args: [listingId],
    }) as [bigint, string, bigint, bigint, boolean];

    const seller = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellers',
      args: [sellerId],
    }) as [string, string, string, boolean, boolean, bigint, bigint, boolean];

    const [listingMeta, sellerMeta] = await Promise.all([
      fetchIpfsMetadata<ListingMetadata>(listing[1]),
      fetchIpfsMetadata<SellerMetadata>(seller[2]),
    ]);

    return {
      orderId,
      listingId,
      sellerId,
      buyer: buyer as `0x${string}`,
      quantity,
      totalPrice,
      isDelivery,
      status: status as OrderStatus,
      createdAt,
      completedAt,
      rewardQueued,
      proofIpfs,
      proofUploadedAt,
      fundsReleased,
      metadata: {
        produceName: listingMeta?.produceName || 'Unknown Product',
        imageUrl: listingMeta?.imageUrl || null,
        sellerName: sellerMeta?.name || 'Local Seller',
        unit: listingMeta?.unit || 'unit',
        sellerPickupAddress: sellerMeta?.address,
      },
    };
  } catch (err) {
    console.error(`Error fetching order ${orderId}:`, err);
    return null;
  }
}

export function useOrderDetail(orderId: string) {
  const { address } = useAccount();
  const [order, setOrder] = useState<OrderWithMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!orderId || !address) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create fresh client to avoid caching issues
        const client = createFreshPublicClient();
        const data = await fetchOrderIfBuyer(client, BigInt(orderId), address);
        if (data) {
          setOrder(data);
        } else {
          setError('Order not found or access denied');
        }
      } catch (err) {
        console.error('Error fetching order detail:', err);
        setError('Failed to load order');
      } finally {
        setIsLoading(false);
      }
    }

    fetch();
  }, [orderId, address]);

  return { order, isLoading, error };
}
