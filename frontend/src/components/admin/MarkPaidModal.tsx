'use client';

/**
 * MarkPaidModal - Admin modal to record a payment to an ambassador
 * TEMPORARY - This entire component will be removed when $ROOTS token launches
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRecordPayment } from '@/hooks/useRecordPayment';
import { useToast } from '@/hooks/use-toast';
import { formatCentsToUsd } from '@/hooks/useAmbassadorPayments';

type PaymentMethod = 'venmo' | 'paypal' | 'zelle';

interface AmbassadorInfo {
  id: string;
  profile: { name?: string } | null;
  paymentMethod?: string;
  paymentHandle?: string;
  balanceOwed: number;
}

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  ambassador: AmbassadorInfo;
  adminAddress: string;
  onSuccess?: () => void;
}

export function MarkPaidModal({
  isOpen,
  onClose,
  ambassador,
  adminAddress,
  onSuccess,
}: MarkPaidModalProps) {
  const { toast } = useToast();
  const { recordPayment, isPending, error, reset } = useRecordPayment();

  // Form state - default to owed balance
  const [amount, setAmount] = useState((ambassador.balanceOwed / 100).toFixed(2));
  const [method, setMethod] = useState<PaymentMethod>(
    (ambassador.paymentMethod as PaymentMethod) || 'venmo'
  );
  const [transactionId, setTransactionId] = useState('');
  const [note, setNote] = useState('');

  // Reset form when ambassador changes
  useEffect(() => {
    setAmount((ambassador.balanceOwed / 100).toFixed(2));
    setMethod((ambassador.paymentMethod as PaymentMethod) || 'venmo');
    setTransactionId('');
    setNote('');
    reset();
  }, [ambassador.id]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: 'Failed to record payment',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSubmit = async () => {
    const amountCents = Math.round(parseFloat(amount) * 100);

    if (isNaN(amountCents) || amountCents <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid payment amount.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await recordPayment({
        ambassadorId: ambassador.id,
        amount: amountCents,
        method,
        transactionId: transactionId.trim() || undefined,
        note: note.trim() || undefined,
        adminAddress,
      });

      if (result.success) {
        toast({
          title: 'Payment recorded!',
          description: `Recorded ${formatCentsToUsd(amountCents)} payment to ${ambassador.profile?.name || `Ambassador #${ambassador.id}`}`,
        });
        onSuccess?.();
      }
    } catch (err) {
      // Error handled by hook
    }
  };

  if (!isOpen) return null;

  const ambassadorName = ambassador.profile?.name || `Ambassador #${ambassador.id}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Record Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Ambassador Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="font-medium">{ambassadorName}</div>
          {ambassador.paymentHandle && (
            <div className="text-sm text-roots-gray">
              {ambassador.paymentMethod === 'venmo' && '💳 '}
              {ambassador.paymentMethod === 'paypal' && '💸 '}
              {ambassador.paymentMethod === 'zelle' && '🏦 '}
              {ambassador.paymentHandle}
            </div>
          )}
          <div className="mt-2 text-sm">
            Balance owed: <strong className="text-roots-primary">{formatCentsToUsd(ambassador.balanceOwed)}</strong>
          </div>
        </div>

        {/* Payment Form */}
        <div className="space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-roots-gray">
              Suggested: {formatCentsToUsd(ambassador.balanceOwed)} (full balance)
            </p>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['venmo', 'paypal', 'zelle'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`p-2 rounded-lg border-2 transition-all text-sm ${
                    method === m
                      ? 'border-roots-primary bg-roots-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m === 'venmo' && '💳 Venmo'}
                  {m === 'paypal' && '💸 PayPal'}
                  {m === 'zelle' && '🏦 Zelle'}
                </button>
              ))}
            </div>
          </div>

          {/* Transaction ID (optional) */}
          <div className="space-y-2">
            <Label htmlFor="transactionId">Transaction ID (optional)</Label>
            <Input
              id="transactionId"
              type="text"
              placeholder="e.g., Venmo transaction ID"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
          </div>

          {/* Note (optional) */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              type="text"
              placeholder="e.g., January 2026 commission"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !amount}
            className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
          >
            {isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </div>
    </div>
  );
}
