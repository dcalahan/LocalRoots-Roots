import { type Address } from 'viem';

// ERC2771Forwarder contract address on Base Sepolia (1B token deployment)
export const FORWARDER_ADDRESS: Address = '0x76110d5cDA036dA56E78B6812180772a2D494793';

// Allowed target contracts for gasless transactions
export const ALLOWED_TARGETS: Address[] = [
  '0xdDfFdBed78D85F5a4910943f5FB6cF9d21a8c800', // LocalRootsMarketplace
  '0xEAFCc936fB1794635eE580Dc9A580fF488762f43', // AmbassadorRewards
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
export const forwarderDomain = {
  name: 'ERC2771Forwarder',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: FORWARDER_ADDRESS,
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
