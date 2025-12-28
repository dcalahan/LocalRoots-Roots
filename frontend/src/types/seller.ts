import { type Address, type Hex } from 'viem';

/**
 * On-chain seller data from the smart contract
 */
export interface Seller {
  id: bigint;
  owner: Address;
  geohash: Hex; // bytes8
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: bigint;
  createdAt: bigint;
  active: boolean;
}

/**
 * Storefront metadata stored on IPFS
 */
export interface StorefrontMetadata {
  name: string;
  description: string;
  profileImage?: string; // IPFS hash
  coverImage?: string; // IPFS hash
  location?: {
    city?: string;
    state?: string;
    displayName?: string;
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  social?: {
    website?: string;
    instagram?: string;
    facebook?: string;
  };
  createdAt: string; // ISO date
  updatedAt?: string; // ISO date
}

/**
 * Form data for seller registration
 */
export interface SellerRegistrationForm {
  // Basic info
  name: string;
  description: string;

  // Location
  latitude: number;
  longitude: number;
  locationDisplayName?: string;

  // Delivery options
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;

  // Images
  profileImage?: File;
}

/**
 * Combined seller data (on-chain + IPFS metadata)
 */
export interface SellerWithMetadata extends Seller {
  metadata?: StorefrontMetadata;
}
