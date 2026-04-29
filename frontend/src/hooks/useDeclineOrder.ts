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
 * Usage:
 *   const { decline, isPending, error, reset } = useDeclineOrder();
 *   const result = await decline({ orderId: 5n, reason: 'crop went bad...' });
 *   if (result?.success) { ... }
 */

import { useState, useCallback } from 'react';
import { useSignMessage } from 'wagmi';

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

        let signature: `0x${string}`;
        try {
          signature = (await signMessageAsync({ message })) as `0x${string}`;
        } catch (err) {
          const msg =
            err instanceof Error ? err.message.toLowerCase() : String(err);
          if (msg.includes('rejected') || msg.includes('denied') || msg.includes('cancelled')) {
            setError('Signature was cancelled.');
          } else {
            setError('Failed to sign decline request.');
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
    [signMessageAsync]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { decline, isPending, error, reset };
}
