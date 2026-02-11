/**
 * calculateAllocations.ts
 *
 * Calculates ROOTS token allocations from Seeds snapshot.
 * Separates Privy users (direct transfer) from external wallets (Merkle claim).
 *
 * Usage:
 *   npx ts-node scripts/distribution/calculateAllocations.ts
 *
 * Prerequisites:
 *   Run fetchPrivyUsers.ts first to generate privy-wallets.json
 *
 * Environment Variables:
 *   SUBGRAPH_URL - The Graph subgraph URL for Seeds data
 *   AIRDROP_ROOTS_AMOUNT - Total ROOTS for airdrop (default: 100M)
 *
 * Output:
 *   - privy-allocations.json - Privy users with ROOTS amounts (for direct transfer)
 *   - external-allocations.json - External wallets with ROOTS amounts (for Merkle tree)
 *   - allocation-summary.json - Summary statistics
 */

import * as fs from 'fs';
import * as path from 'path';

// Default subgraph URL
const SUBGRAPH_URL =
  process.env.SUBGRAPH_URL ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  'https://api.studio.thegraph.com/query/1722311/localroots-subgraph/v0.0.3';

// Total ROOTS allocated for airdrop (10% of 1B = 100M, in 18 decimals)
const AIRDROP_ROOTS_AMOUNT = BigInt(process.env.AIRDROP_ROOTS_AMOUNT || '100000000') * BigInt(1e18);

interface SeedsBalance {
  user: string;
  total: string;
  purchases: string;
  sales: string;
  referrals: string;
  milestones: string;
  recruitments: string;
}

interface Allocation {
  address: string;
  seedsEarned: string;
  seedsEarnedFormatted: string;
  rootsAmount: string;
  rootsAmountFormatted: string;
}

interface AllocationSummary {
  timestamp: string;
  subgraphUrl: string;
  totalSeedsEarned: string;
  totalRootsAllocated: string;
  conversionRatio: string;
  totalEarners: number;
  privyUsers: {
    count: number;
    totalSeeds: string;
    totalRoots: string;
  };
  externalUsers: {
    count: number;
    totalSeeds: string;
    totalRoots: string;
  };
}

/**
 * Fetch all Seeds balances from the subgraph
 */
async function fetchSeedsBalances(): Promise<SeedsBalance[]> {
  const allBalances: SeedsBalance[] = [];
  let skip = 0;
  const batchSize = 1000;

  console.log('Fetching Seeds balances from subgraph...');
  console.log(`  URL: ${SUBGRAPH_URL}`);

  while (true) {
    const query = `{
      seedsBalances(
        first: ${batchSize}
        skip: ${skip}
        orderBy: total
        orderDirection: desc
        where: { total_gt: "0" }
      ) {
        user
        total
        purchases
        sales
        referrals
        milestones
        recruitments
      }
    }`;

    try {
      const response = await fetch(SUBGRAPH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const { data, errors } = await response.json();

      if (errors) {
        console.error('GraphQL errors:', errors);
        break;
      }

      const balances = data?.seedsBalances || [];
      if (balances.length === 0) break;

      allBalances.push(...balances);
      console.log(`  Fetched ${allBalances.length} balances...`);

      if (balances.length < batchSize) break;
      skip += batchSize;
    } catch (error) {
      console.error('Fetch error:', error);
      break;
    }
  }

  console.log(`Total balances fetched: ${allBalances.length}`);
  return allBalances;
}

/**
 * Load Privy wallet addresses from previous fetch
 */
function loadPrivyWallets(): Set<string> {
  const dataDir = path.join(__dirname, '../../distribution-data');
  const walletsPath = path.join(dataDir, 'privy-wallets.json');

  if (!fs.existsSync(walletsPath)) {
    console.warn('Warning: privy-wallets.json not found. Run fetchPrivyUsers.ts first.');
    console.warn('Proceeding without Privy user separation...');
    return new Set();
  }

  const wallets: string[] = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
  console.log(`Loaded ${wallets.length} Privy wallet addresses`);

  // Normalize to lowercase
  return new Set(wallets.map((w) => w.toLowerCase()));
}

/**
 * Format bigint with decimals for display
 */
function formatWithDecimals(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const remainder = value % divisor;
  const decimal = Number(remainder) / 10 ** decimals;
  return (Number(whole) + decimal).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Calculate ROOTS allocations and separate by wallet type
 */
function calculateAllocations(
  balances: SeedsBalance[],
  privyWallets: Set<string>,
  totalRoots: bigint
): {
  privyAllocations: Allocation[];
  externalAllocations: Allocation[];
  summary: AllocationSummary;
} {
  // Calculate total Seeds
  const totalSeeds = balances.reduce((sum, b) => sum + BigInt(b.total), 0n);

  if (totalSeeds === 0n) {
    throw new Error('No Seeds found in snapshot');
  }

  console.log(`\nConversion calculation:`);
  console.log(`  Total Seeds earned: ${formatWithDecimals(totalSeeds, 6)}`);
  console.log(`  Total ROOTS for airdrop: ${formatWithDecimals(totalRoots, 18)}`);

  const conversionRatio = Number(totalRoots) / Number(totalSeeds);
  console.log(`  Conversion ratio: ${conversionRatio.toFixed(6)} ROOTS per Seed (raw)`);

  const privyAllocations: Allocation[] = [];
  const externalAllocations: Allocation[] = [];

  let privyTotalSeeds = 0n;
  let privyTotalRoots = 0n;
  let externalTotalSeeds = 0n;
  let externalTotalRoots = 0n;

  for (const balance of balances) {
    const address = balance.user.toLowerCase();
    const seeds = BigInt(balance.total);

    // ROOTS = (userSeeds * totalRoots) / totalSeeds
    const roots = (seeds * totalRoots) / totalSeeds;

    if (roots === 0n) continue;

    const allocation: Allocation = {
      address,
      seedsEarned: seeds.toString(),
      seedsEarnedFormatted: formatWithDecimals(seeds, 6),
      rootsAmount: roots.toString(),
      rootsAmountFormatted: formatWithDecimals(roots, 18),
    };

    if (privyWallets.has(address)) {
      privyAllocations.push(allocation);
      privyTotalSeeds += seeds;
      privyTotalRoots += roots;
    } else {
      externalAllocations.push(allocation);
      externalTotalSeeds += seeds;
      externalTotalRoots += roots;
    }
  }

  const summary: AllocationSummary = {
    timestamp: new Date().toISOString(),
    subgraphUrl: SUBGRAPH_URL,
    totalSeedsEarned: totalSeeds.toString(),
    totalRootsAllocated: totalRoots.toString(),
    conversionRatio: conversionRatio.toString(),
    totalEarners: privyAllocations.length + externalAllocations.length,
    privyUsers: {
      count: privyAllocations.length,
      totalSeeds: privyTotalSeeds.toString(),
      totalRoots: privyTotalRoots.toString(),
    },
    externalUsers: {
      count: externalAllocations.length,
      totalSeeds: externalTotalSeeds.toString(),
      totalRoots: externalTotalRoots.toString(),
    },
  };

  return { privyAllocations, externalAllocations, summary };
}

async function main() {
  console.log('=== ROOTS Allocation Calculator ===\n');

  // Fetch Seeds balances from subgraph
  const balances = await fetchSeedsBalances();

  if (balances.length === 0) {
    console.error('No Seeds balances found!');
    process.exit(1);
  }

  // Load Privy wallet addresses
  const privyWallets = loadPrivyWallets();

  // Calculate allocations
  const { privyAllocations, externalAllocations, summary } = calculateAllocations(
    balances,
    privyWallets,
    AIRDROP_ROOTS_AMOUNT
  );

  // Output directory
  const outputDir = path.join(__dirname, '../../distribution-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save Privy allocations (for direct transfer)
  const privyPath = path.join(outputDir, 'privy-allocations.json');
  fs.writeFileSync(privyPath, JSON.stringify(privyAllocations, null, 2));
  console.log(`\nSaved: ${privyPath}`);

  // Save external allocations (for Merkle tree)
  const externalPath = path.join(outputDir, 'external-allocations.json');
  fs.writeFileSync(externalPath, JSON.stringify(externalAllocations, null, 2));
  console.log(`Saved: ${externalPath}`);

  // Save summary
  const summaryPath = path.join(outputDir, 'allocation-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Saved: ${summaryPath}`);

  // Print summary
  console.log('\n=== Allocation Summary ===');
  console.log(`\nTotal earners: ${summary.totalEarners}`);
  console.log(`\nPrivy users (direct transfer):`);
  console.log(`  Count: ${summary.privyUsers.count}`);
  console.log(`  Seeds: ${formatWithDecimals(BigInt(summary.privyUsers.totalSeeds), 6)}`);
  console.log(`  ROOTS: ${formatWithDecimals(BigInt(summary.privyUsers.totalRoots), 18)}`);
  console.log(`\nExternal users (Merkle claim):`);
  console.log(`  Count: ${summary.externalUsers.count}`);
  console.log(`  Seeds: ${formatWithDecimals(BigInt(summary.externalUsers.totalSeeds), 6)}`);
  console.log(`  ROOTS: ${formatWithDecimals(BigInt(summary.externalUsers.totalRoots), 18)}`);

  console.log('\n=== Calculation Complete ===');
  console.log('\nNext steps:');
  console.log('  1. Review privy-allocations.json for direct transfers');
  console.log('  2. Run batchTransfer.ts --dry-run to validate');
  console.log('  3. Use external-allocations.json for Merkle tree generation');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
