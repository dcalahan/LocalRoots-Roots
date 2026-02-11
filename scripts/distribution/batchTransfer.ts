/**
 * batchTransfer.ts
 *
 * Executes ROOTS token transfers to Privy wallet users.
 * Includes dry-run mode, resume capability, and detailed logging.
 *
 * Usage:
 *   npx ts-node scripts/distribution/batchTransfer.ts [options]
 *
 * Options:
 *   --dry-run         Validate without executing transfers
 *   --resume          Resume from last saved state
 *   --batch-size=N    Number of transfers per batch (default: 50)
 *   --delay=N         Delay between transfers in ms (default: 1000)
 *
 * Prerequisites:
 *   Run calculateAllocations.ts first to generate privy-allocations.json
 *
 * Environment Variables:
 *   TREASURY_PRIVATE_KEY - Private key for treasury wallet (holds ROOTS)
 *   ROOTS_TOKEN_ADDRESS - ROOTS token contract address
 *   RPC_URL - Base RPC URL
 *
 * Output:
 *   - transfer-state.json - Progress state for resume
 *   - transfer-log.json - Detailed log of all transfers
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createWalletClient,
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base } from 'viem/chains';

// Configuration
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '';
const ROOTS_TOKEN_ADDRESS = (process.env.ROOTS_TOKEN_ADDRESS ||
  process.env.NEXT_PUBLIC_ROOTS_TOKEN_ADDRESS ||
  '0x21952Cb029da00902EDA5c83a01825Ae2E645e03') as Address;
const RPC_URL =
  process.env.RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  'https://sepolia.base.org';

// Determine chain based on RPC URL
const chain = RPC_URL.includes('sepolia') ? baseSepolia : base;

// ERC20 ABI (just transfer function)
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

interface Allocation {
  address: string;
  seedsEarned: string;
  rootsAmount: string;
  rootsAmountFormatted: string;
}

interface TransferRecord {
  address: string;
  amount: string;
  txHash?: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  timestamp?: string;
}

interface TransferState {
  startedAt: string;
  lastUpdated: string;
  totalAllocations: number;
  completedCount: number;
  failedCount: number;
  pendingCount: number;
  transfers: Record<string, TransferRecord>;
}

// Parse command line arguments
function parseArgs(): { dryRun: boolean; resume: boolean; batchSize: number; delay: number } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    resume: args.includes('--resume'),
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '50'),
    delay: parseInt(args.find((a) => a.startsWith('--delay='))?.split('=')[1] || '1000'),
  };
}

/**
 * Load allocations from JSON file
 */
function loadAllocations(): Allocation[] {
  const dataDir = path.join(__dirname, '../../distribution-data');
  const allocPath = path.join(dataDir, 'privy-allocations.json');

  if (!fs.existsSync(allocPath)) {
    throw new Error('privy-allocations.json not found. Run calculateAllocations.ts first.');
  }

  return JSON.parse(fs.readFileSync(allocPath, 'utf-8'));
}

/**
 * Load or initialize transfer state
 */
function loadOrCreateState(allocations: Allocation[], resume: boolean): TransferState {
  const dataDir = path.join(__dirname, '../../distribution-data');
  const statePath = path.join(dataDir, 'transfer-state.json');

  if (resume && fs.existsSync(statePath)) {
    console.log('Resuming from saved state...');
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  }

  // Initialize new state
  const transfers: Record<string, TransferRecord> = {};
  for (const alloc of allocations) {
    transfers[alloc.address] = {
      address: alloc.address,
      amount: alloc.rootsAmount,
      status: 'pending',
    };
  }

  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    totalAllocations: allocations.length,
    completedCount: 0,
    failedCount: 0,
    pendingCount: allocations.length,
    transfers,
  };
}

/**
 * Save transfer state
 */
function saveState(state: TransferState): void {
  const dataDir = path.join(__dirname, '../../distribution-data');
  const statePath = path.join(dataDir, 'transfer-state.json');

  state.lastUpdated = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const { dryRun, resume, batchSize, delay } = parseArgs();

  console.log('=== ROOTS Batch Transfer ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no transfers)' : 'LIVE'}`);
  console.log(`Resume: ${resume}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Delay between transfers: ${delay}ms`);
  console.log(`Chain: ${chain.name}`);
  console.log(`ROOTS Token: ${ROOTS_TOKEN_ADDRESS}`);

  // Validate environment
  if (!dryRun && !TREASURY_PRIVATE_KEY) {
    console.error('\nError: TREASURY_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY required for live transfers');
    process.exit(1);
  }

  // Load allocations
  const allocations = loadAllocations();
  console.log(`\nLoaded ${allocations.length} allocations`);

  // Calculate total ROOTS needed
  const totalRoots = allocations.reduce((sum, a) => sum + BigInt(a.rootsAmount), 0n);
  console.log(`Total ROOTS to distribute: ${formatUnits(totalRoots, 18)}`);

  // Initialize state
  const state = loadOrCreateState(allocations, resume);
  console.log(`\nState: ${state.completedCount} completed, ${state.failedCount} failed, ${state.pendingCount} pending`);

  // Create clients
  const publicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
  });

  let walletClient;
  let treasuryAddress: Address;

  if (!dryRun) {
    const account = privateKeyToAccount(TREASURY_PRIVATE_KEY as `0x${string}`);
    treasuryAddress = account.address;

    walletClient = createWalletClient({
      account,
      chain,
      transport: http(RPC_URL),
    });

    console.log(`Treasury address: ${treasuryAddress}`);

    // Check treasury ROOTS balance
    const treasuryBalance = await publicClient.readContract({
      address: ROOTS_TOKEN_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    });

    console.log(`Treasury ROOTS balance: ${formatUnits(treasuryBalance, 18)}`);

    if (treasuryBalance < totalRoots) {
      console.error(`\nError: Insufficient ROOTS balance!`);
      console.error(`  Need: ${formatUnits(totalRoots, 18)}`);
      console.error(`  Have: ${formatUnits(treasuryBalance, 18)}`);
      process.exit(1);
    }

    // Check treasury ETH for gas
    const ethBalance = await publicClient.getBalance({ address: treasuryAddress });
    console.log(`Treasury ETH balance: ${formatUnits(ethBalance, 18)}`);

    if (ethBalance < parseUnits('0.01', 18)) {
      console.warn(`\nWarning: Low ETH balance for gas. Consider funding treasury.`);
    }
  } else {
    treasuryAddress = '0x0000000000000000000000000000000000000000' as Address;
    console.log('\nDry run mode - skipping balance checks');
  }

  // Get pending transfers
  const pendingAddresses = Object.entries(state.transfers)
    .filter(([_, t]) => t.status === 'pending')
    .map(([addr]) => addr);

  console.log(`\nProcessing ${pendingAddresses.length} pending transfers...`);

  if (dryRun) {
    console.log('\n--- DRY RUN PREVIEW ---');
    for (let i = 0; i < Math.min(10, pendingAddresses.length); i++) {
      const addr = pendingAddresses[i];
      const transfer = state.transfers[addr];
      console.log(`  ${addr}: ${formatUnits(BigInt(transfer.amount), 18)} ROOTS`);
    }
    if (pendingAddresses.length > 10) {
      console.log(`  ... and ${pendingAddresses.length - 10} more`);
    }
    console.log('\nDry run complete. No transfers executed.');
    console.log('Run without --dry-run to execute transfers.');
    return;
  }

  // Execute transfers
  let batchCount = 0;
  for (let i = 0; i < pendingAddresses.length; i++) {
    const addr = pendingAddresses[i] as Address;
    const transfer = state.transfers[addr];

    console.log(`\n[${i + 1}/${pendingAddresses.length}] Transferring to ${addr}...`);
    console.log(`  Amount: ${formatUnits(BigInt(transfer.amount), 18)} ROOTS`);

    try {
      const txHash = await walletClient!.writeContract({
        address: ROOTS_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [addr, BigInt(transfer.amount)],
      });

      console.log(`  TX: ${txHash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === 'success') {
        transfer.status = 'success';
        transfer.txHash = txHash;
        transfer.timestamp = new Date().toISOString();
        state.completedCount++;
        state.pendingCount--;
        console.log(`  Status: SUCCESS`);
      } else {
        transfer.status = 'failed';
        transfer.error = 'Transaction reverted';
        transfer.timestamp = new Date().toISOString();
        state.failedCount++;
        state.pendingCount--;
        console.log(`  Status: FAILED (reverted)`);
      }
    } catch (error) {
      transfer.status = 'failed';
      transfer.error = error instanceof Error ? error.message : String(error);
      transfer.timestamp = new Date().toISOString();
      state.failedCount++;
      state.pendingCount--;
      console.log(`  Status: FAILED - ${transfer.error}`);
    }

    // Save state after each transfer
    saveState(state);

    // Batch delay
    batchCount++;
    if (batchCount >= batchSize) {
      console.log(`\nBatch complete. Waiting ${delay}ms...`);
      await sleep(delay);
      batchCount = 0;
    } else {
      // Small delay between transfers
      await sleep(100);
    }
  }

  // Final summary
  console.log('\n=== Transfer Complete ===');
  console.log(`Completed: ${state.completedCount}`);
  console.log(`Failed: ${state.failedCount}`);
  console.log(`Pending: ${state.pendingCount}`);

  if (state.failedCount > 0) {
    console.log('\nFailed transfers:');
    Object.values(state.transfers)
      .filter((t) => t.status === 'failed')
      .forEach((t) => {
        console.log(`  ${t.address}: ${t.error}`);
      });
    console.log('\nRun with --resume to retry failed transfers.');
  }

  // Save final log
  const dataDir = path.join(__dirname, '../../distribution-data');
  const logPath = path.join(dataDir, 'transfer-log.json');
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        summary: {
          startedAt: state.startedAt,
          completedAt: new Date().toISOString(),
          totalAllocations: state.totalAllocations,
          completed: state.completedCount,
          failed: state.failedCount,
          pending: state.pendingCount,
        },
        transfers: Object.values(state.transfers),
      },
      null,
      2
    )
  );
  console.log(`\nTransfer log saved: ${logPath}`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
