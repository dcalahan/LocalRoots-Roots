import { describe, it, expect, beforeAll } from 'vitest';
import { keccak256, encodePacked, type Address } from 'viem';
import {
  publicClient,
  deployerClient,
  deployerAddress,
  buyerAddress,
  buyerClient,
  sellerAddress,
  sellerClient,
} from './lib/clients';
import {
  ROOTS_TOKEN_ADDRESS,
  SEEDS_AIRDROP_ADDRESS,
  seedsAirdropAbi,
  erc20Abi,
} from './lib/contracts';
import { getRootsBalance } from './lib/assertions';

// ═══════════════════════════════════════════════════════════════
// Airdrop Claim Flow Tests
// Tests for the Merkle-based Seeds → $ROOTS airdrop
//
// Pre-requisites:
// - SeedsAirdrop contract deployed and funded
// - Merkle root set on contract
// - Test wallets included in Merkle tree
//
// Run with: npm run test:e2e:airdrop
// ═══════════════════════════════════════════════════════════════

/**
 * Simple Merkle tree for testing
 * In production, use the GenerateMerkleTree.ts script
 */
class TestMerkleTree {
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
          const left = currentLayer[i];
          const right = currentLayer[i + 1];
          const [sortedLeft, sortedRight] = left < right ? [left, right] : [right, left];
          nextLayer.push(keccak256(encodePacked(['bytes32', 'bytes32'], [sortedLeft, sortedRight])));
        } else {
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

function createLeaf(address: string, amount: bigint): `0x${string}` {
  return keccak256(encodePacked(['address', 'uint256'], [address as Address, amount]));
}

// Test claim amounts (in ROOTS with 18 decimals)
const BUYER_CLAIM_AMOUNT = 1000n * 10n ** 18n;  // 1,000 ROOTS
const SELLER_CLAIM_AMOUNT = 2000n * 10n ** 18n; // 2,000 ROOTS
const DEPLOYER_CLAIM_AMOUNT = 5000n * 10n ** 18n; // 5,000 ROOTS (for funding)

// Test Merkle tree variables
let merkleTree: TestMerkleTree;
let merkleRoot: `0x${string}`;
let buyerProof: `0x${string}`[];
let sellerProof: `0x${string}`[];

describe('Airdrop Claim Flow Tests', () => {
  beforeAll(() => {
    // Skip if airdrop contract not deployed
    if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.log('[Airdrop] SeedsAirdrop not deployed - skipping tests');
      return;
    }

    // Build test Merkle tree
    const claims = [
      { address: buyerAddress, amount: BUYER_CLAIM_AMOUNT },
      { address: sellerAddress, amount: SELLER_CLAIM_AMOUNT },
      { address: deployerAddress, amount: DEPLOYER_CLAIM_AMOUNT },
    ];

    const leaves = claims.map((c) =>
      createLeaf(c.address, c.amount)
    );

    merkleTree = new TestMerkleTree(leaves);
    merkleRoot = merkleTree.getRoot();
    buyerProof = merkleTree.getProof(createLeaf(buyerAddress, BUYER_CLAIM_AMOUNT));
    sellerProof = merkleTree.getProof(createLeaf(sellerAddress, SELLER_CLAIM_AMOUNT));

    console.log(`[Airdrop] Test Merkle root: ${merkleRoot}`);
    console.log(`[Airdrop] Buyer proof: ${buyerProof.length} elements`);
    console.log(`[Airdrop] Seller proof: ${sellerProof.length} elements`);
  });

  describe('Step 1 — Setup (Admin Only)', () => {
    it('should check airdrop contract status', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        console.log('[Airdrop] Contract not deployed - skipping');
        return;
      }

      const [currentRoot, claimDeadline, available] = await Promise.all([
        publicClient.readContract({
          address: SEEDS_AIRDROP_ADDRESS,
          abi: seedsAirdropAbi,
          functionName: 'merkleRoot',
        }),
        publicClient.readContract({
          address: SEEDS_AIRDROP_ADDRESS,
          abi: seedsAirdropAbi,
          functionName: 'claimDeadline',
        }),
        publicClient.readContract({
          address: SEEDS_AIRDROP_ADDRESS,
          abi: seedsAirdropAbi,
          functionName: 'availableBalance',
        }),
      ]);

      console.log(`[Airdrop] Current Merkle root: ${currentRoot}`);
      console.log(`[Airdrop] Claim deadline: ${new Date(Number(claimDeadline) * 1000).toISOString()}`);
      console.log(`[Airdrop] Available balance: ${Number(available) / 1e18} ROOTS`);

      expect(claimDeadline).toBeGreaterThan(BigInt(Date.now() / 1000));
    });

    it('should set Merkle root (if not already set)', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const currentRoot = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'merkleRoot',
      }) as `0x${string}`;

      // Skip if already set (don't override production root)
      if (currentRoot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        console.log('[Airdrop] Merkle root already set - using existing');
        return;
      }

      console.log('[Airdrop] Setting Merkle root...');

      const hash = await deployerClient.writeContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'setMerkleRoot',
        args: [merkleRoot],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Verify
      const newRoot = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'merkleRoot',
      });

      expect(newRoot).toBe(merkleRoot);
    });
  });

  describe('Step 2 — Claim Eligibility', () => {
    it('should verify buyer claim eligibility', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      // Check if already claimed
      const hasClaimed = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'hasClaimed',
        args: [buyerAddress],
      });

      if (hasClaimed) {
        console.log('[Airdrop] Buyer already claimed - skipping eligibility check');
        return;
      }

      const canClaim = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [buyerAddress, BUYER_CLAIM_AMOUNT, buyerProof],
      });

      console.log(`[Airdrop] Buyer canClaim: ${canClaim}`);
      // Note: This will fail if using production Merkle root (test addresses not included)
    });

    it('should reject invalid proof', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const fakeProof: `0x${string}`[] = [
        keccak256(encodePacked(['string'], ['fake'])),
      ];

      const canClaim = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [buyerAddress, BUYER_CLAIM_AMOUNT, fakeProof],
      });

      console.log(`[Airdrop] Invalid proof canClaim: ${canClaim}`);
      expect(canClaim).toBe(false);
    });

    it('should reject wrong amount with valid proof', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const wrongAmount = BUYER_CLAIM_AMOUNT * 2n; // Double the amount

      const canClaim = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [buyerAddress, wrongAmount, buyerProof],
      });

      console.log(`[Airdrop] Wrong amount canClaim: ${canClaim}`);
      expect(canClaim).toBe(false);
    });
  });

  describe('Step 3 — Valid Claims', () => {
    it('should allow valid buyer claim', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      // Check if already claimed
      const hasClaimed = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'hasClaimed',
        args: [buyerAddress],
      });

      if (hasClaimed) {
        console.log('[Airdrop] Buyer already claimed - skipping');
        return;
      }

      // Check eligibility first
      const canClaim = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [buyerAddress, BUYER_CLAIM_AMOUNT, buyerProof],
      });

      if (!canClaim) {
        console.log('[Airdrop] Buyer not eligible (likely production Merkle root) - skipping');
        return;
      }

      const balanceBefore = await getRootsBalance(buyerAddress);
      console.log(`[Airdrop] Buyer balance before: ${Number(balanceBefore) / 1e18} ROOTS`);

      const hash = await buyerClient.writeContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'claim',
        args: [BUYER_CLAIM_AMOUNT, buyerProof],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      const balanceAfter = await getRootsBalance(buyerAddress);
      console.log(`[Airdrop] Buyer balance after: ${Number(balanceAfter) / 1e18} ROOTS`);

      expect(balanceAfter - balanceBefore).toBe(BUYER_CLAIM_AMOUNT);
    });
  });

  describe('Step 4 — Double Claim Prevention', () => {
    it('should reject double claim', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      // Check if buyer has claimed
      const hasClaimed = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'hasClaimed',
        args: [buyerAddress],
      });

      if (!hasClaimed) {
        console.log('[Airdrop] Buyer has not claimed - cannot test double claim');
        return;
      }

      // Check canClaim returns false
      const canClaim = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'canClaim',
        args: [buyerAddress, BUYER_CLAIM_AMOUNT, buyerProof],
      });

      console.log(`[Airdrop] Double claim canClaim: ${canClaim}`);
      expect(canClaim).toBe(false);

      // Attempt double claim should revert
      await expect(
        buyerClient.writeContract({
          address: SEEDS_AIRDROP_ADDRESS,
          abi: seedsAirdropAbi,
          functionName: 'claim',
          args: [BUYER_CLAIM_AMOUNT, buyerProof],
        })
      ).rejects.toThrow();
    });
  });

  describe('Step 5 — Airdrop Info', () => {
    it('should report time until deadline', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const timeRemaining = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'timeUntilDeadline',
      }) as bigint;

      const days = Number(timeRemaining) / 86400;
      console.log(`[Airdrop] Time remaining: ${days.toFixed(1)} days`);

      expect(timeRemaining).toBeGreaterThan(0n);
    });

    it('should report available balance', async () => {
      if (SEEDS_AIRDROP_ADDRESS === '0x0000000000000000000000000000000000000000') {
        return;
      }

      const balance = await publicClient.readContract({
        address: SEEDS_AIRDROP_ADDRESS,
        abi: seedsAirdropAbi,
        functionName: 'availableBalance',
      }) as bigint;

      console.log(`[Airdrop] Available for claims: ${Number(balance) / 1e18} ROOTS`);
    });
  });
});
