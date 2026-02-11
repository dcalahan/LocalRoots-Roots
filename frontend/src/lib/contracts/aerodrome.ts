import { type Address } from 'viem';

/**
 * Aerodrome DEX Contract Definitions
 *
 * Aerodrome is the central trading and liquidity marketplace on Base.
 * Documentation: https://aerodrome.finance
 *
 * NOTE: Swap functionality is disabled until ROOTS/USDC liquidity pool is created post-launch.
 */

// Aerodrome Router on Base Mainnet
// Source: https://basescan.org/address/0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43
export const AERODROME_ROUTER_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_AERODROME_ROUTER_ADDRESS ||
  '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43'
) as Address;

// Aerodrome Factory on Base Mainnet (for pool lookups)
export const AERODROME_FACTORY_ADDRESS: Address = (
  process.env.NEXT_PUBLIC_AERODROME_FACTORY_ADDRESS ||
  '0x420DD381b31aEf6683db6B902084cB0FFECe40Da'
) as Address;

/**
 * Route struct for Aerodrome swaps
 * Aerodrome uses a routes array to specify the path through pools
 */
export interface AerodromeRoute {
  from: Address;      // Token to swap from
  to: Address;        // Token to swap to
  stable: boolean;    // true for stable pools (like USDC/USDT), false for volatile (like ROOTS/USDC)
  factory: Address;   // Factory address (use AERODROME_FACTORY_ADDRESS)
}

/**
 * Aerodrome Router ABI (minimal - only functions needed for swapping)
 * Full ABI: https://github.com/aerodrome-finance/contracts/blob/main/contracts/Router.sol
 */
export const aerodromeRouterAbi = [
  // Get quote for swap output
  {
    name: 'getAmountsOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  // Swap exact tokens for tokens
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  // Swap exact ETH for tokens
  {
    name: 'swapExactETHForTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  // Swap exact tokens for ETH
  {
    name: 'swapExactTokensForETH',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

/**
 * Aerodrome Factory ABI (for checking if pool exists)
 */
export const aerodromeFactoryAbi = [
  // Get pool address for a token pair
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'stable', type: 'bool' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

/**
 * Default slippage tolerance for swaps (0.5%)
 */
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.5% = 50 basis points

/**
 * Calculate minimum output amount with slippage protection
 */
export function calculateMinOutput(
  expectedOutput: bigint,
  slippageBps: number = DEFAULT_SLIPPAGE_BPS
): bigint {
  // minOutput = expectedOutput * (10000 - slippageBps) / 10000
  return (expectedOutput * BigInt(10000 - slippageBps)) / 10000n;
}

/**
 * Get deadline timestamp (default: 20 minutes from now)
 */
export function getSwapDeadline(minutesFromNow: number = 20): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutesFromNow * 60);
}
