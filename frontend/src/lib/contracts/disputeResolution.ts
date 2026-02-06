import { type Address } from 'viem';

// Contract address on Base Sepolia - loaded from environment variable
export const DISPUTE_RESOLUTION_ADDRESS: Address = (process.env.NEXT_PUBLIC_DISPUTE_RESOLUTION_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

// ABI for dispute resolution functions
export const disputeResolutionAbi = [
  // Read functions
  {
    type: 'function',
    name: 'getDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'orderId', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'sellerId', type: 'uint256' },
          { name: 'buyerReason', type: 'string' },
          { name: 'buyerEvidenceIpfs', type: 'string' },
          { name: 'sellerResponse', type: 'string' },
          { name: 'sellerEvidenceIpfs', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'votingEndsAt', type: 'uint256' },
          { name: 'votesForBuyer', type: 'uint256' },
          { name: 'votesForSeller', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'buyerWon', type: 'bool' },
          { name: 'extended', type: 'bool' },
          { name: 'adminResolved', type: 'bool' },
          { name: 'adminReason', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDisputeByOrder',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'orderId', type: 'uint256' },
          { name: 'buyer', type: 'address' },
          { name: 'sellerId', type: 'uint256' },
          { name: 'buyerReason', type: 'string' },
          { name: 'buyerEvidenceIpfs', type: 'string' },
          { name: 'sellerResponse', type: 'string' },
          { name: 'sellerEvidenceIpfs', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'votingEndsAt', type: 'uint256' },
          { name: 'votesForBuyer', type: 'uint256' },
          { name: 'votesForSeller', type: 'uint256' },
          { name: 'resolved', type: 'bool' },
          { name: 'buyerWon', type: 'bool' },
          { name: 'extended', type: 'bool' },
          { name: 'adminResolved', type: 'bool' },
          { name: 'adminReason', type: 'string' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getOpenDisputes',
    inputs: [],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'ambassadorId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getUserStrikes',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'sellerStrikes', type: 'uint256' },
          { name: 'buyerStrikes', type: 'uint256' },
          { name: 'lastStrikeAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getQualifiedVoterCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextDisputeId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'orderToDispute',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Constants
  {
    type: 'function',
    name: 'VOTE_DURATION',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'VOTE_EXTENSION',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MIN_VOTES_REQUIRED',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SEEDS_PER_VOTE',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SEEDS_MAJORITY_BONUS',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'submitSellerResponse',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'response', type: 'string' },
      { name: 'evidenceIpfs', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'vote',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'voteForBuyer', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveDispute',
    inputs: [{ name: 'disputeId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'adminResolveDispute',
    inputs: [
      { name: 'disputeId', type: 'uint256' },
      { name: 'buyerWins', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'DisputeOpened',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'sellerId', type: 'uint256', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SellerResponseSubmitted',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'response', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeVoteCast',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'ambassadorId', type: 'uint256', indexed: true },
      { name: 'votedForBuyer', type: 'bool', indexed: false },
      { name: 'seedsEarned', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'buyerWon', type: 'bool', indexed: false },
      { name: 'totalVotes', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeAdminResolved',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'buyerWon', type: 'bool', indexed: false },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeExtended',
    inputs: [
      { name: 'disputeId', type: 'uint256', indexed: true },
      { name: 'newVotingEndsAt', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'StrikeAdded',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'isSeller', type: 'bool', indexed: false },
      { name: 'totalStrikes', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SellerAutoSuspended',
    inputs: [
      { name: 'sellerId', type: 'uint256', indexed: true },
      { name: 'strikeCount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Dispute type for frontend use
export interface Dispute {
  orderId: bigint;
  buyer: Address;
  sellerId: bigint;
  buyerReason: string;
  buyerEvidenceIpfs: string;
  sellerResponse: string;
  sellerEvidenceIpfs: string;
  createdAt: bigint;
  votingEndsAt: bigint;
  votesForBuyer: bigint;
  votesForSeller: bigint;
  resolved: boolean;
  buyerWon: boolean;
  extended: boolean;
  adminResolved: boolean;
  adminReason: string;
}

export interface UserStrikes {
  sellerStrikes: bigint;
  buyerStrikes: bigint;
  lastStrikeAt: bigint;
}
