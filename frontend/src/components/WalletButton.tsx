'use client';

import { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { WalletConnectModal } from './WalletConnectModal';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-1 md:gap-2">
        <span className="text-xs md:text-sm text-roots-gray hidden sm:inline">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          className="text-xs md:text-sm px-2 md:px-3"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <>
      <WalletConnectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      <Button
        onClick={() => setShowModal(true)}
        size="sm"
        className="bg-roots-primary hover:bg-roots-primary/90 text-xs md:text-sm px-2 md:px-4"
      >
        Connect
      </Button>
    </>
  );
}
