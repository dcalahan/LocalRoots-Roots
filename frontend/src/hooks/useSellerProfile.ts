'use client';

import { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { useSellerStatus } from './useSellerStatus';
import { getIpfsUrl } from '@/lib/pinata';

interface StorefrontMetadata {
  name?: string;
  description?: string;
  imageUrl?: string;
}

export interface SellerProfile {
  sellerId: bigint;
  owner: string;
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  createdAt: Date;
  active: boolean;
  metadata: StorefrontMetadata | null;
}

// Convert an image reference to a displayable URL
function resolveImageUrl(imageRef: string | null | undefined): string | undefined {
  if (!imageRef) return undefined;
  // Already a full URL (http/https or data:)
  if (imageRef.startsWith('http') || imageRef.startsWith('data:')) {
    return imageRef;
  }
  // IPFS hash - convert to gateway URL
  return getIpfsUrl(imageRef);
}

async function fetchStorefrontMetadata(storefrontIpfs: string): Promise<StorefrontMetadata | null> {
  if (!storefrontIpfs) return null;

  // Handle data URI format
  if (storefrontIpfs.startsWith('data:application/json,')) {
    try {
      const jsonStr = decodeURIComponent(storefrontIpfs.slice('data:application/json,'.length));
      const data = JSON.parse(jsonStr);
      return {
        name: data.name || undefined,
        description: data.description || undefined,
        imageUrl: resolveImageUrl(data.imageUrl),
      };
    } catch {
      return null;
    }
  }

  // Handle IPFS hashes
  try {
    const url = storefrontIpfs.startsWith('ipfs://')
      ? `https://gateway.pinata.cloud/ipfs/${storefrontIpfs.slice(7)}`
      : `https://gateway.pinata.cloud/ipfs/${storefrontIpfs}`;

    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      name: data.name || undefined,
      description: data.description || undefined,
      imageUrl: resolveImageUrl(data.imageUrl),
    };
  } catch {
    return null;
  }
}

export function useSellerProfile() {
  const { sellerId, isLoading: isLoadingStatus } = useSellerStatus();
  const [metadata, setMetadata] = useState<StorefrontMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  const { data: sellerData, isLoading: isLoadingProfile, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'sellers',
    args: sellerId ? [sellerId] : undefined,
    query: {
      enabled: sellerId !== null && sellerId !== undefined,
    },
  });

  // Fetch metadata when seller data changes
  useEffect(() => {
    if (sellerData) {
      const storefrontIpfs = (sellerData as [string, string, string, boolean, boolean, bigint, bigint, boolean])[2];
      if (storefrontIpfs) {
        setIsLoadingMetadata(true);
        fetchStorefrontMetadata(storefrontIpfs)
          .then(setMetadata)
          .finally(() => setIsLoadingMetadata(false));
      }
    }
  }, [sellerData]);

  let profile: SellerProfile | null = null;

  if (sellerData && sellerId) {
    const [owner, geohash, storefrontIpfs, offersDelivery, offersPickup, deliveryRadiusKm, createdAt, active] = sellerData as [
      string,
      string,
      string,
      boolean,
      boolean,
      bigint,
      bigint,
      boolean
    ];

    profile = {
      sellerId: sellerId,
      owner,
      geohash,
      storefrontIpfs,
      offersDelivery,
      offersPickup,
      deliveryRadiusKm: Number(deliveryRadiusKm),
      createdAt: new Date(Number(createdAt) * 1000),
      active,
      metadata,
    };
  }

  return {
    profile,
    isLoading: isLoadingStatus || isLoadingProfile || isLoadingMetadata,
    refetch,
  };
}
