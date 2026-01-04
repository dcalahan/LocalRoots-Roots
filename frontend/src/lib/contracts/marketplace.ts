import { type Address } from 'viem';

// Contract addresses - loaded from environment variables
export const MARKETPLACE_ADDRESS: Address = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || '0xEe6eCF5A36925C4D95097ffa2F40632bf500a0F8') as Address;
export const ROOTS_TOKEN_ADDRESS: Address = (process.env.NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS || '0x33eFBF74Df84193Ce39dfF91394d9A0fE20c36c3') as Address;
export const AMBASSADOR_REWARDS_ADDRESS: Address = (process.env.NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS || '0x13C20235BD86635627573e3027b6112a28dCfe3E') as Address;
export const FORWARDER_ADDRESS: Address = (process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || '0x63e7eb99daE531227dD690A031eAD1d8d5BeAc54') as Address;

// Payment token addresses (Mock tokens for testnet) - Jan 2 fresh deployment
export const USDC_ADDRESS: Address = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x1638264e592C58327fb3Fe7D74509d1Ca7c86F1d') as Address;
export const USDT_ADDRESS: Address = (process.env.NEXT_PUBLIC_USDT_ADDRESS || '0x3c69B46E4Ab4141F0089a5289dBC20f33A36981b') as Address;
export const SWAP_ROUTER_ADDRESS: Address = (process.env.NEXT_PUBLIC_SWAP_ROUTER_ADDRESS || '0x6e75366f3bda38C6Ba83082Ea94d0dC14345F772') as Address;

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
