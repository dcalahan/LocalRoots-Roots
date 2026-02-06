'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, usePublicClient } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { AMBASSADOR_REWARDS_ADDRESS, ambassadorAbi } from '@/lib/contracts/ambassador';
import { decodeGeohash, reverseGeocode, type GeohashLocation } from '@/lib/geohashLocation';

// Seller with location info
export interface SellerWithLocation {
  id: bigint;
  owner: string;
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: bigint;
  createdAt: bigint;
  active: boolean;
  suspended: boolean;
  location: GeohashLocation;
  locationName: string; // Resolved location name from reverse geocoding
}

// Order with seller location
export interface OrderWithLocation {
  id: bigint;
  listingId: bigint;
  sellerId: bigint;
  buyer: string;
  quantity: bigint;
  totalPrice: bigint;
  isDelivery: boolean;
  status: number;
  createdAt: bigint;
  completedAt: bigint;
  rewardQueued: boolean;
  proofIpfs: string;
  proofUploadedAt: bigint;
  fundsReleased: boolean;
  buyerInfoIpfs: string;
  sellerLocation: GeohashLocation;
  sellerLocationName: string; // Resolved location name from reverse geocoding
}

// Ambassador with location info
export interface AmbassadorWithLocation {
  id: bigint;
  wallet: string;
  uplineId: bigint;
  totalEarned: bigint;
  totalPending: bigint;
  recruitedSellers: bigint;
  recruitedAmbassadors: bigint;
  createdAt: bigint;
  active: boolean;
  suspended: boolean;
  regionGeohash: string;
  profileIpfs: string;
  location: GeohashLocation;
  locationName: string; // Resolved location name from reverse geocoding
}

/**
 * Hook to fetch all sellers with location info for admin view
 */
export function useAdminSellers() {
  const publicClient = usePublicClient();
  const [sellers, setSellers] = useState<SellerWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: nextSellerId } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'nextSellerId',
  });

  const fetchSellers = useCallback(async () => {
    if (!publicClient || !nextSellerId) return;

    setIsLoading(true);
    setError(null);

    try {
      const sellerCount = Number(nextSellerId);
      const sellerPromises: Promise<SellerWithLocation | null>[] = [];

      for (let i = 1; i <= sellerCount; i++) {
        sellerPromises.push(
          (async () => {
            try {
              const [sellerData, isSuspended] = await Promise.all([
                publicClient.readContract({
                  address: MARKETPLACE_ADDRESS,
                  abi: marketplaceAbi,
                  functionName: 'sellers',
                  args: [BigInt(i)],
                }) as Promise<[string, string, string, boolean, boolean, bigint, bigint, boolean]>,
                publicClient.readContract({
                  address: MARKETPLACE_ADDRESS,
                  abi: marketplaceAbi,
                  functionName: 'isSellerSuspended',
                  args: [BigInt(i)],
                }) as Promise<boolean>,
              ]);

              const [owner, geohash, storefrontIpfs, offersDelivery, offersPickup, deliveryRadiusKm, createdAt, active] = sellerData;

              // Skip empty sellers (owner is zero address)
              if (owner === '0x0000000000000000000000000000000000000000') {
                return null;
              }

              const location = decodeGeohash(geohash);

              // Get resolved location name via reverse geocoding
              const locationName = await reverseGeocode(location.latitude, location.longitude);

              return {
                id: BigInt(i),
                owner,
                geohash,
                storefrontIpfs,
                offersDelivery,
                offersPickup,
                deliveryRadiusKm,
                createdAt,
                active,
                suspended: isSuspended,
                location,
                locationName,
              };
            } catch {
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(sellerPromises);
      const validSellers = results.filter((s): s is SellerWithLocation => s !== null);

      // Sort by createdAt descending (newest first)
      validSellers.sort((a, b) => Number(b.createdAt - a.createdAt));

      setSellers(validSellers);
    } catch (err) {
      console.error('[useAdminSellers] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sellers');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, nextSellerId]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  return {
    sellers,
    isLoading,
    error,
    refetch: fetchSellers,
  };
}

/**
 * Hook to fetch all orders with seller location for admin view
 */
export function useAdminOrders() {
  const publicClient = usePublicClient();
  const [orders, setOrders] = useState<OrderWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: nextOrderId } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'nextOrderId',
  });

  const fetchOrders = useCallback(async () => {
    if (!publicClient || !nextOrderId) return;

    setIsLoading(true);
    setError(null);

    try {
      const orderCount = Number(nextOrderId);
      const orderPromises: Promise<OrderWithLocation | null>[] = [];

      for (let i = 1; i <= orderCount; i++) {
        orderPromises.push(
          (async () => {
            try {
              const orderData = await publicClient.readContract({
                address: MARKETPLACE_ADDRESS,
                abi: marketplaceAbi,
                functionName: 'orders',
                args: [BigInt(i)],
              }) as unknown as [bigint, bigint, string, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string, string];

              const [listingId, sellerId, buyer, quantity, totalPrice, isDelivery, status, createdAt, completedAt, rewardQueued, proofIpfs, proofUploadedAt, fundsReleased, buyerInfoIpfs, _paymentToken] = orderData;

              // Skip empty orders (buyer is zero address)
              if (buyer === '0x0000000000000000000000000000000000000000') {
                return null;
              }

              // Get seller data for location
              const sellerData = await publicClient.readContract({
                address: MARKETPLACE_ADDRESS,
                abi: marketplaceAbi,
                functionName: 'sellers',
                args: [sellerId],
              }) as [string, string, string, boolean, boolean, bigint, bigint, boolean];

              const sellerGeohash = sellerData[1];
              const sellerLocation = decodeGeohash(sellerGeohash);

              // Get resolved location name via reverse geocoding
              const sellerLocationName = await reverseGeocode(sellerLocation.latitude, sellerLocation.longitude);

              return {
                id: BigInt(i),
                listingId,
                sellerId,
                buyer,
                quantity,
                totalPrice,
                isDelivery,
                status,
                createdAt,
                completedAt,
                rewardQueued,
                proofIpfs,
                proofUploadedAt,
                fundsReleased,
                buyerInfoIpfs,
                sellerLocation,
                sellerLocationName,
              };
            } catch {
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(orderPromises);
      const validOrders = results.filter((o): o is OrderWithLocation => o !== null);

      // Sort by createdAt descending (newest first)
      validOrders.sort((a, b) => Number(b.createdAt - a.createdAt));

      setOrders(validOrders);
    } catch (err) {
      console.error('[useAdminOrders] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, nextOrderId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
  };
}

/**
 * Hook to fetch all ambassadors with location info for admin view
 */
export function useAdminAmbassadors() {
  const publicClient = usePublicClient();
  const [ambassadors, setAmbassadors] = useState<AmbassadorWithLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: nextAmbassadorId } = useReadContract({
    address: AMBASSADOR_REWARDS_ADDRESS,
    abi: ambassadorAbi,
    functionName: 'nextAmbassadorId',
  });

  const fetchAmbassadors = useCallback(async () => {
    if (!publicClient || !nextAmbassadorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const ambassadorCount = Number(nextAmbassadorId);
      const ambassadorPromises: Promise<AmbassadorWithLocation | null>[] = [];

      for (let i = 1; i <= ambassadorCount; i++) {
        ambassadorPromises.push(
          (async () => {
            try {
              const ambassadorData = await publicClient.readContract({
                address: AMBASSADOR_REWARDS_ADDRESS,
                abi: ambassadorAbi,
                functionName: 'getAmbassador',
                args: [BigInt(i)],
              }) as {
                wallet: string;
                uplineId: bigint;
                totalEarned: bigint;
                totalPending: bigint;
                recruitedSellers: bigint;
                recruitedAmbassadors: bigint;
                createdAt: bigint;
                active: boolean;
                suspended: boolean;
                regionGeohash: string;
                profileIpfs: string;
              };

              // Skip empty ambassadors (wallet is zero address)
              if (ambassadorData.wallet === '0x0000000000000000000000000000000000000000') {
                return null;
              }

              const location = decodeGeohash(ambassadorData.regionGeohash);

              // Get resolved location name via reverse geocoding
              const locationName = await reverseGeocode(location.latitude, location.longitude);

              return {
                id: BigInt(i),
                wallet: ambassadorData.wallet,
                uplineId: ambassadorData.uplineId,
                totalEarned: ambassadorData.totalEarned,
                totalPending: ambassadorData.totalPending,
                recruitedSellers: ambassadorData.recruitedSellers,
                recruitedAmbassadors: ambassadorData.recruitedAmbassadors,
                createdAt: ambassadorData.createdAt,
                active: ambassadorData.active,
                suspended: ambassadorData.suspended,
                regionGeohash: ambassadorData.regionGeohash,
                profileIpfs: ambassadorData.profileIpfs,
                location,
                locationName,
              };
            } catch {
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(ambassadorPromises);
      const validAmbassadors = results.filter((a): a is AmbassadorWithLocation => a !== null);

      // Sort by createdAt descending (newest first)
      validAmbassadors.sort((a, b) => Number(b.createdAt - a.createdAt));

      setAmbassadors(validAmbassadors);
    } catch (err) {
      console.error('[useAdminAmbassadors] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ambassadors');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, nextAmbassadorId]);

  useEffect(() => {
    fetchAmbassadors();
  }, [fetchAmbassadors]);

  return {
    ambassadors,
    isLoading,
    error,
    refetch: fetchAmbassadors,
  };
}
