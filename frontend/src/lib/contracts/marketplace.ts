import { type Address } from 'viem';

// Contract addresses on Base Sepolia
export const MARKETPLACE_ADDRESS: Address = '0x284cC27FAE9c48CDC679BDb03Ac1d3dE691EA802';
export const ROOTS_TOKEN_ADDRESS: Address = '0x538B068DE667bD22AebC8B3b759D011820ea9baF';
export const AMBASSADOR_REWARDS_ADDRESS: Address = '0x8a9b3539755e759Ac483B8613BF7F8F1c624CDcE';
export const FOUNDER_VESTING_ADDRESS: Address = '0x6bD420b5bafd93bb567D9E1bB143f1B6B72EC888';

// Minimal ABI with only the functions needed for seller UI
export const marketplaceAbi = [
  // Read functions
  {
    type: 'function',
    name: 'isSeller',
    inputs: [{ name: '_addr', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sellerIdByOwner',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sellers',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'geohash', type: 'bytes8' },
      { name: 'storefrontIpfs', type: 'string' },
      { name: 'offersDelivery', type: 'bool' },
      { name: 'offersPickup', type: 'bool' },
      { name: 'deliveryRadiusKm', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'listings',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'sellerId', type: 'uint256' },
      { name: 'metadataIpfs', type: 'string' },
      { name: 'pricePerUnit', type: 'uint256' },
      { name: 'quantityAvailable', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextListingId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'registerSeller',
    inputs: [
      { name: '_geohash', type: 'bytes8' },
      { name: '_storefrontIpfs', type: 'string' },
      { name: '_offersDelivery', type: 'bool' },
      { name: '_offersPickup', type: 'bool' },
      { name: '_deliveryRadiusKm', type: 'uint256' },
    ],
    outputs: [{ name: 'sellerId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createListing',
    inputs: [
      { name: '_metadataIpfs', type: 'string' },
      { name: '_pricePerUnit', type: 'uint256' },
      { name: '_quantityAvailable', type: 'uint256' },
    ],
    outputs: [{ name: 'listingId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateListing',
    inputs: [
      { name: '_listingId', type: 'uint256' },
      { name: '_metadataIpfs', type: 'string' },
      { name: '_pricePerUnit', type: 'uint256' },
      { name: '_quantityAvailable', type: 'uint256' },
      { name: '_active', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateSeller',
    inputs: [
      { name: '_storefrontIpfs', type: 'string' },
      { name: '_offersDelivery', type: 'bool' },
      { name: '_offersPickup', type: 'bool' },
      { name: '_deliveryRadiusKm', type: 'uint256' },
      { name: '_active', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'SellerRegistered',
    inputs: [
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'geohash', type: 'bytes8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ListingCreated',
    inputs: [
      { name: 'listingId', type: 'uint256', indexed: true },
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'pricePerUnit', type: 'uint256', indexed: false },
    ],
  },
] as const;
