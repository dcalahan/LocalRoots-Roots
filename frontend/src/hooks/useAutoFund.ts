'use client';

import { useEffect, useState, useRef } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useToast } from '@/hooks/use-toast';
import { baseSepolia } from 'viem/chains';

/**
 * Auto-fund hook for testnet
 *
 * Automatically detects new wallets and funds them with test tokens
 * so users can try the app immediately without acquiring testnet tokens.
 *
 * Only active on Base Sepolia testnet.
 */

// Only auto-fund on testnet
const TESTNET_CHAIN_ID = baseSepolia.id; // 84532

export function useAutoFund() {
  const { address, isConnected, chainId } = useAccount();
  const { data: balance } = useBalance({ address });
  const { toast } = useToast();
  const [isFunding, setIsFunding] = useState(false);
  const [hasFunded, setHasFunded] = useState(false);
  const attemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only run on testnet
    if (chainId !== TESTNET_CHAIN_ID) {
      return;
    }

    // Must be connected with an address
    if (!isConnected || !address) {
      return;
    }

    // Don't fund if already attempted for this address
    if (attemptedRef.current.has(address.toLowerCase())) {
      return;
    }

    // Don't fund if already funding or funded
    if (isFunding || hasFunded) {
      return;
    }

    // Check if balance is loaded and is low (< 0.0005 ETH)
    if (!balance) {
      return;
    }

    const ethBalance = balance.value;
    const needsFunding = ethBalance < BigInt(5e14); // 0.0005 ETH

    if (!needsFunding) {
      // User already has funds, mark as attempted
      attemptedRef.current.add(address.toLowerCase());
      return;
    }

    // Fund the wallet
    const fundWallet = async () => {
      setIsFunding(true);
      attemptedRef.current.add(address.toLowerCase());

      try {
        const response = await fetch('/api/faucet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        });

        const data = await response.json();

        if (data.success) {
          setHasFunded(true);

          if (data.alreadyFunded) {
            // Silently skip if already funded
            return;
          }

          // Show success toast
          toast({
            title: '🎉 Test Funds Added!',
            description: 'We added test tokens to your wallet so you can try LocalRoots. These have no real value.',
            duration: 8000,
          });
        } else if (data.alreadyFunded) {
          // Already funded, no toast needed
          setHasFunded(true);
        } else {
          console.warn('[AutoFund] Faucet returned error:', data.error);
        }
      } catch (error) {
        console.error('[AutoFund] Failed to fund wallet:', error);
        // Don't show error toast - funding is a nice-to-have
      } finally {
        setIsFunding(false);
      }
    };

    fundWallet();
  }, [address, isConnected, chainId, balance, isFunding, hasFunded, toast]);

  return { isFunding, hasFunded };
}
