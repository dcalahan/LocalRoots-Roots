import { http, createConfig, fallback } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { testWalletConnector, isTestWalletAvailable } from './testWalletConnector';

// Chains configuration - used by both wagmi and Privy
export const supportedChains = [baseSepolia, base] as const;

// RPC fallback chains — same pattern as viemClient.ts but for wagmi.
// Without these, client-side hooks like useWaitForTransactionReceipt poll
// the public Base RPC (mainnet.base.org), which rate-limits aggressively
// under load. Symptom: tx confirms on-chain but UI hangs on "Creating…"
// because the receipt poll silently fails. Doug hit this Apr 27 2026
// while creating a new listing — same root cause as the earlier
// useSellerStatus rate-limit bug, but on the wagmi/wallet layer.
//
// PRIMARY: env-configured paid RPC if set; otherwise public.
const primaryMainnetRpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://mainnet.base.org';
const primarySepoliaRpc = process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org';

const mainnetRpcs = [
  primaryMainnetRpc,
  'https://mainnet.base.org',
  'https://base.publicnode.com',
  'https://base-rpc.publicnode.com',
  'https://1rpc.io/base',
].filter((url, idx, arr) => arr.indexOf(url) === idx); // dedupe

const sepoliaRpcs = [
  primarySepoliaRpc,
  'https://sepolia.base.org',
  'https://base-sepolia-rpc.publicnode.com',
].filter((url, idx, arr) => arr.indexOf(url) === idx);

const httpOpts = {
  batch: false,
  retryCount: 2,
  retryDelay: 500,
  timeout: 10_000,
};

// WalletConnect Project ID
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Check if test wallet is available (only on testnet/dev)
const testWalletAvailable = isTestWalletAvailable();
if (testWalletAvailable) {
  console.log('[wagmi] Test wallet available: true');
}

// Create wagmi config with traditional connectors for external wallets
export const config = createConfig({
  chains: supportedChains,
  connectors: [
    // Test wallet for development/testing - pre-funded with testnet tokens
    ...(testWalletAvailable ? [testWalletConnector()] : []),
    // Injected wallets (browser extension wallets) - for external wallet users
    injected({
      shimDisconnect: true,
    }),
    // Coinbase/Base Wallet - for buyers
    coinbaseWallet({
      appName: 'Local Roots',
      preference: 'eoaOnly',
    }),
    // WalletConnect for mobile wallets - for buyers
    ...(walletConnectProjectId ? [
      walletConnect({
        projectId: walletConnectProjectId,
        metadata: {
          name: 'Local Roots',
          description: 'Your gardening companion — grow food, share with neighbors',
          url: 'https://www.localroots.love',
          icons: ['https://www.localroots.love/icon.png'],
        },
        showQrModal: true,
      }),
    ] : []),
  ],
  transports: {
    [baseSepolia.id]: fallback(
      sepoliaRpcs.map((url) => http(url, httpOpts)),
      { rank: { interval: 60_000 }, retryCount: 1 },
    ),
    [base.id]: fallback(
      mainnetRpcs.map((url) => http(url, httpOpts)),
      { rank: { interval: 60_000 }, retryCount: 1 },
    ),
  },
  ssr: true,
});

// Contract addresses
export const contracts = {
  rootsToken: {
    address: process.env.NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS as `0x${string}` | undefined,
  },
  marketplace: {
    address: process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS as `0x${string}` | undefined,
  },
  ambassadorRewards: {
    address: process.env.NEXT_PUBLIC_AMBASSADOR_REWARDS_ADDRESS as `0x${string}` | undefined,
  },
};
