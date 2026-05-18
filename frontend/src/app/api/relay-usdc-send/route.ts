import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createFreshPublicClient, createFreshWalletClient } from '@/lib/viemClient';
import {
  USDC_ADDRESS,
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
} from '@/lib/contracts/marketplace';
import { DISPUTE_RESOLUTION_ADDRESS } from '@/lib/contracts/disputeResolution';
import { kv } from '@/lib/kv';

/**
 * Gasless USDC Send relay for /wallet's Send flow.
 *
 * Problem this solves: Privy embedded wallets hold no ETH by design
 * (Doug's hard rule: "Users should never have to have ETH. We have a
 * funded account of ETH for that."). The default Send flow tries a direct
 * `usdc.transfer()` from the Privy wallet, which reverts with
 * "insufficient funds for gas * price + value: have 0 want ..." because
 * the wallet has no ETH for gas. Verified May 18 2026 on Doug's incognito
 * Privy wallet (`dougcalahan@commonarea.ai`, balance ~$16.83 USDC).
 *
 * Architecture: mirrors the `/api/relay-permit` pattern shipped Apr 27
 * for the buyer-approve flow. The user signs an EIP-2612 permit off-chain
 * (free, no ETH needed) granting our relayer authority to spend N USDC.
 * The relayer then calls `usdc.permit(...)` + `usdc.transferFrom(owner,
 * recipient, amount)` in sequence, paying gas for both. Net: user moves
 * USDC without ever holding ETH; the relayer pays ~$0.0005 per send.
 *
 * Why a separate endpoint from /api/relay-permit:
 *   - Different spender allowlist: Send permits go to the RELAYER, not
 *     the marketplace. Mixing them would let an exploit on this endpoint
 *     redirect funds through the marketplace contract.
 *   - Different validation: Send needs recipient-address validation;
 *     approve doesn't.
 *   - Different rate limits: Send is user-initiated infrequent action;
 *     approve fires once per cart and is more common.
 *
 * Anti-patterns:
 *   - Do NOT relax the recipient allowlist to include LocalRoots contracts.
 *     If a user wants to fund the marketplace, they buy. If a user wants
 *     to send to a contract, they need to know what they're doing — and
 *     this endpoint isn't the right primitive for that.
 *   - Do NOT add an "infinite allowance to the relayer" optimization to
 *     skip the per-Send permit. Per-Send permits are the security model:
 *     each Send authorizes exactly N USDC, no more.
 */

const ALLOWED_TOKENS = [USDC_ADDRESS.toLowerCase()];

// Recipient is FORBIDDEN from being any LocalRoots contract address.
// This endpoint is "send my USDC to a friend / another wallet" — not a
// back door for buying from the marketplace or paying ambassadors.
const FORBIDDEN_RECIPIENTS = new Set([
  MARKETPLACE_ADDRESS.toLowerCase(),
  AMBASSADOR_REWARDS_ADDRESS.toLowerCase(),
  DISPUTE_RESOLUTION_ADDRESS.toLowerCase(),
  USDC_ADDRESS.toLowerCase(), // sending USDC to the USDC contract = burning it
  '0x0000000000000000000000000000000000000000',
]);

// Hard cap per Send: $1000 USDC = 1_000_000_000 base units. Generous for
// a marketplace-buyer use case, conservative for v1 abuse defense. Raise
// after we see real usage patterns.
const MAX_SEND_USDC_UNITS = 1_000_000_000n;

// Rate limit per owner per UTC day. KV-backed (durable across redeploys,
// shared across regions). Same key pattern as the relayer-topup endpoint.
const MAX_SENDS_PER_OWNER_PER_DAY = 10;

const permitAbi = [
  {
    type: 'function',
    name: 'permit',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

const transferFromAbi = [
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function isRateLimited(owner: string): Promise<boolean> {
  const key = `relay-usdc-send:${owner.toLowerCase()}:${todayUtc()}`;
  const count = (await kv.get<number>(key)) ?? 0;
  return count >= MAX_SENDS_PER_OWNER_PER_DAY;
}

async function incrementRateLimit(owner: string): Promise<void> {
  const key = `relay-usdc-send:${owner.toLowerCase()}:${todayUtc()}`;
  const current = (await kv.get<number>(key)) ?? 0;
  // Matches the relayer-topup pattern: simple counter, no TTL. Keys are
  // tiny (under 100 bytes each) and rate of growth is bounded by daily
  // send caps × active users.
  await kv.set(key, current + 1);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, owner, recipient, amount, deadline, v, r, s } = body;

    // Required-field validation up front.
    if (
      !token ||
      !owner ||
      !recipient ||
      amount === undefined ||
      deadline === undefined ||
      v === undefined ||
      !r ||
      !s
    ) {
      return NextResponse.json(
        { error: 'Missing fields: need token, owner, recipient, amount, deadline, v, r, s' },
        { status: 400 },
      );
    }

    const tokenLower = (token as string).toLowerCase();
    const ownerLower = (owner as string).toLowerCase();
    const recipientLower = (recipient as string).toLowerCase();

    // Address format validation — rough check, prevents obvious malformed input.
    if (!/^0x[a-fA-F0-9]{40}$/.test(ownerLower) || !/^0x[a-fA-F0-9]{40}$/.test(recipientLower)) {
      return NextResponse.json(
        { error: 'owner and recipient must be 0x-prefixed 40-hex-char addresses' },
        { status: 400 },
      );
    }

    if (!ALLOWED_TOKENS.includes(tokenLower)) {
      return NextResponse.json(
        { error: 'Token not allowed for gasless send (USDC only)' },
        { status: 403 },
      );
    }

    if (FORBIDDEN_RECIPIENTS.has(recipientLower)) {
      return NextResponse.json(
        { error: 'Cannot send to that address via this endpoint' },
        { status: 403 },
      );
    }

    if (ownerLower === recipientLower) {
      return NextResponse.json(
        { error: 'Cannot send to your own address' },
        { status: 400 },
      );
    }

    // Amount cap.
    let amountBigint: bigint;
    try {
      amountBigint = BigInt(amount);
    } catch {
      return NextResponse.json({ error: 'amount must be a valid uint256 string' }, { status: 400 });
    }
    if (amountBigint <= 0n) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
    }
    if (amountBigint > MAX_SEND_USDC_UNITS) {
      return NextResponse.json(
        {
          error: `Send amount exceeds per-tx cap of $${Number(MAX_SEND_USDC_UNITS) / 1_000_000}`,
        },
        { status: 400 },
      );
    }

    // Deadline check.
    const now = Math.floor(Date.now() / 1000);
    if (Number(deadline) < now) {
      const expiredSecondsAgo = now - Number(deadline);
      return NextResponse.json(
        { error: `Permit expired ${expiredSecondsAgo}s ago. Re-sign with a fresh deadline.` },
        { status: 400 },
      );
    }

    // Rate limit per owner per UTC day.
    if (await isRateLimited(ownerLower)) {
      return NextResponse.json(
        {
          error: `Daily send limit reached (${MAX_SENDS_PER_OWNER_PER_DAY} per day). Try again tomorrow.`,
        },
        { status: 429 },
      );
    }

    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.error('[Relay-USDC-Send] RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }

    const account = privateKeyToAccount(relayerPrivateKey as `0x${string}`);
    const relayerAddress = account.address;
    const walletClient = createFreshWalletClient(account);
    const publicClient = createFreshPublicClient();

    console.log('[Relay-USDC-Send] Submitting permit + transferFrom:', {
      token: tokenLower,
      owner: ownerLower,
      recipient: recipientLower,
      amount: amountBigint.toString(),
      deadline: String(deadline),
    });

    // ─── Step 1: permit() — relayer becomes authorized spender ───────
    // The user signed an EIP-2612 permit naming the RELAYER as spender.
    // After this call, the relayer can `transferFrom` up to `amount`
    // USDC from the owner's wallet. The permit is one-shot — its nonce
    // is consumed, so subsequent Sends require fresh signatures.
    const permitHash = await walletClient.writeContract({
      address: token as Address,
      abi: permitAbi,
      functionName: 'permit',
      args: [
        ownerLower as Address,
        relayerAddress,
        amountBigint,
        BigInt(deadline),
        Number(v),
        r as `0x${string}`,
        s as `0x${string}`,
      ],
    });

    console.log('[Relay-USDC-Send] Permit submitted:', permitHash);

    const permitReceipt = await publicClient.waitForTransactionReceipt({
      hash: permitHash,
      timeout: 60_000,
    });

    if (permitReceipt.status === 'reverted') {
      return NextResponse.json(
        {
          error:
            'Permit transaction reverted. Signature, nonce, or deadline likely failed verification.',
          permitHash,
        },
        { status: 500 },
      );
    }

    // ─── Step 2: transferFrom() — actually move the USDC ─────────────
    // With the allowance in place, the relayer pulls the USDC from
    // owner → recipient. Both transactions are paid for by the relayer's
    // ETH balance.
    const transferHash = await walletClient.writeContract({
      address: token as Address,
      abi: transferFromAbi,
      functionName: 'transferFrom',
      args: [ownerLower as Address, recipientLower as Address, amountBigint],
    });

    console.log('[Relay-USDC-Send] TransferFrom submitted:', transferHash);

    const transferReceipt = await publicClient.waitForTransactionReceipt({
      hash: transferHash,
      timeout: 60_000,
    });

    if (transferReceipt.status === 'reverted') {
      // Permit landed but transfer reverted — that means owner's USDC
      // balance is less than `amount` (the permit only sets allowance,
      // it doesn't guarantee balance). Surface a clean error.
      return NextResponse.json(
        {
          error: 'Transfer reverted on-chain. Sender may not have enough USDC.',
          permitHash,
          transferHash,
        },
        { status: 500 },
      );
    }

    // Increment rate limit ONLY on confirmed success — failed sends don't
    // count against the user's quota.
    await incrementRateLimit(ownerLower);

    return NextResponse.json({
      success: true,
      permitHash,
      transferHash,
      status: transferReceipt.status,
    });
  } catch (error) {
    console.error('[Relay-USDC-Send] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer has insufficient funds. Please notify the team.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: `Gasless send failed: ${message}` },
      { status: 500 },
    );
  }
}
