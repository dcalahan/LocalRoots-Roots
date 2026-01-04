'use client';

import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';

export function WalletButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Get wallet address from Privy user
  const walletAddress = user?.wallet?.address;

  if (!ready) {
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

  // Show disconnect if authenticated (even without wallet address yet)
  if (authenticated) {
    return (
      <div className="flex items-center gap-1 md:gap-2">
        {walletAddress ? (
          <span className="text-xs md:text-sm text-roots-gray hidden sm:inline">
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
          </span>
        ) : (
          <span className="text-xs md:text-sm text-roots-gray hidden sm:inline">
            Loading wallet...
          </span>
        )}
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

  return (
    <Button
      onClick={login}
      size="sm"
      className="bg-roots-primary hover:bg-roots-primary/90 text-xs md:text-sm px-2 md:px-4"
    >
      Sign Up / Log In
    </Button>
  );
}
