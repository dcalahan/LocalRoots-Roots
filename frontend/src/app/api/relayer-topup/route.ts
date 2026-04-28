import { NextRequest, NextResponse } from 'next/server';
import { type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createFreshPublicClient, createFreshWalletClient } from '@/lib/viemClient';
import { USDC_ADDRESS } from '@/lib/contracts/marketplace';
import { kv } from '@/lib/kv';

// First-time credit-card buyer top-off endpoint.
//
// Architectural premise (Doug's North Star, Apr 28 2026):
// "Users should never have to have ETH. We have a funded account of ETH for
// that." — and by extension, users should never have to do USDC math against
// Coinbase Onramp fees. When Coinbase delivers a slightly-short amount (e.g.
// $4.88 USDC for a $5.00 charge after ~2.5% card fees), our reserve wallet
// covers the gap so the buyer's wallet ends up with EXACTLY the cart total.
//
// This unblocks the deterministic failure path for first-time credit-card
// buyers: Coinbase per-transaction limit ($5 for unverified accounts) plus
// our previous 3% fee pad created an unsolvable math problem ($5.15 request
// blocked, $5.00 request delivers $4.88 → poll never satisfies → spinner
// forever). With this endpoint plus dropping the fee pad, the buyer pays
// exactly the cart amount in fiat and the relayer covers the inevitable
// shortfall.
//
// Defense-in-depth:
//   - Server reads the buyer's actual on-chain balance — never trusts
//     anything in the request body except the buyer address + target.
//   - Hard cap on the gap we'll cover ($1 USDC, MAX_GAP_USDC_UNITS).
//   - Daily rate limit per buyer (3 top-offs per UTC day).
//   - Reserve depletion check before broadcasting.
//
// Reserve funding model (Doug's action):
//   The relayer wallet (RELAYER_PRIVATE_KEY) currently holds ~0.05 ETH for
//   gas. To activate top-offs, Doug must send the relayer wallet ~$30 USDC
//   on Base mainnet from the Operations Treasury. At ~$0.15 average per
//   first-time buyer, that covers ~200 first purchases. Refill SOP per
//   month or per Treasury cadence.

// Hard caps — these bound the blast radius of any abuse. Even if everything
// else fails, no single buyer can drain more than DAILY_LIMIT × MAX_GAP per
// UTC day from the reserve.
const MAX_GAP_USDC_UNITS = 1_000_000n; // $1.00 USDC — covers up to ~20% gap on $5 cart
const MAX_TARGET_USDC_UNITS = 100_000_000n; // $100 cart total upper bound
const MAX_TOPOFFS_PER_BUYER_PER_DAY = 3;

// Minimal ABIs — explicit so we're not pulling in marketplace bloat.
const erc20BalanceAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const erc20TransferAbi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

function todayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { buyerAddress, targetUsdcAmount } = body;

    // 1. Validate body shape.
    if (!buyerAddress || typeof buyerAddress !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid buyerAddress' }, { status: 400 });
    }
    if (!targetUsdcAmount || typeof targetUsdcAmount !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid targetUsdcAmount (must be a string of base units)' },
        { status: 400 }
      );
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(buyerAddress)) {
      return NextResponse.json({ error: 'Malformed buyerAddress' }, { status: 400 });
    }

    let target: bigint;
    try {
      target = BigInt(targetUsdcAmount);
    } catch {
      return NextResponse.json({ error: 'targetUsdcAmount not a valid bigint string' }, { status: 400 });
    }

    if (target <= 0n || target > MAX_TARGET_USDC_UNITS) {
      return NextResponse.json(
        { error: `Target out of bounds (must be 0 < target ≤ ${MAX_TARGET_USDC_UNITS})` },
        { status: 400 }
      );
    }

    const buyerLower = buyerAddress.toLowerCase();

    // 2. Daily rate limit per buyer. KV-keyed.
    const rateKey = `topup:${buyerLower}:${todayUtcKey()}`;
    const currentCount = (await kv.get<number>(rateKey)) ?? 0;
    if (currentCount >= MAX_TOPOFFS_PER_BUYER_PER_DAY) {
      return NextResponse.json(
        { error: 'Daily top-off limit reached for this buyer.' },
        { status: 429 }
      );
    }

    // 3. Set up clients.
    const relayerKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerKey) {
      console.error('[Relayer-Topup] RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json({ error: 'Relayer not configured' }, { status: 500 });
    }
    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const publicClient = createFreshPublicClient();
    const walletClient = createFreshWalletClient(account);

    // 4. Read buyer's actual on-chain balance — DO NOT trust the client.
    const buyerBalance = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [buyerAddress as Address],
    })) as bigint;

    // 5. Calculate gap.
    if (buyerBalance >= target) {
      // Already enough — buyer doesn't need a top-off. Idempotent: client
      // can call us safely as a check before deciding to retry.
      return NextResponse.json({
        topUpNeeded: false,
        currentBalance: buyerBalance.toString(),
      });
    }

    const gap = target - buyerBalance;
    if (gap > MAX_GAP_USDC_UNITS) {
      // Shortfall too large — likely indicates the buyer barely paid OR the
      // request is fishy. Don't auto-cover; surface a clear error so the UI
      // can tell the buyer to retry through Coinbase.
      return NextResponse.json(
        {
          error: `Shortfall too large: ${gap.toString()} > ${MAX_GAP_USDC_UNITS.toString()} (max auto-cover).`,
        },
        { status: 400 }
      );
    }

    // 6. Verify the reserve has enough USDC. Surface a clear, actionable
    // error if Doug needs to refill.
    const reserveBalance = (await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20BalanceAbi,
      functionName: 'balanceOf',
      args: [account.address],
    })) as bigint;

    if (reserveBalance < gap) {
      console.error(
        `[Relayer-Topup] Reserve depleted. Balance: ${reserveBalance}, gap requested: ${gap}.`
      );
      return NextResponse.json(
        {
          error:
            'Top-off reserve depleted. Please contact support — funds are safe but cannot be auto-covered right now.',
        },
        { status: 503 }
      );
    }

    console.log(
      `[Relayer-Topup] Sending ${gap.toString()} USDC to ${buyerAddress} (target ${target}, balance ${buyerBalance}).`
    );

    // 7. Send the gap. Standard ERC-20 transfer from the relayer wallet.
    const txHash = await walletClient.writeContract({
      address: USDC_ADDRESS,
      abi: erc20TransferAbi,
      functionName: 'transfer',
      args: [buyerAddress as Address, gap],
    });

    console.log('[Relayer-Topup] Top-off submitted:', txHash);

    // 8. Wait for receipt server-side. Same pattern as /api/relay so the
    // client doesn't need to poll the chain from the browser.
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    if (receipt.status === 'reverted') {
      console.error(
        `[Relayer-Topup] Transfer reverted on-chain. txHash=${txHash}, gap=${gap}.`
      );
      return NextResponse.json(
        {
          error: 'Top-off transfer reverted on-chain. Funds not deducted from reserve.',
          transactionHash: txHash,
        },
        { status: 500 }
      );
    }

    // 9. Increment the daily counter only on confirmed success.
    await kv.set(rateKey, currentCount + 1);

    return NextResponse.json({
      topUpNeeded: true,
      gap: gap.toString(),
      transactionHash: txHash,
      newBalance: (buyerBalance + gap).toString(),
    });
  } catch (error) {
    console.error('[Relayer-Topup] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('insufficient funds')) {
      return NextResponse.json(
        {
          error:
            'Relayer has insufficient ETH for gas. Please fund the relayer wallet.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Top-off failed: ${message}` },
      { status: 500 }
    );
  }
}
