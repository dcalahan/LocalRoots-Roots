'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDeclineOrder } from '@/hooks/useDeclineOrder';
import { useToast } from '@/hooks/use-toast';

interface DeclineOrderModalProps {
  orderId: bigint;
  productName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const REASON_MIN_CHARS = 20;
const REASON_MAX_CHARS = 500;

/**
 * DeclineOrderModal — seller-side cancellation flow.
 *
 * Triggers the /api/seller/cancel-order route via useDeclineOrder hook.
 * Once on-chain, the buyer is refunded in their original payment token,
 * inventory is restored to the listing, ambassador rewards are clawed
 * back, and the cancellation reason is persisted in the
 * OrderCancelledByAdmin event log for the buyer to read on their orders
 * page.
 *
 * Decline is irreversible (refunds buyer immediately), so we require:
 *   - reason ≥ 20 chars (matches dispute-vote min for consistency)
 *   - explicit confirmation checkbox
 *
 * Doug's principle (Apr 29 2026): seller MUST give a reason. Both client
 * and route enforce this — even if a malicious seller bypassed the UI and
 * called the route directly, the route requires reason length.
 */
export function DeclineOrderModal({
  orderId,
  productName,
  onClose,
  onSuccess,
}: DeclineOrderModalProps) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const { decline, isPending, error } = useDeclineOrder();
  const { toast } = useToast();

  const trimmed = reason.trim();
  const tooShort = trimmed.length < REASON_MIN_CHARS;
  const tooLong = trimmed.length > REASON_MAX_CHARS;
  const canSubmit = !tooShort && !tooLong && confirmed && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const result = await decline({ orderId, reason: trimmed });
    if (result?.success) {
      toast({
        title: 'Order declined',
        description: result.warning
          ? `Buyer refunded. Note: you've declined ${result.cancelCount} of ${result.hardCap} allowed orders this month — frequent declines may trigger account review.`
          : 'Buyer has been refunded in their original payment method.',
      });
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-heading font-bold mb-2">Decline Order</h2>
          <p className="text-roots-gray text-sm mb-4">
            Order #{orderId.toString()} — {productName}
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900">
            <strong>This will refund the buyer immediately</strong> and cannot be undone.
            The buyer will see your reason on their orders page.
          </div>

          <div className="mb-4">
            <label htmlFor="decline-reason" className="block text-sm font-medium mb-1">
              Reason for declining
              <span className="text-roots-primary"> *</span>
            </label>
            <textarea
              id="decline-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Crop didn't ripen in time, I'm out of town this week, listing was a duplicate I forgot to remove..."
              rows={5}
              maxLength={REASON_MAX_CHARS + 50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-roots-primary focus:border-transparent text-sm"
              disabled={isPending}
            />
            <div className="flex justify-between text-xs mt-1">
              <span
                className={
                  tooShort
                    ? 'text-roots-primary'
                    : tooLong
                      ? 'text-roots-primary'
                      : 'text-roots-gray'
                }
              >
                {tooShort
                  ? `${REASON_MIN_CHARS - trimmed.length} more characters needed`
                  : tooLong
                    ? `${trimmed.length - REASON_MAX_CHARS} too many characters`
                    : `${trimmed.length} / ${REASON_MAX_CHARS} characters`}
              </span>
              <span className="text-roots-gray">Required, minimum {REASON_MIN_CHARS}</span>
            </div>
          </div>

          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
              disabled={isPending}
            />
            <span className="text-sm text-roots-gray">
              I understand this will refund the buyer in full and cannot be undone.
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-900">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="flex-1"
            >
              Keep Order
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? 'Declining…' : 'Decline & Refund'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
