/**
 * Get payments for a specific ambassador
 * TEMPORARY - This entire feature will be removed when $ROOTS token launches
 *
 * GET /api/payments/[id] - Get payment records and summary for an ambassador
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { PaymentRecord, PaymentSummary } from '@/lib/contracts/ambassador';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: ambassadorId } = await context.params;

    if (!ambassadorId) {
      return NextResponse.json(
        { error: 'Ambassador ID required' },
        { status: 400 }
      );
    }

    // Get payment records for this ambassador
    const pattern = `payment:${ambassadorId}:*`;
    const keys = await kv.keys(pattern);

    const payments: PaymentRecord[] = [];
    for (const key of keys) {
      const payment = await kv.get<PaymentRecord>(key);
      if (payment) {
        payments.push(payment);
      }
    }

    // Sort by paidAt descending (most recent first)
    payments.sort((a, b) => b.paidAt - a.paidAt);

    // Get payment summary
    const summary = await kv.get<PaymentSummary>(`payment-summary:${ambassadorId}`);

    return NextResponse.json({
      ambassadorId,
      payments,
      summary: summary || {
        ambassadorId,
        totalPaid: 0,
      },
    });

  } catch (error) {
    console.error('[GET /api/payments/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
