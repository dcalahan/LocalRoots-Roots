import { type Address } from 'viem';

// Contract address on Base Sepolia - loaded from environment variable (Feb 7 2026 deployment with adminUnsuspendAmbassador)
export const AMBASSADOR_REWARDS_ADDRESS: Address = (process.env.NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS || '0x4C5c8765b1a5fbed6fAf2Bd9F1adBee587d92154') as Address;

// ABI for ambassador functions
export const ambassadorAbi = [
  // Read functions
  {
    type: 'function',
    name: 'ambassadorIdByWallet',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ambassadors',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'wallet', type: 'address' },
      { name: 'uplineId', type: 'uint256' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalPending', type: 'uint256' },
      { name: 'recruitedSellers', type: 'uint256' },
      { name: 'recruitedAmbassadors', type: 'uint256' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'suspended', type: 'bool' },
      { name: 'regionGeohash', type: 'bytes8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextAmbassadorId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmbassador',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'wallet', type: 'address' },
          { name: 'uplineId', type: 'uint256' },
          { name: 'totalEarned', type: 'uint256' },
          { name: 'totalPending', type: 'uint256' },
          { name: 'recruitedSellers', type: 'uint256' },
          { name: 'recruitedAmbassadors', type: 'uint256' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
          { name: 'suspended', type: 'bool' },
          { name: 'regionGeohash', type: 'bytes8' },
          { name: 'profileIpfs', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmbassadorId',
    inputs: [{ name: '_wallet', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAmbassadorActive',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getClaimableRewards',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmbassadorChain',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // Seller activation functions
  {
    type: 'function',
    name: 'isSellerActivated',
    inputs: [{ name: '_sellerId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellerRecruitment',
    inputs: [{ name: '_sellerId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'ambassadorId', type: 'uint256' },
          { name: 'recruitedAt', type: 'uint256' },
          { name: 'totalSalesVolume', type: 'uint256' },
          { name: 'totalRewardsPaid', type: 'uint256' },
          { name: 'completedOrderCount', type: 'uint256' },
          { name: 'uniqueBuyerCount', type: 'uint256' },
          { name: 'activated', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'registerAmbassador',
    inputs: [
      { name: '_uplineId', type: 'uint256' },
      { name: '_profileIpfs', type: 'string' },
    ],
    outputs: [{ name: 'ambassadorId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'updateProfile',
    inputs: [{ name: '_profileIpfs', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimVestedRewards',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'AmbassadorRegistered',
    inputs: [
      { name: 'ambassadorId', type: 'uint256', indexed: true },
      { name: 'wallet', type: 'address', indexed: true },
      { name: 'uplineId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'SellerRecruited',
    inputs: [
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'ambassadorId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'RewardClaimed',
    inputs: [
      { name: 'pendingRewardId', type: 'uint256', indexed: true },
      { name: 'ambassadorId', type: 'uint256', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  // Admin read functions
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
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
    name: 'isAdminMap',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAdmins',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
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
    name: 'adminSuspendAmbassador',
    inputs: [
      { name: '_ambassadorId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'adminUnsuspendAmbassador',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
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
    name: 'AmbassadorSuspendedByAdmin',
    inputs: [
      { name: 'ambassadorId', type: 'uint256', indexed: true },
      { name: 'admin', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AmbassadorSuspended',
    inputs: [{ name: 'ambassadorId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'AmbassadorUnsuspended',
    inputs: [{ name: 'ambassadorId', type: 'uint256', indexed: true }],
  },
] as const;

// Ambassador type for frontend use
export interface Ambassador {
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
}

// Ambassador profile metadata (stored in IPFS)
export interface AmbassadorProfile {
  name: string;
  bio?: string;
  email?: string;
  imageUrl?: string;
  createdAt: string;
  // Payment preferences (TEMPORARY - until $ROOTS launch)
  paymentMethod?: 'venmo' | 'paypal' | 'zelle';
  paymentHandle?: string; // @username for Venmo, email for PayPal/Zelle
}

// Payment record (stored in Vercel KV) - TEMPORARY until $ROOTS launch
export interface PaymentRecord {
  id: string;                   // payment:{ambassadorId}:{timestamp}
  ambassadorId: string;
  amount: number;               // USD cents
  method: 'venmo' | 'paypal' | 'zelle';
  transactionId?: string;       // Venmo transaction ID, etc.
  note?: string;                // "January 2026 commission"
  paidAt: number;               // Unix timestamp (seconds)
  paidBy: string;               // Admin wallet address
}

// Payment summary (stored in Vercel KV) - TEMPORARY until $ROOTS launch
export interface PaymentSummary {
  ambassadorId: string;
  totalPaid: number;            // USD cents - sum of payment records
  lastPaidAt?: number;          // Most recent payment timestamp
  lastPaymentAmount?: number;   // Most recent payment amount in cents
}
