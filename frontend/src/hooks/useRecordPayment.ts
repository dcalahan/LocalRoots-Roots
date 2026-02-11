'use client';

/**
 * Hook for admin to record a payment to an ambassador
 * TEMPORARY - This entire feature will be removed when $ROOTS token launches
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PaymentRecord, PaymentSummary } from '@/lib/contracts/ambassador';

interface RecordPaymentInput {
  ambassadorId: string;
  amount: number;           // USD cents
  method: 'venmo' | 'paypal' | 'zelle';
  transactionId?: string;
  note?: string;
  adminAddress: string;
}

interface RecordPaymentResult {
  success: boolean;
  payment?: PaymentRecord;
  summary?: PaymentSummary;
  error?: string;
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: RecordPaymentInput): Promise<RecordPaymentResult> => {
      setError(null);

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      return data;
    },
    onSuccess: (data) => {
      // Invalidate payment queries so they refetch
      if (data.payment?.ambassadorId) {
        queryClient.invalidateQueries({
          queryKey: ['ambassadorPayments', data.payment.ambassadorId],
        });
      }
      // Also invalidate admin payment summary queries
      queryClient.invalidateQueries({
        queryKey: ['allPaymentSummaries'],
      });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  return {
    recordPayment: mutation.mutateAsync,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error,
    reset: () => {
      setError(null);
      mutation.reset();
    },
  };
}

/**
 * Hook to fetch all payment summaries (admin only)
 */
export function useAllPaymentSummaries(adminAddress: string | undefined) {
  return {
    ...require('@tanstack/react-query').useQuery({
      queryKey: ['allPaymentSummaries', adminAddress],
      enabled: !!adminAddress,
      queryFn: async (): Promise<{ summaries: PaymentSummary[] }> => {
        if (!adminAddress) {
          return { summaries: [] };
        }

        const res = await fetch(`/api/payments?adminAddress=${adminAddress}`);

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch payment summaries');
        }

        return res.json();
      },
      staleTime: 30000, // 30 seconds
    }),
  };
}
