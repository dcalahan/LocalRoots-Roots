import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { testWalletConnector, isTestWalletAvailable } from './testWalletConnector';

// WalletConnect Project ID - get one free at https://cloud.walletconnect.com/
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    // Injected wallets (MetaMask extension, etc.)
    injected({
      shimDisconnect: true,
    }),
    // Coinbase/Base Wallet - native app only, no web flow
    coinbaseWallet({
      appName: 'Local Roots',
      preference: 'eoaOnly', // Only connect to native wallet app, never coinbase.com
    }),
    // WalletConnect for mobile wallets (MetaMask, Trust, etc.)
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
    // Test wallet for development (only if private key is configured)
    ...(isTestWalletAvailable() ? [testWalletConnector()] : []),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});

// Contract addresses (update after deployment)
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
