import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

// Use explicit RPC URL to ensure consistent data
// Try alternative RPC endpoints if the default has caching issues
const rpcUrl = process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://base-sepolia-rpc.publicnode.com';

// Export the RPC URL for other uses
export const baseSepoliaRpcUrl = rpcUrl;

// Create a fresh public client for each use to avoid any caching
// This ensures we always get the latest blockchain state
export function createFreshPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
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
