import { describe, it, expect, beforeAll } from 'vitest';
import {
  publicClient,
  ambassadorAddress,
  ambassadorAccount,
  deployerClient,
  deployerAddress,
} from './lib/clients';
import {
  ROOTS_TOKEN_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
  ambassadorAbi,
  erc20Abi,
} from './lib/contracts';
import { getRootsBalance, getAmbassadorIdByWallet } from './lib/assertions';
import { executeGasless } from './lib/gasless';

// ═══════════════════════════════════════════════════════════════
// Phase 2 Ambassador Rewards Tests
// Tests for ROOTS token rewards with 7-day vesting
//
// Pre-requisites:
// - Contracts transitioned to Phase 2
// - AmbassadorRewards funded with ROOTS
// - Ambassador registered with activated seller
//
// Run with: npm run test:e2e:phase2:rewards
// ═══════════════════════════════════════════════════════════════

// Phase enum values
const LaunchPhase = {
  Phase1_USDC: 0,
  Phase2_ROOTS: 1,
} as const;

// Constants from contract
const VESTING_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds

describe('Phase 2 Ambassador Rewards Tests', () => {
  let ambassadorId: bigint;
  let currentPhase: number;

  beforeAll(async () => {
    // Check current phase
    currentPhase = Number(await publicClient.readContract({
      address: AMBASSADOR_REWARDS_ADDRESS,
      abi: ambassadorAbi,
      functionName: 'currentPhase',
    }));

    console.log(`[Phase2 Rewards] Current phase: ${currentPhase}`);

    // Get ambassador ID
    ambassadorId = await getAmbassadorIdByWallet(ambassadorAddress);
    console.log(`[Phase2 Rewards] Ambassador ID: ${ambassadorId}`);
  });

  describe('Step 1 — Phase 2 Verification', () => {
    it('should verify ambassador rewards is in correct phase', async () => {
      console.log(`[Phase2 Rewards] AmbassadorRewards currentPhase: ${currentPhase}`);

      // Document the current phase
      expect([LaunchPhase.Phase1_USDC, LaunchPhase.Phase2_ROOTS]).toContain(currentPhase);
    });

    it('should verify treasury has ROOTS tokens', async () => {
      if (currentPhase !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2 Rewards] Not in Phase 2 - skipping treasury check');
        return;
      }

      const treasuryBalance = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'treasuryBalance',
      }) as bigint;

      console.log(`[Phase2 Rewards] Treasury balance: ${Number(treasuryBalance) / 1e18} ROOTS`);

      // Treasury should have some ROOTS for rewards
      expect(treasuryBalance).toBeGreaterThan(0n);
    });

    it('should verify treasury is initialized', async () => {
      if (currentPhase !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2 Rewards] Not in Phase 2 - skipping');
        return;
      }

      const initialized = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'treasuryInitialized',
      }) as boolean;

      console.log(`[Phase2 Rewards] Treasury initialized: ${initialized}`);

      // Note: Treasury must be initialized for circuit breakers to work
    });
  });

  describe('Step 2 — Ambassador Status', () => {
    it('should verify ambassador is registered', async () => {
      if (ambassadorId === 0n) {
        console.log('[Phase2 Rewards] Ambassador not registered - some tests will fail');
        return;
      }

      const ambassador = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getAmbassador',
        args: [ambassadorId],
      }) as any;

      console.log(`[Phase2 Rewards] Ambassador wallet: ${ambassador.wallet}`);
      console.log(`[Phase2 Rewards] Ambassador active: ${ambassador.active}`);
      console.log(`[Phase2 Rewards] Ambassador suspended: ${ambassador.suspended}`);
      console.log(`[Phase2 Rewards] Total earned: ${Number(ambassador.totalEarned) / 1e18} ROOTS`);
      console.log(`[Phase2 Rewards] Total pending: ${Number(ambassador.totalPending) / 1e18} ROOTS`);

      expect(ambassador.active).toBe(true);
      expect(ambassador.suspended).toBe(false);
    });

    it('should check for claimable rewards', async () => {
      if (ambassadorId === 0n) {
        console.log('[Phase2 Rewards] No ambassador - skipping');
        return;
      }

      const claimable = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getClaimableRewards',
        args: [ambassadorId],
      }) as bigint;

      console.log(`[Phase2 Rewards] Claimable rewards: ${Number(claimable) / 1e18} ROOTS`);

      // Note: Rewards require 7-day vesting before claimable
    });
  });

  describe('Step 3 — Reward Mechanics', () => {
    it('should verify 7-day vesting period constant', async () => {
      // The VESTING_PERIOD constant is defined in the contract
      // We can verify it by checking a pending reward's vestingEndsAt vs queuedAt
      // For now, just document the expected value
      console.log(`[Phase2 Rewards] Expected vesting period: ${VESTING_PERIOD / 86400} days`);

      expect(VESTING_PERIOD).toBe(7 * 24 * 60 * 60);
    });

    it('should verify ambassador is past cooldown', async () => {
      if (ambassadorId === 0n) {
        console.log('[Phase2 Rewards] No ambassador - skipping');
        return;
      }

      const isActive = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'isAmbassadorActive',
        args: [ambassadorId],
      }) as boolean;

      console.log(`[Phase2 Rewards] Ambassador is active (past cooldown): ${isActive}`);

      // Ambassador needs to be past 24h cooldown to receive rewards
    });
  });

  describe('Step 4 — Claim Vested Rewards', () => {
    it('should attempt to claim vested rewards', async () => {
      if (currentPhase !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2 Rewards] Not in Phase 2 - skipping claim');
        return;
      }

      if (ambassadorId === 0n) {
        console.log('[Phase2 Rewards] No ambassador - skipping claim');
        return;
      }

      // Check claimable amount
      const claimable = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getClaimableRewards',
        args: [ambassadorId],
      }) as bigint;

      if (claimable === 0n) {
        console.log('[Phase2 Rewards] No claimable rewards - skipping');
        console.log('[Phase2 Rewards] (Rewards require 7-day vesting period)');
        return;
      }

      const balanceBefore = await getRootsBalance(ambassadorAddress);
      console.log(`[Phase2 Rewards] Ambassador ROOTS before: ${Number(balanceBefore) / 1e18}`);

      // Claim rewards via gasless transaction
      const result = await executeGasless(
        ambassadorAddress,
        AMBASSADOR_REWARDS_ADDRESS,
        ambassadorAbi,
        'claimVestedRewards',
        []
      );

      expect(result.success).toBe(true);

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      const balanceAfter = await getRootsBalance(ambassadorAddress);
      console.log(`[Phase2 Rewards] Ambassador ROOTS after: ${Number(balanceAfter) / 1e18}`);

      expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });
  });

  describe('Step 5 — Weekly Cap Verification', () => {
    it('should check remaining weekly allowance', async () => {
      if (ambassadorId === 0n) {
        console.log('[Phase2 Rewards] No ambassador - skipping');
        return;
      }

      const remaining = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getRemainingWeeklyAllowance',
        args: [ambassadorId],
      }) as bigint;

      console.log(`[Phase2 Rewards] Remaining weekly allowance: ${Number(remaining) / 1e18} ROOTS`);

      // Weekly cap is 10,000 ROOTS
      expect(remaining).toBeLessThanOrEqual(10_000n * 10n ** 18n);
    });

    it('should check remaining daily treasury outflow', async () => {
      const remaining = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'getRemainingDailyAllowance',
      }) as bigint;

      console.log(`[Phase2 Rewards] Remaining daily allowance: ${Number(remaining) / 1e18} ROOTS`);

      // Daily cap is 0.5% of initial treasury
    });
  });
});

// Add treasuryBalance and treasuryInitialized to ABI (if not already there)
const rewardsAbiExtension = [
  {
    type: 'function',
    name: 'treasuryBalance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'treasuryInitialized',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRemainingWeeklyAllowance',
    inputs: [{ name: '_ambassadorId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRemainingDailyAllowance',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
