/**
 * Client-side helpers for the seller pickup privacy endpoints.
 *
 * All three operations (seller saves, seller reads own, buyer reads for order)
 * require a wallet signature on a fixed message format. This module is the
 * single source of truth for those message formats — the API route validates
 * against the same prefixes.
 */

const MSG_SAVE_PREFIX = 'LocalRoots: save my pickup address';
const MSG_VIEW_OWN_PREFIX = 'LocalRoots: view my pickup';
const MSG_VIEW_ORDER_PREFIX = 'LocalRoots: view pickup for order';

function nowIso(): string {
  return new Date().toISOString();
}

export function buildSaveMessage(): string {
  return `${MSG_SAVE_PREFIX} @ ${nowIso()}`;
}

export function buildViewOwnMessage(): string {
  return `${MSG_VIEW_OWN_PREFIX} @ ${nowIso()}`;
}

export function buildViewOrderMessage(orderId: bigint | string): string {
  return `${MSG_VIEW_ORDER_PREFIX} ${orderId.toString()} @ ${nowIso()}`;
}

/** Sign-and-POST: save pickup info (seller). */
export async function savePickup(opts: {
  address: string;
  phone?: string;
  signMessage: (msg: string) => Promise<`0x${string}`>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const message = buildSaveMessage();
  let signature: `0x${string}`;
  try {
    signature = await opts.signMessage(message);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'signature cancelled',
    };
  }

  try {
    const res = await fetch('/api/seller/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: opts.address,
        phone: opts.phone,
        signature,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'save failed' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network error' };
  }
}

/** Sign-and-GET: seller reads their own pickup record (for edit pre-fill). */
export async function fetchOwnPickup(opts: {
  signMessage: (msg: string) => Promise<`0x${string}`>;
}): Promise<{ address: string; phone: string } | null> {
  const message = buildViewOwnMessage();
  let signature: `0x${string}`;
  try {
    signature = await opts.signMessage(message);
  } catch {
    return null;
  }

  try {
    const params = new URLSearchParams({ self: '1', signature, message });
    const res = await fetch(`/api/seller/pickup?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return { address: data.address || '', phone: data.phone || '' };
  } catch {
    return null;
  }
}

/** Sign-and-GET: buyer reads pickup for one of their accepted-or-later pickup orders. */
export async function fetchPickupForOrder(opts: {
  orderId: bigint | string;
  signMessage: (msg: string) => Promise<`0x${string}`>;
}): Promise<
  | { ok: true; address: string; phone?: string }
  | { ok: false; error: string; status: number }
> {
  const message = buildViewOrderMessage(opts.orderId);
  let signature: `0x${string}`;
  try {
    signature = await opts.signMessage(message);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'signature cancelled',
      status: 0,
    };
  }

  try {
    const params = new URLSearchParams({
      orderId: opts.orderId.toString(),
      signature,
      message,
    });
    const res = await fetch(`/api/seller/pickup?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'fetch failed', status: res.status };
    }
    return { ok: true, address: data.address, phone: data.phone };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'network error',
      status: 0,
    };
  }
}
