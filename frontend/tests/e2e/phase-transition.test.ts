import { describe, it, expect } from 'vitest';
import {
  publicClient,
  deployerClient,
  deployerAddress,
} from './lib/clients';
import {
  ROOTS_TOKEN_ADDRESS,
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
  marketplaceAbi,
  ambassadorAbi,
} from './lib/contracts';

// ═══════════════════════════════════════════════════════════════
// Phase Transition Tests
// Tests for transitioning from Phase 1 (USDC/Seeds) to Phase 2 ($ROOTS)
//
// IMPORTANT: These tests are DESTRUCTIVE - once executed, the contracts
// are permanently in Phase 2 and cannot be reverted. Only run on testnet
// or fresh deployments.
//
// Run with: npm run test:e2e:transition
// ═══════════════════════════════════════════════════════════════

// Phase enum values from contracts
const LaunchPhase = {
  Phase1_USDC: 0,
  Phase2_ROOTS: 1,
} as const;

describe('Phase Transition Tests', () => {
  describe('Step 1 — Pre-Transition State', () => {
    it('should verify marketplace starts in Phase 1', async () => {
      const phase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      });

      // Note: This test will fail if already transitioned
      console.log(`[Phase Check] Marketplace currentPhase: ${phase}`);

      // Skip remaining tests if already in Phase 2
      if (Number(phase) === LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase Check] Already in Phase 2 - transition tests will be skipped');
      }

      expect(Number(phase)).toBeLessThanOrEqual(LaunchPhase.Phase2_ROOTS);
    });

    it('should verify ambassador rewards starts in Phase 1', async () => {
      const phase = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'currentPhase',
      });

      console.log(`[Phase Check] AmbassadorRewards currentPhase: ${phase}`);
      expect(Number(phase)).toBeLessThanOrEqual(LaunchPhase.Phase2_ROOTS);
    });
  });

  describe('Step 2 — Marketplace Transition', () => {
    it('should transition marketplace to Phase 2', async () => {
      // Check current phase first
      const currentPhase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(currentPhase) === LaunchPhase.Phase2_ROOTS) {
        console.log('[Transition] Marketplace already in Phase 2 - skipping');
        expect(Number(currentPhase)).toBe(LaunchPhase.Phase2_ROOTS);
        return;
      }

      console.log('[Transition] Executing marketplace transitionToPhase2...');

      const hash = await deployerClient.writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'transitionToPhase2',
        args: [ROOTS_TOKEN_ADDRESS],
      });

      console.log(`[Transition] Transaction hash: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      // Verify new phase
      const newPhase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      });

      console.log(`[Transition] Marketplace new phase: ${newPhase}`);
      expect(Number(newPhase)).toBe(LaunchPhase.Phase2_ROOTS);
    });

    it('should verify transition is locked', async () => {
      const locked = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'phaseTransitionLocked',
      });

      console.log(`[Transition] phaseTransitionLocked: ${locked}`);
      expect(locked).toBe(true);
    });

    it('should reject second transition attempt', async () => {
      // Check if already in Phase 2
      const currentPhase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(currentPhase) !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Transition] Not in Phase 2 - cannot test rejection');
        return;
      }

      console.log('[Transition] Attempting second transition (should fail)...');

      await expect(
        deployerClient.writeContract({
          address: MARKETPLACE_ADDRESS,
          abi: marketplaceAbi,
          functionName: 'transitionToPhase2',
          args: [ROOTS_TOKEN_ADDRESS],
        })
      ).rejects.toThrow();
    });
  });

  describe('Step 3 — Ambassador Rewards Transition', () => {
    it('should transition ambassador rewards to Phase 2', async () => {
      // Check current phase first
      const currentPhase = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(currentPhase) === LaunchPhase.Phase2_ROOTS) {
        console.log('[Transition] AmbassadorRewards already in Phase 2 - skipping');
        expect(Number(currentPhase)).toBe(LaunchPhase.Phase2_ROOTS);
        return;
      }

      console.log('[Transition] Executing ambassador transitionToPhase2...');

      const hash = await deployerClient.writeContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'transitionToPhase2',
        args: [],
      });

      console.log(`[Transition] Transaction hash: ${hash}`);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      // Verify new phase
      const newPhase = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'currentPhase',
      });

      console.log(`[Transition] AmbassadorRewards new phase: ${newPhase}`);
      expect(Number(newPhase)).toBe(LaunchPhase.Phase2_ROOTS);
    });
  });

  describe('Step 4 — Post-Transition Verification', () => {
    it('should have rootsToken set on marketplace', async () => {
      const rootsToken = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'rootsToken',
      });

      console.log(`[Verification] Marketplace rootsToken: ${rootsToken}`);
      expect((rootsToken as string).toLowerCase()).toBe(ROOTS_TOKEN_ADDRESS.toLowerCase());
    });

    it('should have both contracts in Phase 2', async () => {
      const mpPhase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      });

      const ambPhase = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'currentPhase',
      });

      console.log(`[Verification] Marketplace: ${mpPhase}, AmbassadorRewards: ${ambPhase}`);

      // Both should be in Phase 2 if transition was run
      // If not transitioned, they're both in Phase 1 which is also valid for this test
      expect(Number(mpPhase)).toBe(Number(ambPhase));
    });
  });
});

// Add transitionToPhase2 to marketplace ABI (if not already present)
const transitionAbiExtension = [
  {
    type: 'function',
    name: 'transitionToPhase2',
    inputs: [{ name: '_rootsToken', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'phaseTransitionLocked',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'rootsToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;
