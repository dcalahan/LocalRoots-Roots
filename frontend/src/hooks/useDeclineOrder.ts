'use client';

/**
 * useDeclineOrder — seller-initiated order cancellation.
 *
 * Architecture (Apr 29 2026):
 *   The marketplace contract has admin-only adminCancelOrder. Sellers can't
 *   call it directly. This hook signs a message proving seller-of-record,
 *   POSTs to /api/seller/cancel-order, and the server-side route invokes
 *   adminCancelOrder from the relayer wallet (which Doug added as admin
 *   one-time on Apr 29 — see project_seller_decline_order.md).
 *
 *   See /api/seller/cancel-order for the auth + validation contract.
 *
 * Signing: tries Privy's embedded-wallet provider FIRST (same pattern as
 *   useGaslessTransaction). Falls back to wagmi's useSignMessage if no
 *   Privy embedded wallet is present (i.e. external-wallet sellers).
 *   This avoids the "wagmi doesn't always surface Privy" race that bit
 *   the credit-card buyer flow earlier.
 */

import { useState, useCallback } from 'react';
import { useSignMessage } from 'wagmi';
import { useWallets } from '@privy-io/react-auth';

export interface DeclineOrderResult {
  success: boolean;
  transactionHash?: `0x${string}`;
  cancelCount?: number;
  softCap?: number;
  hardCap?: number;
  /** True when the seller has hit the soft warning threshold for the month. */
  warning?: boolean;
}

export function useDeclineOrder() {
  const { signMessageAsync } = useSignMessage();
  const { wallets } = useWallets();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decline = useCallback(
    async (params: {
      orderId: bigint | string | number;
      reason: string;
    }): Promise<DeclineOrderResult | null> => {
      setIsPending(true);
      setError(null);

      try {
        const orderIdStr =
          typeof params.orderId === 'bigint'
            ? params.orderId.toString()
            : String(params.orderId);

        // Message format MUST match the prefix the route expects in
        // /api/seller/cancel-order. If you change one, change both.
        const message = `LocalRoots: decline order ${orderIdStr} @ ${new Date().toISOString()}`;

        // Find the Privy embedded wallet first — that's how most sellers
        // sign in. Fall back to wagmi's useSignMessage for external wallets
        // OR for the rare case where Privy hasn't surfaced the embedded
        // wallet yet but wagmi has.
        const privyEmbeddedWallet = wallets.find(
          (w) => w.walletClientType === 'privy'
        );

        let signature: `0x${string}` | null = null;
        let signError: unknown = null;

        // Path A: Privy embedded wallet — sign directly via the provider.
        // Same pattern as useGaslessTransaction.ts:174-200 which works
        // reliably for sellers + ambassadors throughout the app.
        if (privyEmbeddedWallet) {
          try {
            const provider = await privyEmbeddedWallet.getEthereumProvider();
            const sig = (await provider.request({
              method: 'personal_sign',
              params: [message, privyEmbeddedWallet.address],
            })) as string;
            signature = sig as `0x${string}`;
          } catch (err) {
            signError = err;
            console.warn(
              '[useDeclineOrder] Privy provider sign failed, will try wagmi:',
              err
            );
          }
        }

        // Path B: fall back to wagmi's useSignMessage — works for external
        // wallets and is the original pattern.
        if (!signature) {
          try {
            signature = (await signMessageAsync({ message })) as `0x${string}`;
          } catch (err) {
            signError = err;
          }
        }

        if (!signature) {
          console.error('[useDeclineOrder] All signing paths failed:', signError);
          const msg =
            signError instanceof Error
              ? signError.message.toLowerCase()
              : String(signError);
          if (
            msg.includes('rejected') ||
            msg.includes('denied') ||
            msg.includes('cancelled')
          ) {
            setError('Signature was cancelled.');
          } else {
            setError(
              `Failed to sign decline request: ${signError instanceof Error ? signError.message : 'unknown error'}`
            );
          }
          return null;
        }

        const res = await fetch('/api/seller/cancel-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderIdStr,
            reason: params.reason,
            signature,
            message,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(
            data?.error ||
              `Decline failed (HTTP ${res.status}). Please try again.`
          );
          return null;
        }

        return {
          success: true,
          transactionHash: data.transactionHash,
          cancelCount: data.cancelCount,
          softCap: data.softCap,
          hardCap: data.hardCap,
          warning: !!data.warning,
        };
      } catch (err) {
        console.error('[useDeclineOrder] error:', err);
        setError(
          err instanceof Error ? err.message : 'Decline request failed.'
        );
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [signMessageAsync, wallets]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { decline, isPending, error, reset };
}
