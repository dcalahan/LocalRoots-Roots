import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { FORWARDER_ADDRESS, ALLOWED_TARGETS, forwarderAbi } from '@/lib/contracts/forwarder';

// Rate limiting: track requests per address
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

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
    const { forwardRequest, signature } = body;

    // Validate required fields
    if (!forwardRequest || !signature) {
      return NextResponse.json(
        { error: 'Missing forwardRequest or signature' },
        { status: 400 }
      );
    }

    const { from, to, value, gas, nonce, deadline, data } = forwardRequest;

    // Validate all fields exist
    if (!from || !to || value === undefined || !gas || nonce === undefined || !deadline || !data) {
      return NextResponse.json(
        { error: 'Invalid forwardRequest structure' },
        { status: 400 }
      );
    }

    // Check rate limit
    if (isRateLimited(from)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { status: 429 }
      );
    }

    // Validate target is allowed
    const targetLower = to.toLowerCase();
    const isAllowed = ALLOWED_TARGETS.some(
      (allowed) => allowed.toLowerCase() === targetLower
    );

    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Target contract not allowed for gasless transactions' },
        { status: 403 }
      );
    }

    // Check deadline hasn't passed
    const now = Math.floor(Date.now() / 1000);
    if (deadline < now) {
      return NextResponse.json(
        { error: 'Request deadline has passed' },
        { status: 400 }
      );
    }

    // Get relayer private key from environment
    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.error('[Relay] RELAYER_PRIVATE_KEY not configured');
      return NextResponse.json(
        { error: 'Relayer not configured' },
        { status: 500 }
      );
    }

    // Create wallet client for relayer
    const account = privateKeyToAccount(relayerPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    // Verify the signature first
    try {
      const isValid = await publicClient.readContract({
        address: FORWARDER_ADDRESS,
        abi: forwarderAbi,
        functionName: 'verify',
        args: [
          {
            from: from as Address,
            to: to as Address,
            value: BigInt(value),
            gas: BigInt(gas),
            nonce: BigInt(nonce),
            deadline: Number(deadline),
            data: data as `0x${string}`,
          },
          signature as `0x${string}`,
        ],
      });

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        );
      }
    } catch (verifyError) {
      console.error('[Relay] Signature verification failed:', verifyError);
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 400 }
      );
    }

    // Execute the meta-transaction
    console.log('[Relay] Executing meta-transaction for', from, 'to', to);

    const txHash = await walletClient.writeContract({
      address: FORWARDER_ADDRESS,
      abi: forwarderAbi,
      functionName: 'execute',
      args: [
        {
          from: from as Address,
          to: to as Address,
          value: BigInt(value),
          gas: BigInt(gas),
          nonce: BigInt(nonce),
          deadline: Number(deadline),
          data: data as `0x${string}`,
        },
        signature as `0x${string}`,
      ],
    });

    console.log('[Relay] Transaction submitted:', txHash);

    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    console.log('[Relay] Transaction confirmed:', receipt.status);

    return NextResponse.json({
      success: true,
      transactionHash: txHash,
      status: receipt.status,
    });
  } catch (error) {
    console.error('[Relay] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Check for specific error types
    if (message.includes('insufficient funds')) {
      return NextResponse.json(
        { error: 'Relayer has insufficient funds' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Transaction failed: ${message}` },
      { status: 500 }
    );
  }
}
