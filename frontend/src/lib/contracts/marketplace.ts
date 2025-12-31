import { type Address } from 'viem';

// Contract addresses on Base Sepolia (v5 deployment - redeployed with correct ambassador)
export const MARKETPLACE_ADDRESS: Address = '0xCF1a1B59e9867bf70a6dFb88159A78160E6B00D0';
export const ROOTS_TOKEN_ADDRESS: Address = '0xffDAa58B1EB72c81ba8B728880b18A8E52409Ac7';
export const AMBASSADOR_REWARDS_ADDRESS: Address = '0x9bB140264a3A7b9411F4dd74108481E780e1A55b';
export const FOUNDER_VESTING_ADDRESS: Address = '0x98111962d809B4AA056a549012Efe16156B79DC5';
export const FORWARDER_ADDRESS: Address = '0x24A316733D68A0a7B8917E347cF02ed45bE0E034';

// Payment token addresses (Mock tokens for testnet)
export const USDC_ADDRESS: Address = '0x46d25975B3C6894Bab136416520b642B7F6BE8E7';
export const USDT_ADDRESS: Address = '0xC124130852Fa56634D1DC7ee8A0dF288DFcF70A8';
export const SWAP_ROUTER_ADDRESS: Address = '0xa49BA7c5444D4CCce5cc44aBd9b2dfb9CADf758f';

// Payment token types and configuration
export type PaymentToken = 'ROOTS' | 'USDC' | 'USDT';

export const PAYMENT_TOKENS: Record<PaymentToken, { address: Address; decimals: number; symbol: string }> = {
  ROOTS: { address: ROOTS_TOKEN_ADDRESS, decimals: 18, symbol: 'ROOTS' },
  USDC: { address: USDC_ADDRESS, decimals: 6, symbol: 'USDC' },
  USDT: { address: USDT_ADDRESS, decimals: 6, symbol: 'USDT' },
};

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
      { name: '_ambassadorId', type: 'uint256' },
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
  // Payment token functions
  {
    type: 'function',
    name: 'getStablecoinPrice',
    inputs: [{ name: 'rootsAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'acceptedPaymentTokens',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAcceptedPaymentTokens',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
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
      { name: '_paymentToken', type: 'address' },
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
  // Admin read functions
  {
    type: 'function',
    name: 'isAdmin',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'admins',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAdmins',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sellerSuspended',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isSellerSuspended',
    inputs: [{ name: '_sellerId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  // Admin write functions
  {
    type: 'function',
    name: 'addAdmin',
    inputs: [{ name: '_newAdmin', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeAdmin',
    inputs: [{ name: '_admin', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'suspendSeller',
    inputs: [
      { name: '_sellerId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unsuspendSeller',
    inputs: [{ name: '_sellerId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'adminCancelOrder',
    inputs: [
      { name: '_orderId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Admin events
  {
    type: 'event',
    name: 'AdminAdded',
    inputs: [
      { name: 'admin', type: 'address', indexed: true },
      { name: 'addedBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AdminRemoved',
    inputs: [
      { name: 'admin', type: 'address', indexed: true },
      { name: 'removedBy', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'SellerSuspended',
    inputs: [
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'admin', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SellerUnsuspended',
    inputs: [
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'admin', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'OrderCancelledByAdmin',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'admin', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

// ERC20 ABI for token approval and balance checking
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
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const;

// Mock token ABI for minting test stablecoins (testnet only)
export const mockErc20Abi = [
  ...erc20Abi,
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ============ Pricing Utilities ============

// Exchange rate: 100 ROOTS = $1 USD
export const ROOTS_PER_USD = 100n;
export const ROOTS_DECIMALS = 18n;
export const STABLECOIN_DECIMALS = 6n;

/**
 * Convert ROOTS amount to stablecoin amount (USDC/USDT)
 * @param rootsAmount Amount in ROOTS (18 decimals)
 * @returns Amount in stablecoins (6 decimals)
 */
export function rootsToStablecoin(rootsAmount: bigint): bigint {
  // 100 ROOTS (100e18) = 1 USDC (1e6)
  // rootsAmount / 100 / 1e12 = stablecoinAmount
  return rootsAmount / ROOTS_PER_USD / 10n ** (ROOTS_DECIMALS - STABLECOIN_DECIMALS);
}

/**
 * Convert stablecoin amount to ROOTS amount
 * @param stablecoinAmount Amount in stablecoins (6 decimals)
 * @returns Amount in ROOTS (18 decimals)
 */
export function stablecoinToRoots(stablecoinAmount: bigint): bigint {
  // 1 USDC (1e6) = 100 ROOTS (100e18)
  // stablecoinAmount * 100 * 1e12 = rootsAmount
  return stablecoinAmount * ROOTS_PER_USD * 10n ** (ROOTS_DECIMALS - STABLECOIN_DECIMALS);
}

/**
 * Format ROOTS amount to USD display value
 * @param rootsAmount Amount in ROOTS (18 decimals)
 * @returns Formatted USD string (e.g., "$1.50")
 */
export function formatRootsAsUsd(rootsAmount: bigint): string {
  const stablecoinAmount = rootsToStablecoin(rootsAmount);
  const usdValue = Number(stablecoinAmount) / 1e6;
  return `$${usdValue.toFixed(2)}`;
}

/**
 * Get the payment token address for a given token type
 * Returns address(0) for ROOTS (native payment)
 */
export function getPaymentTokenAddress(token: PaymentToken): Address {
  if (token === 'ROOTS') {
    return '0x0000000000000000000000000000000000000000' as Address;
  }
  return PAYMENT_TOKENS[token].address;
}
