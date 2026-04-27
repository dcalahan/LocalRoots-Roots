import { createPublicClient, createWalletClient, fallback, http, type Account } from 'viem';
import { ACTIVE_CHAIN, RPC_URL, IS_MAINNET } from './chainConfig';

// PRIMARY: env-configured RPC (set NEXT_PUBLIC_RPC_URL to an Alchemy / QuickNode /
// Coinbase Cloud endpoint for production reliability). When unset, falls back
// through public endpoints — but this breaks under load on mainnet because
// public RPCs aggressively rate-limit. Doug hit this Apr 26 2026: every
// useSellerStatus page load was failing silently, dashboard showed
// "Not Registered" even though on-chain data confirmed registration.
const primaryRpcUrl = RPC_URL ||
  (IS_MAINNET ? 'https://mainnet.base.org' : 'https://sepolia.base.org');

// FALLBACKS: tried in order if primary fails (rate limit, timeout, etc).
// viem's fallback() transport rotates through these on errors.
const fallbackRpcUrls = IS_MAINNET
  ? [
      'https://mainnet.base.org',
      'https://base.publicnode.com',
      'https://base-rpc.publicnode.com',
      'https://1rpc.io/base',
    ]
  : [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
    ];

// Build fallback chain — primary first, then dedupe and add the public list.
const allRpcUrls = [primaryRpcUrl, ...fallbackRpcUrls].filter(
  (url, idx, arr) => arr.indexOf(url) === idx,
);

// Export the primary URL for backward-compat consumers
export const baseSepoliaRpcUrl = primaryRpcUrl;
export const activeRpcUrl = primaryRpcUrl;

// Create a fresh public client for each use to avoid any caching.
// Uses viem's fallback() transport: if the first RPC rate-limits or
// errors, it auto-rotates to the next one. Three RPCs deep gives us
// resilience even when public Base nodes are throttling.
export function createFreshPublicClient() {
  const transports = allRpcUrls.map((url) =>
    http(url, {
      batch: false,
      retryCount: 2,       // retry transient errors twice per RPC
      retryDelay: 500,     // 500ms between retries
      timeout: 10_000,     // 10s timeout before failing over
    }),
  );

  return createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: fallback(transports, {
      // Rank: re-evaluate which RPC is fastest periodically
      rank: { interval: 60_000 },
      // Retry the next transport on any error (rate limit, timeout, etc.)
      retryCount: 1,
    }),
    cacheTime: 0,
  });
}

// For backwards compatibility - but prefer createFreshPublicClient() for fetches
export const publicClient = createFreshPublicClient();

/**
 * Wallet client with the same fallback() RPC chain as the read client.
 *
 * Used by server-side routes that BROADCAST transactions (relay, faucet).
 * Writes via single-RPC http() are vulnerable to the same rate-limit hang
 * as reads — the sender's broadcast succeeds, but waitForTransactionReceipt
 * polls the same RPC and stalls.
 *
 * Pass an Account; the chain + transports come from the shared config so
 * adding a new RPC URL updates every layer (read, write, wagmi).
 */
export function createFreshWalletClient(account: Account) {
  const transports = allRpcUrls.map((url) =>
    http(url, {
      batch: false,
      retryCount: 2,
      retryDelay: 500,
      timeout: 10_000,
    }),
  );

  return createWalletClient({
    account,
    chain: ACTIVE_CHAIN,
    transport: fallback(transports, {
      rank: { interval: 60_000 },
      retryCount: 1,
    }),
  });
}
