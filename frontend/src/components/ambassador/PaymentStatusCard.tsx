'use client';

/**
 * PaymentStatusCard - Shows ambassador payment status and history
 * TEMPORARY - This entire component will be removed when $ROOTS token launches
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAmbassadorPayments, formatCentsToUsd } from '@/hooks/useAmbassadorPayments';
import { useAmbassadorOrders, calculateCommission } from '@/hooks/useAmbassadorOrders';
import { PaymentPreferencesModal } from './PaymentPreferencesModal';
import type { AmbassadorProfile } from '@/lib/contracts/ambassador';

interface PaymentStatusCardProps {
  ambassadorId: string | null;
  profile: AmbassadorProfile | null;
  onProfileUpdate?: () => void;
}

export function PaymentStatusCard({
  ambassadorId,
  profile,
  onProfileUpdate,
}: PaymentStatusCardProps) {
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Fetch payment data from KV
  const { data: paymentData, isLoading: isLoadingPayments } = useAmbassadorPayments(ambassadorId);

  // Fetch orders to calculate total earned from subgraph
  const { data: ordersData, isLoading: isLoadingOrders } = useAmbassadorOrders(ambassadorId || undefined);

  // Calculate total earned from completed orders (25% commission)
  const totalEarnedCents = ordersData?.orders
    ? ordersData.orders
        .filter(order => order.status === 'Completed')
        .reduce((sum, order) => {
          // Commission is calculated from totalPrice (in ROOTS, 18 decimals)
          // Convert to USD cents: ROOTS / 1e18 / 100 (100 ROOTS = $1) * 100 (to cents) * 0.25 (25% commission)
          const priceInUsd = Number(order.totalPrice) / 1e18 / 100;
          const commissionUsd = priceInUsd * 0.25;
          return sum + Math.round(commissionUsd * 100); // Convert to cents
        }, 0)
    : 0;

  const totalPaidCents = paymentData?.summary?.totalPaid || 0;
  const balanceOwedCents = Math.max(0, totalEarnedCents - totalPaidCents);

  const isLoading = isLoadingPayments || isLoadingOrders;
  const hasPaymentMethod = profile?.paymentMethod && profile?.paymentHandle;

  // Format payment method for display
  const formatPaymentMethod = (method: string, handle: string) => {
    switch (method) {
      case 'venmo':
        return `Venmo (${handle})`;
      case 'paypal':
        return `PayPal (${handle})`;
      case 'zelle':
        return `Zelle (${handle})`;
      default:
        return `${method} (${handle})`;
    }
  };

  // No payment method set - show prompt
  if (!hasPaymentMethod) {
    return (
      <>
        <Card className="mb-8 border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">💵</span> Get Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalEarnedCents > 0 ? (
              <p className="text-lg mb-4">
                You've earned <strong className="text-green-600">{formatCentsToUsd(totalEarnedCents)}</strong> in commissions!
              </p>
            ) : (
              <p className="text-roots-gray mb-4">
                Earn cash commission (25%) when your recruited farmers make sales.
              </p>
            )}
            <p className="text-sm text-roots-gray mb-4">
              Add your payment info to receive your earnings via Venmo, PayPal, or Zelle.
            </p>
            <Button
              onClick={() => setShowPreferencesModal(true)}
              className="bg-roots-primary hover:bg-roots-primary/90"
            >
              Set Up Payment Method
            </Button>
          </CardContent>
        </Card>

        <PaymentPreferencesModal
          isOpen={showPreferencesModal}
          onClose={() => setShowPreferencesModal(false)}
          currentProfile={profile}
          onSuccess={() => {
            setShowPreferencesModal(false);
            onProfileUpdate?.();
          }}
        />
      </>
    );
  }

  // Has payment method - show full status
  return (
    <>
      <Card className="mb-8 border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="text-2xl">💵</span> Payment Status
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-auto">
              TEMPORARY - until $ROOTS launch
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-6 bg-gray-200 rounded w-1/4" />
            </div>
          ) : (
            <>
              {/* Payment Summary */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCentsToUsd(totalEarnedCents)}
                  </div>
                  <div className="text-xs text-roots-gray">Total Earned</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCentsToUsd(totalPaidCents)}
                  </div>
                  <div className="text-xs text-roots-gray">Total Paid</div>
                </div>
                <div className="text-center p-3 bg-white rounded-lg">
                  <div className={`text-2xl font-bold ${balanceOwedCents > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {formatCentsToUsd(balanceOwedCents)}
                  </div>
                  <div className="text-xs text-roots-gray">Balance Owed</div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-center justify-between p-3 bg-white rounded-lg mb-4">
                <div>
                  <span className="text-sm text-roots-gray">Payment Method: </span>
                  <span className="font-medium">
                    {formatPaymentMethod(profile.paymentMethod!, profile.paymentHandle!)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreferencesModal(true)}
                >
                  Edit
                </Button>
              </div>

              {/* Recent Payments */}
              {paymentData?.payments && paymentData.payments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-roots-gray mb-2">Recent Payments:</h4>
                  <div className="space-y-2">
                    {paymentData.payments.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between text-sm p-2 bg-white rounded"
                      >
                        <span className="text-green-600 font-medium">
                          {formatCentsToUsd(payment.amount)}
                        </span>
                        <span className="text-roots-gray">
                          {new Date(payment.paidAt * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment info */}
              <div className="mt-4 pt-3 border-t text-center text-sm text-roots-gray">
                <span className="inline-flex items-center gap-1">
                  <span>📬</span>
                  Payments sent monthly via {profile.paymentMethod}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <PaymentPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        currentProfile={profile}
        onSuccess={() => {
          setShowPreferencesModal(false);
          onProfileUpdate?.();
        }}
      />
    </>
  );
}
