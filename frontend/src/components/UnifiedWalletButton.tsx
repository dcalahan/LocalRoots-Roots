'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { BuyerWalletModal } from './BuyerWalletModal';

// LocalStorage key for tracking buyer wallet type
const BUYER_WALLET_TYPE_KEY = 'buyer_wallet_type';

export type BuyerWalletType = 'external' | 'privy' | 'test' | null;

export function getBuyerWalletType(): BuyerWalletType {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BUYER_WALLET_TYPE_KEY) as BuyerWalletType;
}

export function setBuyerWalletType(type: BuyerWalletType) {
  if (typeof window === 'undefined') return;
  if (type) {
    localStorage.setItem(BUYER_WALLET_TYPE_KEY, type);
  } else {
    localStorage.removeItem(BUYER_WALLET_TYPE_KEY);
  }
}

/**
 * UnifiedWalletButton - Context-aware wallet button for the entire app
 *
 * Routes:
 * - /buy/* → Show buyer wallet options (external wallets, test wallet, or Privy for credit card users)
 * - /sell/* → Show Privy login (sellers use embedded wallets)
 * - /ambassador/* → Show Privy login (ambassadors use embedded wallets)
 * - Other routes → Default based on localStorage buyer_wallet_type or show Privy
 */
export function UnifiedWalletButton() {
  const pathname = usePathname();
  const { authenticated, login, logout, ready: privyReady } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiConnected, connector } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const [showBuyerModal, setShowBuyerModal] = useState(false);

  // Get Privy embedded wallet
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const privyAddress = embeddedWallet?.address;

  // Determine context based on route
  const isBuyerRoute = pathname.startsWith('/buy');
  const isSellerRoute = pathname.startsWith('/sell');
  const isAmbassadorRoute = pathname.startsWith('/ambassador');

  // Determine which wallet to show (Privy takes priority for sellers/ambassadors)
  const isPrivyUser = authenticated && privyReady;

  // For buyer routes, prefer showing wagmi wallet; for seller/ambassador routes, prefer Privy
  let displayAddress: string | undefined;
  let isConnected: boolean;

  if (isBuyerRoute) {
    // On buyer routes, show wagmi wallet if connected, otherwise Privy if they used credit card
    if (wagmiConnected && wagmiAddress) {
      displayAddress = wagmiAddress;
      isConnected = true;
    } else if (isPrivyUser && privyAddress) {
      displayAddress = privyAddress;
      isConnected = true;
    } else {
      isConnected = false;
    }
  } else {
    // On seller/ambassador routes, prefer Privy
    if (isPrivyUser && privyAddress) {
      displayAddress = privyAddress;
      isConnected = true;
    } else if (wagmiConnected && wagmiAddress) {
      displayAddress = wagmiAddress;
      isConnected = true;
    } else {
      isConnected = false;
    }
  }

  // Track wallet type in localStorage when buyer connects
  useEffect(() => {
    if (isBuyerRoute && wagmiConnected && connector) {
      if (connector.id === 'testWallet') {
        setBuyerWalletType('test');
      } else {
        setBuyerWalletType('external');
      }
    }
  }, [isBuyerRoute, wagmiConnected, connector]);

  // Track when buyer uses Privy (for credit card)
  useEffect(() => {
    if (isBuyerRoute && isPrivyUser && !wagmiConnected) {
      setBuyerWalletType('privy');
    }
  }, [isBuyerRoute, isPrivyUser, wagmiConnected]);

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
      if (isPrivyUser && (!wagmiConnected || !isBuyerRoute)) {
        // On seller/ambassador routes or if only Privy is connected, logout of Privy
        await logout();
        if (isBuyerRoute) {
          setBuyerWalletType(null);
        }
      }
      if (wagmiConnected) {
        wagmiDisconnect();
        if (isBuyerRoute) {
          setBuyerWalletType(null);
        }
      }
    };

    return (
      <div className="flex items-center gap-1 md:gap-2">
        <Link
          href="/wallet"
          className="text-xs md:text-sm text-roots-gray hover:text-roots-primary hidden sm:inline transition-colors"
        >
          {displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}
        </Link>
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

  // Not connected - show connect options based on context
  const handleConnectClick = () => {
    if (isBuyerRoute) {
      // On buyer routes, show buyer wallet modal
      setShowBuyerModal(true);
    } else {
      // On seller/ambassador routes, show Privy login
      login();
    }
  };

  // Handle successful buyer wallet connection
  const handleBuyerConnect = () => {
    setShowBuyerModal(false);
  };

  // Handle buyer choosing Privy (for credit card / email login)
  const handleBuyerPrivyLogin = () => {
    setShowBuyerModal(false);
    setBuyerWalletType('privy');
    login();
  };

  return (
    <>
      <Button
        onClick={handleConnectClick}
        size="sm"
        className="bg-roots-primary hover:bg-roots-primary/90 text-xs md:text-sm px-2 md:px-4"
      >
        {isBuyerRoute ? 'Sign In' : 'Login'}
      </Button>
      <BuyerWalletModal
        isOpen={showBuyerModal}
        onClose={() => setShowBuyerModal(false)}
        onConnect={handleBuyerConnect}
        showPrivyOption={true}
        onPrivyLogin={handleBuyerPrivyLogin}
      />
    </>
  );
}
