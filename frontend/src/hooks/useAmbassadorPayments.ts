'use client';

/**
 * Hook to fetch ambassador payment records from Vercel KV
 * TEMPORARY - This entire feature will be removed when $ROOTS token launches
 */

import { useQuery } from '@tanstack/react-query';
import type { PaymentRecord, PaymentSummary } from '@/lib/contracts/ambassador';

interface PaymentData {
  ambassadorId: string;
  payments: PaymentRecord[];
  summary: PaymentSummary;
}

/**
 * Fetch payment history for a specific ambassador
 */
export function useAmbassadorPayments(ambassadorId: string | null | undefined) {
  return useQuery({
    queryKey: ['ambassadorPayments', ambassadorId],
    enabled: !!ambassadorId,
    queryFn: async (): Promise<PaymentData> => {
      if (!ambassadorId) {
        return {
          ambassadorId: '',
          payments: [],
          summary: { ambassadorId: '', totalPaid: 0 },
        };
      }

      const res = await fetch(`/api/payments/${ambassadorId}`);

      if (!res.ok) {
        throw new Error('Failed to fetch payments');
      }

      return res.json();
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Calculate total earned from subgraph orders (completed orders only)
 * @param orders - Array of order objects from useAmbassadorOrders
 * @returns Total earned in USD cents (based on 25% commission)
 */
export function calculateTotalEarned(
  orders: Array<{ totalPrice: string; status: string }>
): number {
  let total = 0;

  for (const order of orders) {
    // Only count completed orders
    if (order.status === 'Completed') {
      const priceInCents = Math.round(Number(order.totalPrice) / 1e16); // Convert from ROOTS (18 decimals) to cents
      const commission = Math.round(priceInCents * 0.25); // 25% commission
      total += commission;
    }
  }

  return total;
}

/**
 * Format cents to USD string
 */
export function formatCentsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
