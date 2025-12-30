import { type Address } from 'viem';

// ERC2771Forwarder contract address on Base Sepolia
export const FORWARDER_ADDRESS: Address = '0x9e80a34E1aBDDC50ca2928b688b43C821FE1C2bc';

// Allowed target contracts for gasless transactions
export const ALLOWED_TARGETS: Address[] = [
  '0xfC6Fdf32587F433d9638c4dC84e3A4Be2B3C8a77', // LocalRootsMarketplace
  '0x6838063D4A7fBdDc62E3886e6306e3076267c29d', // AmbassadorRewards
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

// EIP-712 domain for the forwarder
export const forwarderDomain = {
  name: 'LocalRootsForwarder',
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
