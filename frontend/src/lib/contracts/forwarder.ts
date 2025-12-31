import { type Address } from 'viem';

// ERC2771Forwarder contract address on Base Sepolia (v4 deployment with USDC/USDT payment support)
export const FORWARDER_ADDRESS: Address = '0x24A316733D68A0a7B8917E347cF02ed45bE0E034';

// Allowed target contracts for gasless transactions
export const ALLOWED_TARGETS: Address[] = [
  '0xCF1a1B59e9867bf70a6dFb88159A78160E6B00D0', // LocalRootsMarketplace (v5)
  '0x9bB140264a3A7b9411F4dd74108481E780e1A55b', // AmbassadorRewards (v5)
];

// ERC2771Forwarder ABI (only the functions we need)
export const forwarderAbi = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'verify',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

// EIP-712 domain for the forwarder (matches ERC2771Forwarder constructor)
// Note: The domain name is set by the Forwarder constructor, which uses "LocalRootsForwarder"
export const forwarderDomain = {
  name: 'LocalRootsForwarder',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: FORWARDER_ADDRESS as `0x${string}`,
} as const;

// EIP-712 types for ForwardRequest
export const forwardRequestTypes = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint48' },
    { name: 'data', type: 'bytes' },
  ],
} as const;

// ForwardRequest type
export interface ForwardRequest {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: number;
  data: `0x${string}`;
}
