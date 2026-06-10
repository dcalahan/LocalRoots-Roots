/**
 * Bearer auth for partner integrations (server-to-server).
 *
 * Each partner gets its own env-var-stored key (e.g.
 * `PARTNER_API_KEY_CYPRESS_MARSH`). This factory builds an auth-checker
 * bound to that env var. timingSafeEqual prevents trivial timing attacks.
 *
 * Fail-closed: if the env var is missing the request is rejected with 500
 * (server misconfigured) rather than letting traffic through. Matches the
 * pattern in `lib/syncAuth.ts`.
 */

import { timingSafeEqual } from 'node:crypto';

export type PartnerAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

export function requirePartnerAuth(
  req: Request,
  envVarName: string,
): PartnerAuthResult {
  const expected = process.env[envVarName];
  if (!expected || expected.length < 16) {
    return {
      ok: false,
      status: 500,
      error: `${envVarName} not configured on server`,
    };
  }

  const header = req.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'Missing Bearer token' };
  }

  const provided = match[1].trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return { ok: false, status: 401, error: 'Invalid token' };
  }
  if (!timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Invalid token' };
  }

  return { ok: true };
}
