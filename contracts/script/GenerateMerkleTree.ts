/**
 * GenerateMerkleTree.ts
 *
 * Generates a Merkle tree from Seeds balances snapshot for the Phase 2 airdrop.
 * Only includes EXTERNAL wallet users - Privy users receive direct transfers.
 *
 * Usage:
 *   npx ts-node script/GenerateMerkleTree.ts
 *
 * Prerequisites:
 *   Run scripts/distribution/fetchPrivyUsers.ts first to generate privy-wallets.json
 *   (Optional - if not found, all users will be included in Merkle tree)
 *
 * Environment Variables:
 *   SUBGRAPH_URL - The Graph subgraph URL for Seeds data
 *   AIRDROP_ROOTS_AMOUNT - Total ROOTS for airdrop (default: 100M = 100000000)
 *
 * Output Files:
 *   - merkle-root.txt - The Merkle root hash
 *   - proofs.json - All addresses with their claim amounts and proofs
 *   - snapshot.json - Raw Seeds snapshot data for verification
 */

import { keccak256, encodePacked, type Address } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

// Default subgraph URL (update with production URL)
const SUBGRAPH_URL = process.env.SUBGRAPH_URL || 'https://api.studio.thegraph.com/query/YOUR_SUBGRAPH';

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

interface ClaimEntry {
  address: string;
  seedsEarned: string;
  rootsAmount: string;
  proof: `0x${string}`[];
}

/**
 * Load Privy wallet addresses to exclude from Merkle tree
 * These users receive direct transfers instead of Merkle claims
 */
function loadPrivyWallets(): Set<string> {
  // Try multiple possible locations for the privy wallets file
  const possiblePaths = [
    path.join(__dirname, '../../distribution-data/privy-wallets.json'),
    path.join(__dirname, '../distribution-data/privy-wallets.json'),
    path.join(__dirname, '../../scripts/distribution-data/privy-wallets.json'),
  ];

  for (const walletsPath of possiblePaths) {
    if (fs.existsSync(walletsPath)) {
      try {
        const wallets: string[] = JSON.parse(fs.readFileSync(walletsPath, 'utf-8'));
        console.log(`Loaded ${wallets.length} Privy wallets to exclude from Merkle tree`);
        console.log(`  Source: ${walletsPath}`);
        // Normalize to lowercase
        return new Set(wallets.map((w) => w.toLowerCase()));
      } catch (error) {
        console.warn(`Warning: Could not parse ${walletsPath}:`, error);
      }
    }
  }

  console.log('Note: privy-wallets.json not found. All users will be included in Merkle tree.');
  console.log('  Run scripts/distribution/fetchPrivyUsers.ts first to separate Privy users.');
  return new Set();
}

/**
 * Merkle tree implementation using sorted pairs
 */
class MerkleTree {
  private leaves: `0x${string}`[];
  private layers: `0x${string}`[][];

  constructor(leaves: `0x${string}`[]) {
    this.leaves = [...leaves].sort();
    this.layers = this.buildLayers();
  }

  private buildLayers(): `0x${string}`[][] {
    const layers: `0x${string}`[][] = [this.leaves];
    let currentLayer = this.leaves;

    while (currentLayer.length > 1) {
      const nextLayer: `0x${string}`[] = [];
      for (let i = 0; i < currentLayer.length; i += 2) {
        if (i + 1 < currentLayer.length) {
          // Hash pair in sorted order
          const left = currentLayer[i];
          const right = currentLayer[i + 1];
          const [sortedLeft, sortedRight] = left < right ? [left, right] : [right, left];
          nextLayer.push(keccak256(encodePacked(['bytes32', 'bytes32'], [sortedLeft, sortedRight])));
        } else {
          // Odd number of leaves - carry up alone
          nextLayer.push(currentLayer[i]);
        }
      }
      layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return layers;
  }

  getRoot(): `0x${string}` {
    if (this.layers.length === 0 || this.layers[this.layers.length - 1].length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
    return this.layers[this.layers.length - 1][0];
  }

  getProof(leaf: `0x${string}`): `0x${string}`[] {
    const proof: `0x${string}`[] = [];
    let index = this.leaves.indexOf(leaf);

    if (index === -1) {
      throw new Error('Leaf not found in tree');
    }

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isLeftNode = index % 2 === 0;
      const siblingIndex = isLeftNode ? index + 1 : index - 1;

      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
      }

      index = Math.floor(index / 2);
    }

    return proof;
  }
}

/**
 * Fetch all Seeds balances from the subgraph
 */
async function fetchSeedsBalances(): Promise<SeedsBalance[]> {
  const allBalances: SeedsBalance[] = [];
  let skip = 0;
  const batchSize = 1000;

  console.log('Fetching Seeds balances from subgraph...');

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
 * Calculate ROOTS amount based on Seeds earned and conversion ratio
 */
function calculateRootsAmounts(
  balances: SeedsBalance[],
  totalRoots: bigint
): Map<string, { seeds: bigint; roots: bigint }> {
  // Calculate total Seeds
  const totalSeeds = balances.reduce((sum, b) => sum + BigInt(b.total), 0n);

  if (totalSeeds === 0n) {
    throw new Error('No Seeds found in snapshot');
  }

  console.log(`\nConversion calculation:`);
  console.log(`  Total Seeds earned: ${totalSeeds.toString()}`);
  console.log(`  Total ROOTS for airdrop: ${(totalRoots / BigInt(1e18)).toString()}`);
  console.log(`  Conversion ratio: ${Number(totalRoots) / Number(totalSeeds)} ROOTS per Seed`);

  const result = new Map<string, { seeds: bigint; roots: bigint }>();

  for (const balance of balances) {
    const seeds = BigInt(balance.total);
    // ROOTS = (userSeeds * totalRoots) / totalSeeds
    const roots = (seeds * totalRoots) / totalSeeds;

    if (roots > 0n) {
      result.set(balance.user.toLowerCase(), { seeds, roots });
    }
  }

  return result;
}

/**
 * Create Merkle leaf for an address and amount
 */
function createLeaf(address: string, amount: bigint): `0x${string}` {
  return keccak256(encodePacked(['address', 'uint256'], [address as Address, amount]));
}

async function main() {
  console.log('=== Seeds Airdrop Merkle Tree Generator ===\n');

  // 1. Load Privy wallets to exclude
  const privyWallets = loadPrivyWallets();

  // 2. Fetch Seeds balances
  const allBalances = await fetchSeedsBalances();

  if (allBalances.length === 0) {
    console.error('No Seeds balances found!');
    process.exit(1);
  }

  // 3. Filter out Privy users (they get direct transfers, not Merkle claims)
  const balances = allBalances.filter((b) => !privyWallets.has(b.user.toLowerCase()));
  const excludedCount = allBalances.length - balances.length;

  console.log(`\nFiltering results:`);
  console.log(`  Total earners: ${allBalances.length}`);
  console.log(`  Privy users excluded: ${excludedCount}`);
  console.log(`  External users for Merkle tree: ${balances.length}`);

  if (balances.length === 0) {
    console.log('\nNo external users to include in Merkle tree.');
    console.log('All users are Privy users and will receive direct transfers.');
    process.exit(0);
  }

  // 4. Calculate ROOTS amounts (only for external users)
  const amounts = calculateRootsAmounts(balances, AIRDROP_ROOTS_AMOUNT);

  // 5. Build Merkle tree
  console.log('\nBuilding Merkle tree...');
  const leaves: `0x${string}`[] = [];
  const leafToEntry = new Map<string, { address: string; seeds: bigint; roots: bigint }>();

  for (const [address, { seeds, roots }] of amounts) {
    const leaf = createLeaf(address, roots);
    leaves.push(leaf);
    leafToEntry.set(leaf, { address, seeds, roots });
  }

  const tree = new MerkleTree(leaves);
  const merkleRoot = tree.getRoot();

  console.log(`  Merkle root: ${merkleRoot}`);
  console.log(`  Total eligible addresses: ${leaves.length}`);

  // 6. Generate proofs for all addresses
  console.log('\nGenerating proofs...');
  const proofs: Record<string, ClaimEntry> = {};

  for (const [leaf, entry] of leafToEntry) {
    const proof = tree.getProof(leaf as `0x${string}`);
    proofs[entry.address] = {
      address: entry.address,
      seedsEarned: entry.seeds.toString(),
      rootsAmount: entry.roots.toString(),
      proof,
    };
  }

  // 7. Save outputs
  const outputDir = path.join(__dirname, '../airdrop-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Merkle root
  fs.writeFileSync(
    path.join(outputDir, 'merkle-root.txt'),
    merkleRoot
  );
  console.log(`  Saved: ${outputDir}/merkle-root.txt`);

  // Proofs (for frontend)
  fs.writeFileSync(
    path.join(outputDir, 'proofs.json'),
    JSON.stringify(proofs, null, 2)
  );
  console.log(`  Saved: ${outputDir}/proofs.json`);

  // Snapshot (for verification)
  const snapshot = {
    timestamp: new Date().toISOString(),
    note: 'Merkle tree for EXTERNAL wallets only. Privy users receive direct transfers.',
    filtering: {
      totalEarnersFromSubgraph: allBalances.length,
      privyUsersExcluded: excludedCount,
      externalUsersIncluded: balances.length,
    },
    totalSeeds: balances.reduce((sum, b) => BigInt(sum) + BigInt(b.total), 0n).toString(),
    totalRoots: AIRDROP_ROOTS_AMOUNT.toString(),
    eligibleAddresses: leaves.length,
    merkleRoot,
    balances: balances.map(b => ({
      user: b.user,
      total: b.total,
      purchases: b.purchases,
      sales: b.sales,
      referrals: b.referrals,
      milestones: b.milestones,
      recruitments: b.recruitments,
    })),
  };
  fs.writeFileSync(
    path.join(outputDir, 'snapshot.json'),
    JSON.stringify(snapshot, null, 2)
  );
  console.log(`  Saved: ${outputDir}/snapshot.json`);

  console.log('\n=== Generation Complete ===');
  console.log(`\nNext steps:`);
  console.log(`  1. Deploy SeedsAirdrop contract`);
  console.log(`  2. Fund contract with ${(AIRDROP_ROOTS_AMOUNT / BigInt(1e18)).toString()} ROOTS`);
  console.log(`  3. Call setMerkleRoot("${merkleRoot}")`);
  console.log(`  4. Host proofs.json for frontend access`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
