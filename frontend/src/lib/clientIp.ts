/**
 * Resolve the originating client IP from a Next.js request.
 *
 * Used by Coinbase session-token endpoints (onramp + offramp) to satisfy
 * Coinbase's `clientIp` requirement on the session-token API. Per CDP
 * support (May 2 2026): "this parameter is required for security
 * validation to ensure the quote can only be used by the originating
 * user."
 *
 * Vercel sets several headers; we check in priority order:
 *   1. `x-vercel-forwarded-for` — Vercel's authoritative client IP
 *      (also used internally for x-vercel-ip-* geolocation)
 *   2. `x-forwarded-for` — standard proxy header; first IP in the list
 *      is the original client
 *   3. `x-real-ip` — common reverse-proxy fallback
 *
 * Returns null if none are present (e.g. local dev or non-Vercel hosting).
 * Callers should decide whether null is a fail-closed condition or a
 * skip-the-parameter condition. Coinbase's validation will reject sessions
 * with a missing clientIp where required, so callers MUST send the
 * parameter when present and degrade gracefully when absent.
 */

import type { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest): string | null {
  // Vercel-specific (most authoritative on Vercel).
  const xVercel = req.headers.get('x-vercel-forwarded-for');
  if (xVercel) return xVercel.split(',')[0].trim();

  // Standard proxy header. Comma-separated list — client is leftmost.
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();

  // Fallback for non-Vercel reverse proxies.
  const xReal = req.headers.get('x-real-ip');
  if (xReal) return xReal.trim();

  return null;
}
