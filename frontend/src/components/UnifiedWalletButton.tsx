'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAccount, useDisconnect } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { BuyerWalletModal } from './BuyerWalletModal';
import { useWalletBalances } from '@/hooks/useWalletBalances';

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
          href="/orders"
          className="text-xs md:text-sm text-roots-gray hover:text-roots-primary hidden sm:inline transition-colors"
        >
          Orders
        </Link>
        <Link
          href="/profile"
          className="text-xs md:text-sm text-roots-gray hover:text-roots-primary hidden sm:inline transition-colors"
        >
          Profile
        </Link>
        <WalletPill />
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

/**
 * WalletPill — header wallet display.
 *
 * Replaces the raw "0x30C4...4879" address chip with a friendly bubble
 * showing total wallet value in USD. Click → /wallet for details.
 *
 * Doug, Apr 29 2026: "I would like to see something like Wallet and the
 * USDC equivalent of the money in my wallet. Then I can click on it and
 * see my holdings. We could move the privy wallet address to the Your
 * Wallet page."
 *
 * Why USD instead of crypto units: aligns with the "crypto is invisible"
 * positioning principle (CLAUDE.md). Sellers and buyers think in dollars.
 * Showing "0x30C4…" or "9.76 USDC" both leak crypto-jargon. "$9.76" is
 * universal.
 */
function WalletPill() {
  const { balances, isLoading } = useWalletBalances();

  // Sum every balance's USD value. Includes ETH, ROOTS, USDC, USDT.
  const totalUsd = (balances || []).reduce(
    (sum, b) => sum + (b.usdValue || 0),
    0
  );

  // Formatting: under $0.01 reads as "$0", round normally otherwise.
  const display = totalUsd < 0.01 ? '$0' : `$${totalUsd.toFixed(2)}`;

  return (
    <Link
      href="/wallet"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-roots-primary/10 hover:bg-roots-primary/20 border border-roots-primary/30 text-roots-primary text-xs md:text-sm font-medium transition-colors"
      title="Open your wallet"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2 2 0 00-2-2h-3a2 2 0 100 4h3a2 2 0 002-2zm-2 0h-3M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
      <span>Wallet</span>
      {isLoading ? (
        <span className="opacity-60">…</span>
      ) : (
        <span className="font-bold">{display}</span>
      )}
    </Link>
  );
}
