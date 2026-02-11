import type { Address } from 'viem';

// Contract addresses from .env.test
export const ROOTS_TOKEN_ADDRESS = (process.env.ROOTS_TOKEN_ADDRESS || '0x21952Cb029da00902EDA5c83a01825Ae2E645e03') as Address;
export const MARKETPLACE_ADDRESS = (process.env.MARKETPLACE_ADDRESS || '0xBAc288595e52AF2dDF560CEaEf90064463c08f0d') as Address;
export const AMBASSADOR_REWARDS_ADDRESS = (process.env.AMBASSADOR_REWARDS_ADDRESS || '0xC596B9FcCAC989abf4B4244EC8c74CF8d50DDB91') as Address;
export const FORWARDER_ADDRESS = (process.env.FORWARDER_ADDRESS || '0xd6632078F9ad1Fb03a9Babd2908cBA4D00D43F74') as Address;

// SeedsAirdrop address (will be set when deployed for Phase 2)
export const SEEDS_AIRDROP_ADDRESS = (process.env.SEEDS_AIRDROP_ADDRESS || '0x0000000000000000000000000000000000000000') as Address;

// Re-export ABIs from the app source
export { marketplaceAbi } from '../../../src/lib/contracts/marketplace';
export { ambassadorAbi } from '../../../src/lib/contracts/ambassador';
export { seedsAirdropAbi } from '../../../src/lib/contracts/seedsAirdrop';
export { forwarderAbi, forwarderDomain, forwardRequestTypes } from '../../../src/lib/contracts/forwarder';

// Alias exports for consistency across test files
export { ROOTS_TOKEN_ADDRESS as rootsTokenAddress };
export { MARKETPLACE_ADDRESS as marketplaceAddress };
export { AMBASSADOR_REWARDS_ADDRESS as ambassadorRewardsAddress };
export { FORWARDER_ADDRESS as forwarderAddress };

// ROOTS token ABI (alias for erc20Abi)
export const rootsTokenAbi = [
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

// ERC20 ABI with transfer (extended from the app's erc20Abi which only has approve/allowance/balanceOf)
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
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;
