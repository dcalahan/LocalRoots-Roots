'use client';

import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { BuyerWalletModal } from './BuyerWalletModal';

/**
 * UnifiedWalletButton - Single wallet button for the entire app
 *
 * Priority:
 * 1. If authenticated via Privy → Show Privy embedded wallet
 * 2. Else if connected via wagmi → Show wagmi wallet (external wallets)
 * 3. Else → Show login/connect options
 */
export function UnifiedWalletButton() {
  const { authenticated, login, logout, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [showBuyerModal, setShowBuyerModal] = useState(false);

  // Get Privy embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = embeddedWallet?.address;

  // Determine which wallet to show (Privy takes priority)
  const isPrivyUser = authenticated && privyReady;
  const displayAddress = isPrivyUser ? privyAddress : (wagmiConnected ? wagmiAddress : null);
  const isConnected = isPrivyUser || wagmiConnected;

  // Loading state
  if (!privyReady) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="text-xs md:text-sm px-2 md:px-4"
      >
        Loading...
      </Button>
    );
  }

  // Connected state - show wallet address and disconnect
  if (isConnected && displayAddress) {
    const handleDisconnect = async () => {
      if (isPrivyUser) {
        await logout();
      } else {
        wagmiDisconnect();
      }
    };

    return (
      <div className="flex items-center gap-1 md:gap-2">
        <span className="text-xs md:text-sm text-roots-gray hidden sm:inline">
          {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="text-xs md:text-sm px-2 md:px-3"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Privy user authenticated but wallet still loading
  if (isPrivyUser && !privyAddress && walletsReady) {
    return (
      <div className="flex items-center gap-1 md:gap-2">
        <span className="text-xs md:text-sm text-roots-gray">
          Loading wallet...
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-xs md:text-sm px-2 md:px-3"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  // Not connected - show connect options
  return (
    <>
      <Button
        onClick={login}
        size="sm"
        className="bg-roots-primary hover:bg-roots-primary/90 text-xs md:text-sm px-2 md:px-4"
      >
        Connect Wallet
      </Button>
      <BuyerWalletModal
        isOpen={showBuyerModal}
        onClose={() => setShowBuyerModal(false)}
      />
    </>
  );
}
