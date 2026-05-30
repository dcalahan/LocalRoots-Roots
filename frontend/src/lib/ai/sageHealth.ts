/**
 * Sage provider health — visibility + warnings for the Venice→Claude fallback.
 *
 * Venice's `streamFromVenice` / `completeFromVenice` paths surface response
 * headers we never captured before:
 *   - x-venice-balance-diem   — daily inference allocation (resets at epoch)
 *   - x-venice-balance-usd    — pay-as-you-go buffer
 *   - x-ratelimit-{limit,remaining,reset}-{requests,tokens}
 *
 * Without those headers, the fallback to Claude is **silent** — Sage's voice
 * subtly changes (Grok → Haiku) and the operator has no signal. This module
 * is the visibility layer:
 *
 *   1. Per-call structured log → Vercel logs (greppable: `[Sage] venice ok`)
 *   2. Threshold WARN log     → distinct prefix (`[Sage] WARN low ...`)
 *   3. FALLBACK log           → `[Sage] FALLBACK venice→claude reason=...`
 *   4. KV snapshot           → admin endpoint surfaces current health
 *
 * No alerting wired here — that's a follow-up. Slack ping on fallback is the
 * highest-leverage notification (it's the silent failure mode) but it needs
 * a webhook URL Doug hasn't provided yet. When he does, hook it into
 * `recordVeniceFallback` below.
 *
 * KV keys (app metadata, not user-owned — track in CLAUDE.md KV table):
 *   - sage:venice:lastSuccess         — { ts, model, balances, rpm, tpm }
 *   - sage:venice:lastFallback        — { ts, reason, source }
 *   - sage:venice:fallbacks:{YYYYMMDD} — number (today's count, race-tolerant)
 */

import { kv } from '@/lib/kv';

// ─── Thresholds (Doug-tunable) ─────────────────────────────

/** Warn when DIEM balance drops below this. Current daily grant ~19.35 → 5 ≈ 25%. */
const DIEM_LOW_THRESHOLD = 5;
/** Warn when USD pay-as-you-go buffer drops below $1. */
const USD_LOW_THRESHOLD = 1;
/** Warn when remaining RPM falls below this fraction of the limit. */
const RPM_LOW_FRACTION = 0.1;
/** Warn when remaining TPM falls below this fraction of the limit. */
const TPM_LOW_FRACTION = 0.1;

// ─── Types ─────────────────────────────────────────────────

export interface VeniceHealthSnapshot {
  ts: string;
  model: string;
  source: 'stream' | 'extract';
  balances: {
    diem: number | null;
    usd: number | null;
  };
  rpm: {
    remaining: number | null;
    limit: number | null;
  };
  tpm: {
    remaining: number | null;
    limit: number | null;
  };
  /** Which thresholds (if any) tripped on this call. Empty array = healthy. */
  warnings: string[];
}

export interface VeniceFallbackRecord {
  ts: string;
  reason: string;
  source: 'stream' | 'extract';
}

// ─── Header parsing ────────────────────────────────────────

/** Pull a numeric header, tolerating null/missing/malformed. */
function num(headers: Headers, name: string): number | null {
  const raw = headers.get(name);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a snapshot from a Venice response. Pure — no side effects.
 * Caller passes the response from OpenAI SDK's .withResponse(),
 * which exposes the raw fetch Response with headers.
 */
export function buildVeniceSnapshot(
  headers: Headers,
  model: string,
  source: 'stream' | 'extract',
): VeniceHealthSnapshot {
  const diem = num(headers, 'x-venice-balance-diem');
  const usd = num(headers, 'x-venice-balance-usd');
  const rpmRem = num(headers, 'x-ratelimit-remaining-requests');
  const rpmLim = num(headers, 'x-ratelimit-limit-requests');
  const tpmRem = num(headers, 'x-ratelimit-remaining-tokens');
  const tpmLim = num(headers, 'x-ratelimit-limit-tokens');

  const warnings: string[] = [];
  if (diem !== null && diem < DIEM_LOW_THRESHOLD) {
    warnings.push(`diem=${diem.toFixed(2)} (< ${DIEM_LOW_THRESHOLD})`);
  }
  if (usd !== null && usd < USD_LOW_THRESHOLD) {
    warnings.push(`usd=$${usd.toFixed(2)} (< $${USD_LOW_THRESHOLD})`);
  }
  if (rpmRem !== null && rpmLim !== null && rpmLim > 0 && rpmRem / rpmLim < RPM_LOW_FRACTION) {
    warnings.push(`rpm=${rpmRem}/${rpmLim} (< ${RPM_LOW_FRACTION * 100}%)`);
  }
  if (tpmRem !== null && tpmLim !== null && tpmLim > 0 && tpmRem / tpmLim < TPM_LOW_FRACTION) {
    warnings.push(`tpm=${tpmRem}/${tpmLim} (< ${TPM_LOW_FRACTION * 100}%)`);
  }

  return {
    ts: new Date().toISOString(),
    model,
    source,
    balances: { diem, usd },
    rpm: { remaining: rpmRem, limit: rpmLim },
    tpm: { remaining: tpmRem, limit: tpmLim },
    warnings,
  };
}

// ─── Logging ───────────────────────────────────────────────

function formatSnapshotLine(s: VeniceHealthSnapshot): string {
  const parts = [
    `model=${s.model}`,
    `source=${s.source}`,
    s.balances.diem !== null ? `diem=${s.balances.diem.toFixed(2)}` : 'diem=?',
    s.balances.usd !== null ? `usd=$${s.balances.usd.toFixed(2)}` : 'usd=?',
    s.rpm.remaining !== null && s.rpm.limit !== null
      ? `rpm=${s.rpm.remaining}/${s.rpm.limit}`
      : 'rpm=?',
    s.tpm.remaining !== null && s.tpm.limit !== null
      ? `tpm=${s.tpm.remaining}/${s.tpm.limit}`
      : 'tpm=?',
  ];
  return parts.join(' ');
}

// ─── Recording (logs + KV) ─────────────────────────────────

/**
 * Called after a successful Venice response. Logs the structured line,
 * emits a WARN if any threshold tripped, and writes the snapshot to KV.
 *
 * Best-effort KV write — observability, not critical path. Errors swallowed.
 */
export async function recordVeniceSuccess(snapshot: VeniceHealthSnapshot): Promise<void> {
  const line = formatSnapshotLine(snapshot);
  console.log(`[Sage] venice ok ${line}`);
  if (snapshot.warnings.length > 0) {
    console.warn(`[Sage] WARN low ${snapshot.warnings.join(' | ')} (${line})`);
  }
  try {
    await kv.set('sage:venice:lastSuccess', snapshot);
  } catch (err) {
    console.warn('[Sage] kv write lastSuccess failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Called when the Venice path fails and we fall back to Claude. Logs the
 * tagged FALLBACK line, persists the record, and increments today's counter.
 *
 * Counter is a read-modify-write — race-tolerant because the loss surface
 * is "missed +1 in the daily count" which is fine for observability.
 */
export async function recordVeniceFallback(
  reason: string,
  source: 'stream' | 'extract',
): Promise<void> {
  const record: VeniceFallbackRecord = {
    ts: new Date().toISOString(),
    reason: reason.slice(0, 500),
    source,
  };
  console.warn(`[Sage] FALLBACK venice→claude source=${source} reason=${record.reason}`);
  try {
    await kv.set('sage:venice:lastFallback', record);
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = `sage:venice:fallbacks:${day}`;
    const current = (await kv.get<number>(key)) ?? 0;
    await kv.set(key, current + 1);
  } catch (err) {
    console.warn('[Sage] kv write fallback failed:', err instanceof Error ? err.message : err);
  }
}

// ─── Read side (admin endpoint) ────────────────────────────

export interface SageHealthReport {
  provider: 'venice' | 'anthropic';
  veniceConfigured: boolean;
  lastSuccess: VeniceHealthSnapshot | null;
  lastFallback: VeniceFallbackRecord | null;
  fallbacksToday: number;
  thresholds: {
    diemLow: number;
    usdLow: number;
    rpmLowFraction: number;
    tpmLowFraction: number;
  };
}

export async function readSageHealth(
  activeProvider: 'venice' | 'anthropic',
  veniceConfigured: boolean,
): Promise<SageHealthReport> {
  const lastSuccess = await kv
    .get<VeniceHealthSnapshot>('sage:venice:lastSuccess')
    .catch(() => null);
  const lastFallback = await kv
    .get<VeniceFallbackRecord>('sage:venice:lastFallback')
    .catch(() => null);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fallbacksToday =
    (await kv.get<number>(`sage:venice:fallbacks:${day}`).catch(() => 0)) ?? 0;

  return {
    provider: activeProvider,
    veniceConfigured,
    lastSuccess,
    lastFallback,
    fallbacksToday,
    thresholds: {
      diemLow: DIEM_LOW_THRESHOLD,
      usdLow: USD_LOW_THRESHOLD,
      rpmLowFraction: RPM_LOW_FRACTION,
      tpmLowFraction: TPM_LOW_FRACTION,
    },
  };
}
