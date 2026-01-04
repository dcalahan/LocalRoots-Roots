import { type Address } from 'viem';
import { MARKETPLACE_ADDRESS, AMBASSADOR_REWARDS_ADDRESS } from './marketplace';

// ERC2771Forwarder contract address on Base Sepolia - loaded from environment variable
export const FORWARDER_ADDRESS: Address = (process.env.NEXT_PUBLIC_FORWARDER_ADDRESS || '0x63e7eb99daE531227dD690A031eAD1d8d5BeAc54') as Address;

// Allowed target contracts for gasless transactions (dynamically uses current addresses)
export const ALLOWED_TARGETS: Address[] = [
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
];

// ERC2771Forwarder ABI (only the functions we need)
// Note: OpenZeppelin's ForwardRequestData struct has signature INSIDE the struct,
// and nonce is NOT in the struct (it's retrieved from Nonces contract internally)
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
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
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
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
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
// Note: Not using 'as const' to ensure compatibility with Privy's signTypedData
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
};

// ForwardRequest type (for EIP-712 signing - includes nonce)
export interface ForwardRequest {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: number;
  data: `0x${string}`;
}

// ForwardRequestData type (for contract calls - has signature, no nonce)
export interface ForwardRequestData {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  deadline: number;
  data: `0x${string}`;
  signature: `0x${string}`;
}
