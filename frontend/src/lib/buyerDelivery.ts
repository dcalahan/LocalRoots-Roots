/**
 * Client-side helpers for the buyer-saved-delivery-address endpoints.
 *
 * Mirrors the seller-pickup pattern (lib/sellerPickup.ts) for symmetric
 * privacy handling. All operations require a wallet signature on a fixed
 * message format. This module is the single source of truth for those
 * message formats — the API route validates against the same prefixes.
 *
 * Usage:
 *   const { signMessageAsync } = useSignMessage();
 *   const record = await fetchOwnDelivery({
 *     signMessage: (msg) => signMessageAsync({ message: msg }),
 *   });
 *   // record is { address, phone, notes } or null
 *
 * Doug, Apr 29 2026.
 */

const MSG_SAVE_PREFIX = 'LocalRoots: save my delivery address';
const MSG_VIEW_OWN_PREFIX = 'LocalRoots: view my delivery';

// Same-device localStorage cache. KV is the durable cross-device store
// (signature-gated); localStorage is the no-sign-required fast read layer
// for the SAME browser. Keep them in sync — saveDelivery writes both.
const LOCAL_CACHE_KEY = 'localroots:buyer:delivery';

function nowIso(): string {
  return new Date().toISOString();
}

export function buildSaveMessage(): string {
  return `${MSG_SAVE_PREFIX} @ ${nowIso()}`;
}

export function buildViewOwnMessage(): string {
  return `${MSG_VIEW_OWN_PREFIX} @ ${nowIso()}`;
}

export interface BuyerDeliveryRecord {
  address: string;
  phone: string;
  notes: string;
}

/**
 * Read the localStorage cache. No signature required. Same-device only.
 * Returns null if no cache exists (first-time buyer on this device).
 *
 * Use this in checkout / delivery-form mounts as the default pre-fill
 * source. Falls back to fetchOwnDelivery (signed) for cross-device sync
 * via an explicit user action.
 */
export function readLocalDelivery(): BuyerDeliveryRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      address: data.address || '',
      phone: data.phone || '',
      notes: data.notes || '',
    };
  } catch {
    return null;
  }
}

/** Write to the localStorage cache. Called automatically by saveDelivery. */
function writeLocalDelivery(record: BuyerDeliveryRecord) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(record));
  } catch {
    // Quota exceeded or storage disabled — non-fatal, KV is the source of truth.
  }
}

/** Sign-and-POST: save buyer delivery info to KV AND localStorage. */
export async function saveDelivery(opts: {
  address: string;
  phone?: string;
  notes?: string;
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
    const res = await fetch('/api/buyer/delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: opts.address,
        phone: opts.phone,
        notes: opts.notes,
        signature,
        message,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'save failed' };

    // Mirror to localStorage for fast same-device pre-fill.
    writeLocalDelivery({
      address: opts.address,
      phone: opts.phone || '',
      notes: opts.notes || '',
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network error' };
  }
}

/**
 * Sign-and-GET: buyer reads their own saved delivery record.
 *
 * Returns the record (with empty strings for missing fields) on success,
 * or null if the signature is rejected, network fails, or no record
 * exists yet for this wallet. Callers shouldn't differentiate "no record"
 * from "fetch failed" — both mean "no pre-fill data available."
 */
export async function fetchOwnDelivery(opts: {
  signMessage: (msg: string) => Promise<`0x${string}`>;
}): Promise<BuyerDeliveryRecord | null> {
  const message = buildViewOwnMessage();
  let signature: `0x${string}`;
  try {
    signature = await opts.signMessage(message);
  } catch {
    return null;
  }

  try {
    const params = new URLSearchParams({ self: '1', signature, message });
    const res = await fetch(`/api/buyer/delivery?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const record = {
      address: data.address || '',
      phone: data.phone || '',
      notes: data.notes || '',
    };
    // Refresh the same-device cache from the authoritative server record.
    if (record.address) writeLocalDelivery(record);
    return record;
  } catch {
    return null;
  }
}
