/**
 * Ambassador Payments API
 * TEMPORARY - This entire feature will be removed when $ROOTS token launches
 *
 * Endpoints:
 * GET /api/payments - Get all payments (admin only) or for specific ambassador
 * POST /api/payments - Record a new payment (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import type { PaymentRecord, PaymentSummary } from '@/lib/contracts/ambassador';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';

// Verify admin status on-chain
async function isAdmin(address: string): Promise<boolean> {
  if (!address) return false;

  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const result = await client.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'isAdmin',
      args: [address as `0x${string}`],
    });

    return result as boolean;
  } catch {
    return false;
  }
}

// GET /api/payments?ambassadorId=X
// Admin can get all payments or filter by ambassador
// Non-admin can only get their own payments
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ambassadorId = searchParams.get('ambassadorId');
  const adminAddress = searchParams.get('adminAddress');

  try {
    // If requesting specific ambassador's payments
    if (ambassadorId) {
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
        payments,
        summary: summary || {
          ambassadorId,
          totalPaid: 0,
        },
      });
    }

    // Admin-only: Get all payment summaries
    if (!adminAddress) {
      return NextResponse.json({ error: 'Admin address required' }, { status: 400 });
    }

    const admin = await isAdmin(adminAddress);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all payment summaries
    const summaryKeys = await kv.keys('payment-summary:*');
    const summaries: PaymentSummary[] = [];

    for (const key of summaryKeys) {
      const summary = await kv.get<PaymentSummary>(key);
      if (summary) {
        summaries.push(summary);
      }
    }

    return NextResponse.json({ summaries });

  } catch (error) {
    console.error('[GET /api/payments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST /api/payments - Record a new payment (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ambassadorId, amount, method, transactionId, note, adminAddress } = body;

    // Validate required fields
    if (!ambassadorId || !amount || !method || !adminAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: ambassadorId, amount, method, adminAddress' },
        { status: 400 }
      );
    }

    // Verify admin
    const admin = await isAdmin(adminAddress);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate payment method
    if (!['venmo', 'paypal', 'zelle'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid payment method. Must be venmo, paypal, or zelle' },
        { status: 400 }
      );
    }

    // Validate amount (must be positive)
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number (in cents)' },
        { status: 400 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const paymentId = `payment:${ambassadorId}:${timestamp}`;

    const payment: PaymentRecord = {
      id: paymentId,
      ambassadorId,
      amount,
      method,
      transactionId: transactionId || undefined,
      note: note || undefined,
      paidAt: timestamp,
      paidBy: adminAddress,
    };

    // Store the payment record
    await kv.set(paymentId, payment);

    // Update the payment summary
    const summaryKey = `payment-summary:${ambassadorId}`;
    const existingSummary = await kv.get<PaymentSummary>(summaryKey);

    const newSummary: PaymentSummary = {
      ambassadorId,
      totalPaid: (existingSummary?.totalPaid || 0) + amount,
      lastPaidAt: timestamp,
      lastPaymentAmount: amount,
    };

    await kv.set(summaryKey, newSummary);

    return NextResponse.json({
      success: true,
      payment,
      summary: newSummary,
    });

  } catch (error) {
    console.error('[POST /api/payments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}
