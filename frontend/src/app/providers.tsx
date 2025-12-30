'use client';

// Polyfill must be imported first
import '@/lib/polyfills';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/wagmi';
import { CartProvider } from '@/contexts/CartContext';
import { UserPreferencesProvider } from '@/contexts/UserPreferencesContext';
import { DemoModeProvider } from '@/contexts/DemoModeContext';
import { useState } from 'react';
import { useWalletRedirect } from '@/hooks/useWalletRedirect';

// Component that uses the wallet redirect hook
function WalletRedirectHandler({ children }: { children: React.ReactNode }) {
  useWalletRedirect();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <DemoModeProvider>
          <WalletRedirectHandler>
            <UserPreferencesProvider>
              <CartProvider>
                {children}
              </CartProvider>
            </UserPreferencesProvider>
          </WalletRedirectHandler>
        </DemoModeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
