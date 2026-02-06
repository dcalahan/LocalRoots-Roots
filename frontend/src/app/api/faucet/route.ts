import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

/**
 * Testnet Faucet API
 *
 * Automatically funds new wallets with test tokens so users can
 * try the app without acquiring testnet tokens manually.
 *
 * Sends:
 * - 0.001 ETH (for gas on approvals)
 * - 1,000 USDC (MockUSDC)
 * - 1,000 USDT (MockUSDT)
 * - 10,000 ROOTS (for purchases)
 *
 * Safety:
 * - Only works on Base Sepolia (chainId 84532)
 * - Rate limited: 1 funding per address
 * - Checks if wallet already has tokens before funding
 */

// Contract addresses
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as Address;
const USDT_ADDRESS = process.env.NEXT_PUBLIC_USDT_ADDRESS as Address;
const ROOTS_ADDRESS = process.env.NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS as Address;

// Relayer account (same one used for gasless transactions)
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

// Simple in-memory rate limiting (resets on server restart)
// In production, use Redis or database
const fundedAddresses = new Set<string>();

// ERC20 ABI for balanceOf and mint/transfer
const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
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

export async function POST(request: NextRequest) {
  try {
    // Only allow on testnet
    if (!RELAYER_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Faucet not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }

    const walletAddress = address.toLowerCase() as Address;

    // Rate limit check
    if (fundedAddresses.has(walletAddress)) {
      return NextResponse.json(
        { error: 'Address already funded', alreadyFunded: true },
        { status: 429 }
      );
    }

    // Setup clients
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const relayerAccount = privateKeyToAccount(RELAYER_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account: relayerAccount,
      chain: baseSepolia,
      transport: http(),
    });

    // Check if already has tokens (skip if user already has funds)
    const [ethBalance, rootsBalance] = await Promise.all([
      publicClient.getBalance({ address: walletAddress }),
      publicClient.readContract({
        address: ROOTS_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [walletAddress],
      }),
    ]);

    // If user already has ETH and ROOTS, skip funding
    if (ethBalance > parseEther('0.0005') && (rootsBalance as bigint) > parseEther('1000')) {
      fundedAddresses.add(walletAddress);
      return NextResponse.json({
        success: true,
        message: 'Wallet already has funds',
        alreadyFunded: true,
      });
    }

    // Fund the wallet
    const results: { token: string; txHash?: string; error?: string }[] = [];

    // 1. Send ETH for gas (0.001 ETH)
    try {
      const ethTxHash = await walletClient.sendTransaction({
        to: walletAddress,
        value: parseEther('0.001'),
      });
      results.push({ token: 'ETH', txHash: ethTxHash });
    } catch (err) {
      results.push({ token: 'ETH', error: (err as Error).message });
    }

    // 2. Mint USDC (1,000 USDC = 1,000,000,000 with 6 decimals)
    if (USDC_ADDRESS) {
      try {
        const usdcTxHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'mint',
          args: [walletAddress, BigInt(1000 * 1e6)],
        });
        results.push({ token: 'USDC', txHash: usdcTxHash });
      } catch (err) {
        results.push({ token: 'USDC', error: (err as Error).message });
      }
    }

    // 3. Mint USDT (1,000 USDT = 1,000,000,000 with 6 decimals)
    if (USDT_ADDRESS) {
      try {
        const usdtTxHash = await walletClient.writeContract({
          address: USDT_ADDRESS,
          abi: erc20Abi,
          functionName: 'mint',
          args: [walletAddress, BigInt(1000 * 1e6)],
        });
        results.push({ token: 'USDT', txHash: usdtTxHash });
      } catch (err) {
        results.push({ token: 'USDT', error: (err as Error).message });
      }
    }

    // 4. Transfer ROOTS (10,000 ROOTS from relayer)
    if (ROOTS_ADDRESS) {
      try {
        const rootsTxHash = await walletClient.writeContract({
          address: ROOTS_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [walletAddress, parseEther('10000')],
        });
        results.push({ token: 'ROOTS', txHash: rootsTxHash });
      } catch (err) {
        results.push({ token: 'ROOTS', error: (err as Error).message });
      }
    }

    // Mark as funded
    fundedAddresses.add(walletAddress);

    const successful = results.filter(r => r.txHash).length;
    const failed = results.filter(r => r.error).length;

    return NextResponse.json({
      success: successful > 0,
      message: `Funded with ${successful} token(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      results,
      funded: {
        eth: '0.001 ETH',
        usdc: '1,000 USDC',
        usdt: '1,000 USDT',
        roots: '10,000 ROOTS',
      },
    });
  } catch (error) {
    console.error('[Faucet] Error:', error);
    return NextResponse.json(
      { error: 'Faucet error', details: (error as Error).message },
      { status: 500 }
    );
  }
}
