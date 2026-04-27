/**
 * /api/seller/pickup
 *
 * Server-side store for the seller's exact pickup address + phone, kept OUT
 * of public IPFS so non-buyers can't see where the seller lives. Replaces
 * the earlier behavior of dumping address/phone into the public storefront
 * metadata blob.
 *
 * Two endpoints, both wallet-signature authenticated:
 *
 *   POST /api/seller/pickup
 *     Body: { address, phone?, signature, message }
 *     Auth: signer must be a registered seller (Marketplace.sellerIdByOwner > 0).
 *     Effect: writes `seller:pickup:{ownerLower}` to KV.
 *
 *   GET /api/seller/pickup?orderId=N&signature=0x...&message=...
 *     Auth: signer must be the buyer of order N AND order must be a pickup
 *     order AND order must have been accepted by the seller (status >=
 *     Accepted, not Cancelled/Refunded). Status >= Accepted is the gate so
 *     drive-by orders can't harvest seller addresses.
 *     Returns: { address, phone? } from the seller's KV record.
 *
 * Message format (must be signed exactly):
 *   POST: `LocalRoots: save my pickup address @ {ISO timestamp}`
 *   GET:  `LocalRoots: view pickup for order {orderId} @ {ISO timestamp}`
 *
 * Timestamp must be within MESSAGE_WINDOW_MS of server time to prevent replay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { createFreshPublicClient } from '@/lib/viemClient';
import { MARKETPLACE_ADDRESS, marketplaceAbi } from '@/lib/contracts/marketplace';
import { kv } from '@/lib/kv';

const MESSAGE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Use the shared fallback-aware client so server-side reads don't hang
// on rate-limited public RPC. Same pattern as the relay route fix
// (Apr 27 2026).
const publicClient = createFreshPublicClient();

interface SellerPickupRecord {
  address: string;
  phone?: string;
  updatedAt: string;
}

function pickupKey(ownerAddress: string): string {
  return `seller:pickup:${ownerAddress.toLowerCase()}`;
}

/** Parse and validate the timestamp embedded in the signed message. */
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

/** Recover the signer of a wallet signature. Returns checksummed address or null. */
async function recoverSigner(message: string, signature: `0x${string}`): Promise<string | null> {
  // viem's verifyMessage validates against an expected address. To RECOVER the
  // signer, we need to try a different approach: use viem's hashMessage +
  // recoverMessageAddress. The simpler pattern below uses verifyMessage by
  // having the caller supply the claimed address. We avoid that here and
  // instead recover directly so the caller can't lie about who they are.
  try {
    const { recoverMessageAddress } = await import('viem');
    const recovered = await recoverMessageAddress({ message, signature });
    return getAddress(recovered);
  } catch (err) {
    console.error('[seller/pickup] signature recovery failed:', err);
    return null;
  }
}

// ─── POST: seller writes their pickup info ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, phone, signature, message } = body || {};

    if (typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    if (typeof signature !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'signature + message required' }, { status: 400 });
    }

    // Validate the message format and timestamp window
    if (!message.startsWith('LocalRoots: save my pickup address')) {
      return NextResponse.json({ error: 'invalid message format' }, { status: 400 });
    }
    const tsCheck = parseAndValidateTimestamp(message);
    if (!tsCheck.ok) {
      return NextResponse.json({ error: tsCheck.reason }, { status: 401 });
    }

    // Recover signer
    const signer = await recoverSigner(message, signature as `0x${string}`);
    if (!signer) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    // Confirm signer is a registered seller on-chain
    const sellerId = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellerIdByOwner',
      args: [signer as `0x${string}`],
    }) as bigint;

    if (sellerId === 0n) {
      return NextResponse.json(
        { error: 'caller is not a registered seller' },
        { status: 403 },
      );
    }

    // Persist
    const record: SellerPickupRecord = {
      address: address.trim().slice(0, 500),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 50) : undefined,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(pickupKey(signer), record);

    console.log('[seller/pickup POST] saved for sellerId', sellerId.toString(), 'owner', signer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[seller/pickup POST] error:', err);
    return NextResponse.json({ error: 'failed to save pickup info' }, { status: 500 });
  }
}

// ─── GET: two paths gated by query params ──────────────────────────────────
//   ?self=1                 → seller reads their own pickup record (for edit
//                             pre-fill). Auth: signer must be a registered
//                             seller. Message format: "LocalRoots: view my
//                             pickup @ {timestamp}"
//   ?orderId=N              → buyer reads pickup for one of their orders.
//                             Auth: signer must match order.buyer + status
//                             >= Accepted + !isDelivery.
export async function GET(request: NextRequest) {
  try {
    const isSelf = request.nextUrl.searchParams.get('self') === '1';
    const signature = request.nextUrl.searchParams.get('signature');
    const message = request.nextUrl.searchParams.get('message');

    if (!signature || !message) {
      return NextResponse.json({ error: 'signature, message required' }, { status: 400 });
    }

    // ── Path A: seller reads their own record ────────────────────────────
    if (isSelf) {
      if (!message.startsWith('LocalRoots: view my pickup')) {
        return NextResponse.json({ error: 'invalid message format' }, { status: 400 });
      }
      const tsCheck = parseAndValidateTimestamp(message);
      if (!tsCheck.ok) return NextResponse.json({ error: tsCheck.reason }, { status: 401 });

      const signer = await recoverSigner(message, signature as `0x${string}`);
      if (!signer) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

      const sellerId = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'sellerIdByOwner',
        args: [signer as `0x${string}`],
      }) as bigint;
      if (sellerId === 0n) {
        return NextResponse.json({ error: 'caller is not a registered seller' }, { status: 403 });
      }

      const record = await kv.get<SellerPickupRecord>(pickupKey(signer));
      // Empty record is normal — they may not have saved one yet
      return NextResponse.json({
        address: record?.address || '',
        phone: record?.phone || '',
      });
    }

    // ── Path B: buyer reads pickup for one of their orders ───────────────
    const orderIdParam = request.nextUrl.searchParams.get('orderId');
    if (!orderIdParam) {
      return NextResponse.json(
        { error: 'orderId required (or ?self=1 for seller read)' },
        { status: 400 },
      );
    }
    const orderId = BigInt(orderIdParam);

    const expectedPrefix = `LocalRoots: view pickup for order ${orderIdParam}`;
    if (!message.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'invalid message format' }, { status: 400 });
    }
    const tsCheck = parseAndValidateTimestamp(message);
    if (!tsCheck.ok) {
      return NextResponse.json({ error: tsCheck.reason }, { status: 401 });
    }

    const signer = await recoverSigner(message, signature as `0x${string}`);
    if (!signer) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }

    // Read order from chain
    const order = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'orders',
      args: [orderId],
    }) as readonly [bigint, bigint, string, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string, string];

    // Order tuple indices: [listingId, sellerId, buyer, quantity, totalPrice,
    //                       isDelivery, status, createdAt, completedAt, ...]
    const sellerId = order[1];
    const buyer = order[2];
    const isDelivery = order[5];
    const status = order[6];

    // Auth gate: must be the buyer
    if (getAddress(buyer) !== signer) {
      return NextResponse.json({ error: 'not authorized for this order' }, { status: 403 });
    }

    // Auth gate: must be a pickup order, not a delivery
    if (isDelivery) {
      return NextResponse.json(
        { error: 'this order is a delivery order — no pickup address' },
        { status: 400 },
      );
    }

    // Auth gate: order must be Accepted or later (anti-harvesting)
    // OrderStatus enum: 0=Pending 1=Accepted 2=ReadyForPickup 3=OutForDelivery
    //                   4=Completed 5=Disputed 6=Refunded 7=Cancelled
    if (status === 0) {
      return NextResponse.json(
        { error: 'seller has not accepted this order yet — pickup details unlock once they do' },
        { status: 425 },
      );
    }
    if (status === 6 || status === 7) {
      return NextResponse.json({ error: 'order is no longer active' }, { status: 410 });
    }

    // Look up seller owner address
    const seller = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'sellers',
      args: [sellerId],
    }) as readonly [string, string, string, boolean, boolean, bigint, bigint, boolean];
    const sellerOwner = seller[0];

    // Fetch pickup record from KV
    const record = await kv.get<SellerPickupRecord>(pickupKey(sellerOwner));
    if (!record || !record.address) {
      return NextResponse.json(
        { error: 'seller has not set pickup info yet — contact them to coordinate' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      address: record.address,
      phone: record.phone,
      updatedAt: record.updatedAt,
    });
  } catch (err) {
    console.error('[seller/pickup GET] error:', err);
    return NextResponse.json({ error: 'failed to fetch pickup info' }, { status: 500 });
  }
}

