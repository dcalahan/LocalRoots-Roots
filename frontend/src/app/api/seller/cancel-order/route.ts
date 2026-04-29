/**
 * /api/seller/cancel-order
 *
 * Seller-initiated order cancellation.
 *
 * Architecture (Doug + Plan agent, Apr 29 2026):
 *   The marketplace contract has `adminCancelOrder(orderId, reason)` which
 *   does exactly what a seller-decline needs (refund buyer in original
 *   token, restore inventory, claw back ambassador rewards, persist reason
 *   on-chain via OrderCancelledByAdmin event). It's gated to admins only.
 *
 *   Rather than redeploy the contract for a `sellerCancelOrder` function
 *   (mainnet redeploy = expensive, see CLAUDE.md "Redeploying Contracts"),
 *   we add the relayer wallet (RELAYER_PRIVATE_KEY) as an admin and let
 *   it invoke adminCancelOrder on behalf of the seller-of-record.
 *
 *   The route gates which seller can cancel which order via signature
 *   verification — same pattern as /api/seller/pickup. Even though the
 *   relayer is admin and could cancel anything, this route only ever
 *   cancels orders where the signature recovers to the seller-of-record.
 *
 * Centralization caveat (intentional, reversible):
 *   The relayer wallet now has admin powers. Worst-case if compromised:
 *   attacker can cancel any order and refund the buyer. They CANNOT steal
 *   funds (adminCancelOrder only refunds; never releases to seller). When
 *   the next contract redeploy ships, we add a real `sellerCancelOrder`
 *   function gated to the seller-of-record, and drop the relayer's admin
 *   grant. Tracked in project_seller_decline_order.md memory.
 *
 * Auth:
 *   Body must include `signature` + `message`. Message must be exactly
 *   `LocalRoots: decline order {orderId} @ {ISO timestamp}` and the
 *   timestamp must be within MESSAGE_WINDOW_MS of server time. The signer
 *   recovered from the signature must equal the order's seller-of-record.
 *
 * State-transition rules:
 *   Cancel allowed ONLY when order.status is Pending (0) or Accepted (1).
 *   Past that (ReadyForPickup, OutForDelivery, Completed, Disputed,
 *   Refunded, Cancelled), the seller has either uploaded fulfillment
 *   proof (so the buyer should `raiseDispute` for a refund) or the order
 *   is already terminal.
 *
 * Rate limit (server-side, KV-keyed, soft+hard cap):
 *   `seller-cancel-count:{sellerId}:{YYYY-MM}` rolling 30-day-ish window.
 *   Soft cap (3) → success returns ok with a `warning` flag; UI shows toast.
 *   Hard cap (5) → 429. Forces escalation through admin dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAddress, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createFreshPublicClient, createFreshWalletClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { kv } from '@/lib/kv';

const MESSAGE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (matches /api/seller/pickup)
const REASON_MIN_CHARS = 20; // matches dispute-vote minimum per CLAUDE.md
const REASON_MAX_CHARS = 500;

// OrderStatus enum from LocalRootsMarketplace.sol:
//   0 Pending, 1 Accepted, 2 ReadyForPickup, 3 OutForDelivery,
//   4 Completed, 5 Disputed, 6 Refunded, 7 Cancelled.
// Sellers can only cancel BEFORE proof has been uploaded.
const ALLOWED_STATUSES_FOR_DECLINE = new Set<number>([0, 1]);

// Soft + hard caps over a rolling-ish month. Implemented as month-keyed KV
// counters — simpler than rolling-window logic and good enough for v1
// abuse defense. A determined attacker can't drain anything anyway because
// adminCancelOrder only refunds buyers; this rate limit is mostly to flag
// flaky sellers for admin review rather than to prevent fund loss.
const SOFT_CAP_PER_MONTH = 3;
const HARD_CAP_PER_MONTH = 5;

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function cancelCountKey(sellerId: bigint): string {
  return `seller-cancel-count:${sellerId.toString()}:${monthKey()}`;
}

function parseAndValidateTimestamp(message: string): { ok: true } | { ok: false; reason: string } {
  const match = message.match(/@ (.+)$/);
  if (!match) return { ok: false, reason: 'message missing timestamp' };
  const ts = Date.parse(match[1]);
  if (isNaN(ts)) return { ok: false, reason: 'invalid timestamp' };
  const drift = Math.abs(Date.now() - ts);
  if (drift > MESSAGE_WINDOW_MS) {
    return { ok: false, reason: 'timestamp outside 5-minute window' };
  }
  return { ok: true };
}

async function recoverSigner(message: string, signature: `0x${string}`): Promise<string | null> {
  try {
    const { recoverMessageAddress } = await import('viem');
    const recovered = await recoverMessageAddress({ message, signature });
    return getAddress(recovered);
  } catch (err) {
    console.error('[seller/cancel-order] signature recovery failed:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, reason, signature, message } = body || {};

    // 1. Validate body shape.
    if (typeof orderId !== 'string' && typeof orderId !== 'number') {
      return NextResponse.json({ error: 'orderId is required (string or number)' }, { status: 400 });
    }
    if (typeof reason !== 'string') {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 });
    }
    const trimmedReason = reason.trim();
    if (trimmedReason.length < REASON_MIN_CHARS) {
      return NextResponse.json(
        { error: `reason must be at least ${REASON_MIN_CHARS} characters` },
        { status: 400 }
      );
    }
    if (trimmedReason.length > REASON_MAX_CHARS) {
      return NextResponse.json(
        { error: `reason must be at most ${REASON_MAX_CHARS} characters` },
        { status: 400 }
      );
    }
    if (typeof signature !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'signature + message required' }, { status: 400 });
    }

    let orderIdBigInt: bigint;
    try {
      orderIdBigInt = BigInt(orderId);
    } catch {
      return NextResponse.json({ error: 'orderId must be a valid integer' }, { status: 400 });
    }
    if (orderIdBigInt <= 0n) {
      return NextResponse.json({ error: 'orderId must be positive' }, { status: 400 });
    }

    // 2. Validate message format + timestamp window.
    const expectedPrefix = `LocalRoots: decline order ${orderIdBigInt.toString()}`;
    if (!message.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `invalid message format (must start with "${expectedPrefix}")` },
        { status: 400 }
      );
    }
    const tsCheck = parseAndValidateTimestamp(message);
    if (!tsCheck.ok) {
      return NextResponse.json({ error: tsCheck.reason }, { status: 401 });
    }

    // 3. Recover signer.
    const signer = await recoverSigner(message, signature as `0x${string}`);
    if (!signer) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    // 4. Read order on-chain.
    const publicClient = createFreshPublicClient();
    const order = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'orders',
      args: [orderIdBigInt],
    }) as readonly [bigint, bigint, Address, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string, Address];

    const orderListingId = order[0];
    const orderSellerId = order[1];
    const orderBuyer = order[2];
    const orderStatus = Number(order[6]);
    const orderFundsReleased = order[12];

    if (orderListingId === 0n && orderBuyer === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'order does not exist' }, { status: 404 });
    }

    // 5. Verify signer is the seller-of-record.
    const sellerIdForSigner = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellerIdByOwner',
      args: [signer as Address],
    }) as bigint;

    if (sellerIdForSigner === 0n) {
      return NextResponse.json(
        { error: 'caller is not a registered seller' },
        { status: 403 }
      );
    }

    if (sellerIdForSigner !== orderSellerId) {
      return NextResponse.json(
        { error: 'caller is not the seller of this order' },
        { status: 403 }
      );
    }

    // 6. Verify order is in a cancelable state.
    if (!ALLOWED_STATUSES_FOR_DECLINE.has(orderStatus)) {
      return NextResponse.json(
        {
          error:
            'order cannot be declined at this stage. If proof has been uploaded, the buyer should raise a dispute.',
          status: orderStatus,
        },
        { status: 409 }
      );
    }

    if (orderFundsReleased) {
      return NextResponse.json(
        { error: 'funds already released; cannot cancel' },
        { status: 409 }
      );
    }

    // 7. Rate limit per seller per month.
    const countKey = cancelCountKey(orderSellerId);
    const currentCount = (await kv.get<number>(countKey)) ?? 0;
    if (currentCount >= HARD_CAP_PER_MONTH) {
      console.warn(
        `[seller/cancel-order] hard cap hit for sellerId=${orderSellerId} count=${currentCount}`
      );
      return NextResponse.json(
        {
          error:
            'monthly decline limit reached. Please contact support to escalate.',
          softCap: SOFT_CAP_PER_MONTH,
          hardCap: HARD_CAP_PER_MONTH,
        },
        { status: 429 }
      );
    }

    // 8. Submit adminCancelOrder from the relayer wallet.
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
      console.error('[seller/cancel-order] RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }
    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const walletClient = createFreshWalletClient(account);

    // Prefix the on-chain reason so anyone reading the event later can see
    // this was a seller-initiated decline (vs an admin moderation action).
    const onChainReason = `Seller declined: ${trimmedReason}`;

    console.log(
      `[seller/cancel-order] cancelling orderId=${orderIdBigInt.toString()} sellerId=${orderSellerId.toString()} signer=${signer}`
    );

    const txHash = await walletClient.writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'adminCancelOrder',
      args: [orderIdBigInt, onChainReason],
    });

    console.log('[seller/cancel-order] tx submitted:', txHash);

    // Wait server-side so the client doesn't have to poll the chain.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    if (receipt.status === 'reverted') {
      console.error(
        `[seller/cancel-order] reverted txHash=${txHash} orderId=${orderIdBigInt.toString()}`
      );
      return NextResponse.json(
        {
          error:
            'cancellation reverted on-chain. Order may have advanced to a non-cancelable state. Please refresh and check the order status.',
          transactionHash: txHash,
        },
        { status: 500 }
      );
    }

    // 9. Increment counter only on confirmed success.
    await kv.set(countKey, currentCount + 1);

    const newCount = currentCount + 1;
    const warning = newCount >= SOFT_CAP_PER_MONTH;

    console.log(
      `[seller/cancel-order] success orderId=${orderIdBigInt.toString()} count=${newCount}/${HARD_CAP_PER_MONTH} warning=${warning}`
    );

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      cancelCount: newCount,
      softCap: SOFT_CAP_PER_MONTH,
      hardCap: HARD_CAP_PER_MONTH,
      warning,
    });
  } catch (err) {
    console.error('[seller/cancel-order] error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer has insufficient ETH for gas. Please notify the team.' },
        { status: 503 }
      );
    }

    if (message.toLowerCase().includes('not admin') || message.includes('caller is not authorized')) {
      // The relayer hasn't been added as admin yet. Surface a clean
      // diagnostic so Doug knows what step is missing.
      return NextResponse.json(
        {
          error:
            'Relayer is not yet authorized as admin on the marketplace. Doug must call addAdmin(0xe2034722F2973814CF829179889b7C27D8D00452) from the admin dashboard before this endpoint works.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Decline failed: ${message}` },
      { status: 500 }
    );
  }
}
