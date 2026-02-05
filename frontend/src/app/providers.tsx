'use client';

// Polyfill must be imported first
import '@/lib/polyfills';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { config, supportedChains } from '@/lib/wagmi';
import { CartProvider } from '@/contexts/CartContext';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { DemoModeProvider } from '@/contexts/DemoModeContext';
import { useState } from 'react';
import { useWalletRedirect } from '@/hooks/useWalletRedirect';
import { baseSepolia } from 'viem/chains';

// Component that uses the wallet redirect hook
function WalletRedirectHandler({ children }: { children: React.ReactNode }) {
  useWalletRedirect();
  return <>{children}</>;
}

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Create embedded wallets for users who sign in with email/phone/social
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        // Default chain for the app
        defaultChain: baseSepolia,
        // Supported chains
        supportedChains: supportedChains as any,
        // Appearance customization
        appearance: {
          theme: 'light',
          accentColor: '#EB6851', // roots-primary coral/orange
          logo: 'https://ipfs.io/ipfs/Qmek6d4AUdvUqhmSoLg5m2U9SAKHdKuDLb9eW9kE7SEQQX',
        },
        // Login methods - social options first for non-crypto-native users
        loginMethods: ['google', 'apple', 'instagram', 'email', 'sms'],
        // Wallet connect project ID for external wallets
        walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <DemoModeProvider>
            <WalletRedirectHandler>
              <UserPreferencesProvider>
                <CartProvider>
                  {children}
                </CartProvider>
              </UserPreferencesProvider>
            </WalletRedirectHandler>
          </DemoModeProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
