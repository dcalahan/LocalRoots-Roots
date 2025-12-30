import { type Address } from 'viem';

// Contract addresses on Base Sepolia
export const MARKETPLACE_ADDRESS: Address = '0xe132403fB9998CdDe2E6Cf3eef3B55617ffe16aA';
export const ROOTS_TOKEN_ADDRESS: Address = '0x509dd8D46E66C6B6591c111551C6E6039941E63C';
export const AMBASSADOR_REWARDS_ADDRESS: Address = '0x15B1b3b0f08d518005a36B8F41eaC7B6F3Ac8B22';
export const FOUNDER_VESTING_ADDRESS: Address = '0xFf9Ca7c9A3511D73E10aC58F72022Ab359854249';

// ABI with seller and buyer functions
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
  // Seller order management functions
  {
    type: 'function',
    name: 'markReadyForPickup',
    inputs: [
      { name: '_orderId', type: 'uint256' },
      { name: '_proofIpfs', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'markOutForDelivery',
    inputs: [
      { name: '_orderId', type: 'uint256' },
      { name: '_proofIpfs', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptOrder',
    inputs: [{ name: '_orderId', type: 'uint256' }],
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
  // Buyer read functions
  {
    type: 'function',
    name: 'nextSellerId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextOrderId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'orders',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'sellerId', type: 'uint256' },
      { name: 'buyer', type: 'address' },
      { name: 'quantity', type: 'uint256' },
      { name: 'totalPrice', type: 'uint256' },
      { name: 'isDelivery', type: 'bool' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'completedAt', type: 'uint256' },
      { name: 'rewardQueued', type: 'bool' },
      { name: 'proofIpfs', type: 'string' },
      { name: 'proofUploadedAt', type: 'uint256' },
      { name: 'fundsReleased', type: 'bool' },
      { name: 'buyerInfoIpfs', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sellersByGeohash',
    inputs: [
      { name: '_geohashPrefix', type: 'bytes8' },
      { name: '_index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellerCountByGeohash',
    inputs: [{ name: '_geohashPrefix', type: 'bytes8' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DISPUTE_WINDOW',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Buyer write functions
  {
    type: 'function',
    name: 'purchase',
    inputs: [
      { name: '_listingId', type: 'uint256' },
      { name: '_quantity', type: 'uint256' },
      { name: '_isDelivery', type: 'bool' },
      { name: '_buyerInfoIpfs', type: 'string' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'completeOrder',
    inputs: [{ name: '_orderId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'raiseDispute',
    inputs: [{ name: '_orderId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Buyer events
  {
    type: 'event',
    name: 'OrderPlaced',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'listingId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'quantity', type: 'uint256', indexed: false },
      { name: 'totalPrice', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OrderStatusChanged',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsReleased',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'seller', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// ERC20 ABI for ROOTS token approval
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
] as const;
