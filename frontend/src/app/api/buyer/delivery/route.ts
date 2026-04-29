/**
 * /api/buyer/delivery
 *
 * Server-side store for the buyer's saved delivery address (street, phone,
 * notes). Persisted to private KV at `buyer:delivery:{ownerLower}` so it
 * survives across browser sessions and devices, but is never publicly
 * indexed (mirrors `seller:pickup:{ownerLower}` for the symmetric privacy
 * model — buyers' home addresses are sensitive PII).
 *
 * Two endpoints, both wallet-signature authenticated:
 *
 *   POST /api/buyer/delivery
 *     Body: { address, phone?, notes?, signature, message }
 *     Auth: signer is whoever owns the address record (no role gate — any
 *     wallet can save its own delivery preferences).
 *     Effect: writes `buyer:delivery:{ownerLower}` to KV.
 *
 *   GET /api/buyer/delivery?self=1&signature=0x...&message=...
 *     Auth: signer is whoever owns the record they're requesting.
 *     Returns: { address, phone?, notes? } or null if no record exists.
 *
 * Message format (must be signed exactly):
 *   POST: `LocalRoots: save my delivery address @ {ISO timestamp}`
 *   GET:  `LocalRoots: view my delivery @ {ISO timestamp}`
 *
 * Timestamp must be within MESSAGE_WINDOW_MS of server time to prevent
 * replay attacks. Same pattern as /api/seller/pickup.
 *
 * Why a route instead of pure client-side localStorage:
 *   localStorage is tied to one browser. Buyers who order from their phone
 *   one day and laptop the next would have to re-enter the address every
 *   time. Server-side KV gives them a single saved record that follows
 *   their wallet identity (signature-verified) across devices.
 *
 * Privacy note:
 *   The buyer's delivery address is sent to the seller at order placement
 *   via on-chain `buyerInfoIpfs` (uploaded to IPFS at checkout time). This
 *   route is for SAVED preferences — a convenience layer above checkout —
 *   not for serving the address to sellers. Sellers never read this KV
 *   record; they read the IPFS hash from their order's buyerInfoIpfs field.
 *
 * Doug, Apr 29 2026.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { kv } from '@/lib/kv';

const MESSAGE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (matches seller pickup)

interface BuyerDeliveryRecord {
  address: string;
  phone?: string;
  notes?: string;
  updatedAt: string;
}

function deliveryKey(ownerAddress: string): string {
  return `buyer:delivery:${ownerAddress.toLowerCase()}`;
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
    console.error('[buyer/delivery] signature recovery failed:', err);
    return null;
  }
}

// ─── POST: buyer saves their delivery info ─────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, phone, notes, signature, message } = body || {};

    if (typeof address !== 'string' || address.trim().length === 0) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 });
    }
    if (typeof signature !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'signature + message required' }, { status: 400 });
    }

    if (!message.startsWith('LocalRoots: save my delivery address')) {
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

    // No role gate — any wallet can save its own delivery preferences.
    // (Different from seller pickup, which requires sellerIdByOwner > 0.)

    const record: BuyerDeliveryRecord = {
      address: address.trim().slice(0, 500),
      phone: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 50) : undefined,
      notes: typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : undefined,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(deliveryKey(signer), record);

    console.log('[buyer/delivery POST] saved for', signer);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[buyer/delivery POST] error:', err);
    return NextResponse.json({ error: 'failed to save delivery info' }, { status: 500 });
  }
}

// ─── GET: buyer reads their own saved record ───────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const isSelf = request.nextUrl.searchParams.get('self') === '1';
    const signature = request.nextUrl.searchParams.get('signature');
    const message = request.nextUrl.searchParams.get('message');

    if (!isSelf) {
      // Currently the only supported path is self-read. (Sellers don't read
      // the KV record directly — they read buyerInfoIpfs from on-chain order
      // metadata. This is by design: the saved record is the buyer's
      // PREFERENCE, not the per-order shipping data.)
      return NextResponse.json({ error: 'only self=1 supported' }, { status: 400 });
    }

    if (!signature || !message) {
      return NextResponse.json({ error: 'signature, message required' }, { status: 400 });
    }

    if (!message.startsWith('LocalRoots: view my delivery')) {
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

    const record = await kv.get<BuyerDeliveryRecord>(deliveryKey(signer));

    if (!record) {
      return NextResponse.json({ address: '', phone: '', notes: '' });
    }

    return NextResponse.json({
      address: record.address,
      phone: record.phone || '',
      notes: record.notes || '',
    });
  } catch (err) {
    console.error('[buyer/delivery GET] error:', err);
    return NextResponse.json({ error: 'failed to fetch delivery info' }, { status: 500 });
  }
}
