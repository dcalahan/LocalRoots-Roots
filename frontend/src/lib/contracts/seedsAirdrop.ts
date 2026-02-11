import { type Address } from 'viem';

// Contract address - will be set when deployed (Phase 2 launch)
// Until then, fallback to zero address
export const SEEDS_AIRDROP_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_SEEDS_AIRDROP_ADDRESS ||
  '0x0000000000000000000000000000000000000000'
) as Address;

// ABI for SeedsAirdrop contract functions
export const seedsAirdropAbi = [
  // Read functions
  {
    type: 'function',
    name: 'rootsToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'merkleRoot',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimDeadline',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasClaimed',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canClaim',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_proof', type: 'bytes32[]' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'timeUntilDeadline',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'claimPeriodEnded',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_proof', type: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setMerkleRoot',
    inputs: [{ name: '_root', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferAdmin',
    inputs: [{ name: '_newAdmin', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'recoverUnclaimed',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MerkleRootSet',
    inputs: [{ name: 'root', type: 'bytes32', indexed: false }],
  },
  {
    type: 'event',
    name: 'AdminTransferred',
    inputs: [
      { name: 'previousAdmin', type: 'address', indexed: true },
      { name: 'newAdmin', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'UnclaimedRecovered',
    inputs: [
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Type for airdrop claim info
export interface AirdropClaimInfo {
  address: string;
  seedsEarned: string;      // Seeds earned (raw bigint as string)
  rootsAmount: string;      // ROOTS to receive (raw bigint as string)
  proof: `0x${string}`[];   // Merkle proof
}

// Type for airdrop status
export interface AirdropStatus {
  merkleRoot: `0x${string}`;
  claimDeadline: bigint;
  timeUntilDeadline: bigint;
  claimPeriodEnded: boolean;
  availableBalance: bigint;
}
