/**
 * HS256 JWT for the Cypress Marsh label-store deep link.
 *
 * Contract (locked with Doug, June 4 2026):
 *   - alg: HS256, kid: "v1"
 *   - iss: "https://www.localroots.love"
 *   - aud: "cypress-marsh-labels"
 *   - sub: Privy DID (e.g. "did:privy:cmazyy...")
 *   - iat: now
 *   - exp: iat + 900 (15 min)
 *   - jti: random UUID — label store enforces single-use within TTL
 *
 * Shared secret in `LABEL_STORE_JWT_SECRET` env var (32+ bytes,
 * base64-encoded random). Mirror this exact value to the label store side.
 *
 * The label-store landing URL is HARDCODED here — if the hostname ever
 * changes both sides re-deploy in lockstep.
 */

import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';

const ISSUER = 'https://www.localroots.love';
const AUDIENCE = 'cypress-marsh-labels';
const LABEL_STORE_START_URL = 'https://labels.cypressmarshgardensupplies.com/start';
const KID = 'v1';
const TTL_SECONDS = 15 * 60;

export interface MintedLabelLink {
  /** Full URL the user clicks: `https://labels.../start?t=<jwt>`. */
  url: string;
  /** Unix timestamp (seconds) when the JWT expires. */
  expiresAt: number;
  /** Unique token id for the label store's single-use enforcement. */
  jti: string;
}

/**
 * Mint a signed deep link for a gardener. Returns null if the secret is
 * unconfigured (fail-closed). Caller must check.
 */
export async function mintLabelLink(privyDid: string): Promise<MintedLabelLink | null> {
  const secret = process.env.LABEL_STORE_JWT_SECRET;
  if (!secret || secret.length < 32) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TTL_SECONDS;
  const jti = randomUUID();

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: KID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(privyDid)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(new TextEncoder().encode(secret));

  const url = `${LABEL_STORE_START_URL}?t=${encodeURIComponent(jwt)}`;
  return { url, expiresAt: exp, jti };
}
