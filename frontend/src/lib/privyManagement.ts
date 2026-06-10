/**
 * Server-side Privy Management API client.
 *
 * Used to resolve `did:privy:...` → embedded wallet address (an Ethereum
 * `0x...`). This is the bridge between Sage's user identity (Privy DID)
 * and on-chain identity (wallet → sellerId via marketplace contract).
 *
 * Auth: Basic with `PRIVY_APP_ID:PRIVY_APP_SECRET`. Matches the pattern
 * already in `scripts/distribution/fetchPrivyUsers.ts` — first server-side
 * runtime use of the Management API.
 *
 * Fail-closed: returns null on any error (missing env, network, 4xx/5xx,
 * malformed response). Callers must handle null.
 */

const PRIVY_BASE_URL = 'https://auth.privy.io/api/v1';

/**
 * Privy's REST API returns snake_case fields on user records
 * (`linked_accounts`, `wallet_client_type`, `chain_type`). Some Privy
 * SDKs / older docs camelCase them. We accept either to be safe — the
 * distribution script's PrivyUser type assumed camelCase and silently
 * mismatched the snake_case live API. Curl-verified June 10 2026.
 */
interface PrivyLinkedAccountRaw {
  type?: string;
  address?: string;
  chain_type?: string;
  chainType?: string;
  wallet_client_type?: string;
  walletClientType?: string;
}

interface PrivyUserRaw {
  id?: string;
  linked_accounts?: PrivyLinkedAccountRaw[];
  linkedAccounts?: PrivyLinkedAccountRaw[];
}

function getLinkedAccounts(user: PrivyUserRaw): PrivyLinkedAccountRaw[] {
  return user.linked_accounts ?? user.linkedAccounts ?? [];
}

function getChainType(a: PrivyLinkedAccountRaw): string | undefined {
  return a.chain_type ?? a.chainType;
}

function getWalletClientType(a: PrivyLinkedAccountRaw): string | undefined {
  return a.wallet_client_type ?? a.walletClientType;
}

function basicAuth(): string | null {
  const id = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  if (!id || !secret) return null;
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

/**
 * Resolve a Privy DID to the user's Ethereum embedded wallet address.
 * Returns null if anything fails (missing env, unknown user, no wallet).
 *
 * Example: getPrivyEmbeddedWallet('did:privy:cmazyy123') → '0xabc...'
 */
export async function getPrivyEmbeddedWallet(
  did: string,
): Promise<`0x${string}` | null> {
  if (!did.startsWith('did:privy:')) return null;
  const auth = basicAuth();
  if (!auth) {
    console.warn('[Privy] getPrivyEmbeddedWallet: missing PRIVY_APP_ID or PRIVY_APP_SECRET');
    return null;
  }

  const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
  const url = `${PRIVY_BASE_URL}/users/${encodeURIComponent(did)}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: auth,
        'privy-app-id': appId,
        'Content-Type': 'application/json',
      },
      // Privy responds within ~200ms typically; cap at 5s.
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '<no body>');
      console.warn(
        `[Privy] getPrivyEmbeddedWallet ${did.slice(0, 20)}... → HTTP ${res.status}: ${errBody.slice(0, 200)}`,
      );
      return null;
    }
    const user = (await res.json()) as PrivyUserRaw;
    const accounts = getLinkedAccounts(user);
    const embedded = accounts.find(
      (a) =>
        a.type === 'wallet' &&
        getWalletClientType(a) === 'privy' &&
        getChainType(a) === 'ethereum' &&
        typeof a.address === 'string',
    );
    if (!embedded) {
      console.warn(
        `[Privy] getPrivyEmbeddedWallet ${did.slice(0, 20)}... → no embedded ethereum wallet on user (linked_accounts: ${accounts.length})`,
      );
    }
    return (embedded?.address as `0x${string}`) || null;
  } catch (err) {
    console.warn(
      `[Privy] getPrivyEmbeddedWallet ${did.slice(0, 20)}... → ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}
