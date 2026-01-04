import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { testWalletConnector, isTestWalletAvailable } from './testWalletConnector';

// Chains configuration - used by both wagmi and Privy
export const supportedChains = [baseSepolia, base] as const;

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
          description: 'Neighbors Feeding Neighbors - Local produce marketplace',
          url: 'https://localroots.app',
          icons: ['https://localroots.app/icon.png'],
        },
        showQrModal: true,
      }),
    ] : []),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
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
