import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createFreshPublicClient, createFreshWalletClient } from '@/lib/viemClient';
import { USDC_ADDRESS, MARKETPLACE_ADDRESS } from '@/lib/contracts/marketplace';

// EIP-2612 permit for ERC-20 token approval, relayed by our funded relayer.
// This route exists because USDC's `approve()` is not ERC-2771 forwardable —
// USDC doesn't inherit ERC2771Context, so a forwarder call would set the
// allowance on the FORWARDER's address, not the user's. The architectural
// way out (without making the user hold ETH) is EIP-2612: user signs a
// typed message off-chain (free), our relayer submits `permit(...)` and
// pays gas. The on-chain allowance ends up correctly attributed to the user.
//
// This is the buyer-side equivalent of /api/relay (which handles the actual
// purchase via the marketplace's ERC2771Forwarder). Together they cover the
// full credit-card-buyer flow with zero user ETH.

// Whitelist tokens that we know support EIP-2612 with the standard typehash.
// USDC v2.2 on Base mainnet ships with permit; USDT on Base is more
// inconsistent — gate to USDC for now and add USDT only after on-chain
// verification of its permit implementation.
const ALLOWED_PERMIT_TOKENS = [USDC_ADDRESS.toLowerCase()];

// Whitelist spenders to prevent the relayer from being used to set arbitrary
// allowances elsewhere. Only the marketplace (our purchase escrow) is allowed.
const ALLOWED_SPENDERS = [MARKETPLACE_ADDRESS.toLowerCase()];

// EIP-2612 permit ABI fragment (standard across compliant ERC-20s).
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

// Rate limiting per owner address. Mirrors /api/relay so the per-user budget
// is shared across both endpoints — abuse defense lives at the relayer level.
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(address: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(address.toLowerCase());

  if (!record || now > record.resetAt) {
    requestCounts.set(address.toLowerCase(), { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, owner, spender, value, deadline, v, r, s } = body;

    // Validate required fields up front. Missing any of these means the
    // client built a malformed request — short-circuit before touching chain.
    if (
      !token ||
      !owner ||
      !spender ||
      value === undefined ||
      deadline === undefined ||
      v === undefined ||
      !r ||
      !s
    ) {
      return NextResponse.json(
        { error: 'Missing fields: need token, owner, spender, value, deadline, v, r, s' },
        { status: 400 }
      );
    }

    // Validate token is in our permit whitelist.
    const tokenLower = (token as string).toLowerCase();
    if (!ALLOWED_PERMIT_TOKENS.includes(tokenLower)) {
      return NextResponse.json(
        { error: 'Token not allowed for permit relay' },
        { status: 403 }
      );
    }

    // Validate spender — only the marketplace can be approved via this relay.
    const spenderLower = (spender as string).toLowerCase();
    if (!ALLOWED_SPENDERS.includes(spenderLower)) {
      return NextResponse.json(
        { error: 'Spender not allowed for permit relay' },
        { status: 403 }
      );
    }

    // Rate limit per owner (the address whose allowance is being set).
    if (isRateLimited(owner)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    // Reject expired permits up front. Even if we tried, the on-chain
    // permit() would revert — better to give the client a clean error so
    // it can re-sign with a fresh deadline.
    const now = Math.floor(Date.now() / 1000);
    if (Number(deadline) < now) {
      const expiredSecondsAgo = now - Number(deadline);
      console.log(`[Relay-Permit] Request expired ${expiredSecondsAgo}s ago`);
      return NextResponse.json(
        { error: `Permit expired ${expiredSecondsAgo}s ago. Re-sign with a fresh deadline.` },
        { status: 400 }
      );
    }

    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.error('[Relay-Permit] RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }

    const account = privateKeyToAccount(relayerPrivateKey as `0x${string}`);
    const walletClient = createFreshWalletClient(account);
    const publicClient = createFreshPublicClient();

    console.log('[Relay-Permit] Submitting permit:', {
      token: tokenLower,
      owner,
      spender: spenderLower,
      value: String(value),
      deadline: String(deadline),
    });

    // Submit the permit. If the signature is bad, the deadline is wrong, or
    // the nonce is stale, this reverts and we surface a clean error.
    const txHash = await walletClient.writeContract({
      address: token as Address,
      abi: permitAbi,
      functionName: 'permit',
      args: [
        owner as Address,
        spender as Address,
        BigInt(value),
        BigInt(deadline),
        Number(v),
        r as `0x${string}`,
        s as `0x${string}`,
      ],
    });

    console.log('[Relay-Permit] Transaction submitted:', txHash);

    // Server-side wait for receipt — same pattern as /api/relay so the
    // client doesn't need to poll mainnet.base.org from the browser
    // (which 403s under load).
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    console.log('[Relay-Permit] Receipt status:', receipt.status);

    if (receipt.status === 'reverted') {
      return NextResponse.json(
        {
          error:
            'Permit transaction reverted on-chain. The signature, nonce, or deadline likely failed verification.',
          transactionHash: txHash,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      status: receipt.status,
    });
  } catch (error) {
    console.error('[Relay-Permit] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer has insufficient funds. Please notify the team.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Permit failed: ${message}` },
      { status: 500 }
    );
  }
}
