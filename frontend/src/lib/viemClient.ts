import { createPublicClient, http } from 'viem';
import { ACTIVE_CHAIN, RPC_URL, IS_MAINNET } from './chainConfig';

// Use explicit RPC URL from chainConfig to ensure consistent data
// Prefer NEXT_PUBLIC_RPC_URL (via chainConfig) — fall back to public node on testnet
const rpcUrl =
  RPC_URL ||
  (IS_MAINNET
    ? 'https://base.publicnode.com'
    : 'https://base-sepolia-rpc.publicnode.com');

// Export the RPC URL for other uses
export const baseSepoliaRpcUrl = rpcUrl;
export const activeRpcUrl = rpcUrl;

// Create a fresh public client for each use to avoid any caching
export function createFreshPublicClient() {
  return createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(rpcUrl, {
      batch: false,
      retryCount: 3,
      retryDelay: 1000,
    }),
    cacheTime: 0,
  });
}

// For backwards compatibility - but prefer createFreshPublicClient() for fetches
export const publicClient = createFreshPublicClient();
