/**
 * Shared-secret bearer auth for the server-to-server Collections
 * sync API used by Common Area NIF. Simple, rotatable, one token.
 *
 * Set `COLLECTIONS_SYNC_TOKEN` in Vercel env vars. Rotate quarterly.
 * If the env var is missing, every request is rejected (fail-closed).
 */

import { timingSafeEqual } from 'node:crypto';

export type AuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 500; error: string };

export function requireSyncAuth(req: Request): AuthResult {
  const expected = process.env.COLLECTIONS_SYNC_TOKEN;
  if (!expected || expected.length < 16) {
    return {
      ok: false,
      status: 500,
      error: 'COLLECTIONS_SYNC_TOKEN not configured on server',
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
