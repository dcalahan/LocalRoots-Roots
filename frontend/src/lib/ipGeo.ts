/**
 * Vercel IP geolocation helper.
 *
 * Vercel auto-injects geo-derived headers on every server request. This
 * helper extracts them into a consistent shape we pass to credit() and
 * other anti-fraud surfaces.
 *
 * Source headers (all best-effort, may be undefined):
 *   - x-vercel-ip-country         → ISO country code (US, CA, GB, ...)
 *   - x-vercel-ip-country-region  → region/state code (e.g. SC for South Carolina)
 *   - x-vercel-ip-city            → city name (URL-encoded)
 *
 * Privacy & retention:
 *
 * Doug's call (May 16 2026): capture **first-seen** IP geo per user
 * earning Roots Points, so the admin RP Monitor can flag suspect
 * cross-border activity (the off-chain RP pool is a sybil-farm magnet).
 * Retention policy: **PURGE post-airdrop-snapshot**. Once the merkle is
 * signed and the airdrop is distributed, the user-meta records get
 * deleted. The data exists only to defend the airdrop's fairness, not
 * for general user tracking.
 *
 * No client-side fallback: we use only server-injected headers. We do
 * NOT ask the browser for geolocation here. (Sage has a separate flow
 * for that, but it's opt-in and used for gardening advice, not
 * anti-fraud.)
 */

import type { NextRequest } from 'next/server';

export interface IpGeoMeta {
  country?: string;
  region?: string;
  city?: string;
}

/**
 * Extract Vercel's IP-geo headers from a request. Returns an empty
 * object (not null) when no headers are present — easy to spread into
 * downstream payloads without nullish-handling at every call site.
 */
export function getIpGeoFromRequest(request: NextRequest): IpGeoMeta {
  const country = request.headers.get('x-vercel-ip-country') || undefined;
  const region = request.headers.get('x-vercel-ip-country-region') || undefined;
  const cityRaw = request.headers.get('x-vercel-ip-city') || undefined;
  // Vercel URL-encodes city names with spaces ("Hilton%20Head%20Island")
  let city: string | undefined;
  if (cityRaw) {
    try { city = decodeURIComponent(cityRaw); }
    catch { city = cityRaw; }
  }
  return { country, region, city };
}
