import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  metaMaskWallet,
} from '@rainbow-me/rainbowkit/wallets';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [coinbaseWallet, metaMaskWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  {
    appName: 'Local Roots',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo',
  }
);

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
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
