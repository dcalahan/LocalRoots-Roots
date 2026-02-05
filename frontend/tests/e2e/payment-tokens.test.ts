/**
 * Payment Token Tests
 *
 * Tests payment token configurations in Phase 2.
 *
 * Phase 2 payment options:
 * - ROOTS (address(0) or ROOTS address) - Direct payment
 * - Stablecoins (USDC/USDT) - Requires swap router to be configured
 *
 * Current state: Swap router is NOT configured, so stablecoin payments
 * will fail with "Swap router not configured". This is expected and tested.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseEther, type Address } from 'viem';
import {
  publicClient,
  buyerClient,
  buyerAddress,
} from './lib/clients';
import {
  marketplaceAddress,
  marketplaceAbi,
  rootsTokenAddress,
} from './lib/contracts';
import { readState } from './lib/state';

// USDC and USDT addresses from .env.test
const USDC_ADDRESS = '0xBe0D90a4C6BBC99a37BA0A5aA9Ffaa894f826e06' as Address;
const USDT_ADDRESS = '0x3c69B46E4Ab4141F0089a5289dBC20f33A36981b' as Address;

// Phase enum values
const LaunchPhase = {
  Phase1_USDC: 0,
  Phase2_ROOTS: 1,
};

describe('Payment Token Configuration', () => {
  let listingId: bigint;

  beforeAll(() => {
    const state = readState();
    if (!state.listingId) {
      throw new Error('Run lifecycle.test.ts first');
    }
    listingId = BigInt(state.listingId);
    console.log('[PaymentTokens] Using listingId:', listingId.toString());
  });

  describe('Phase and token status', () => {
    it('should be in Phase 2 (ROOTS)', async () => {
      const phase = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      });
      expect(phase).toBe(LaunchPhase.Phase2_ROOTS);
      console.log('[PaymentTokens] Current phase: Phase 2 (ROOTS) ✓');
    });

    it('should list accepted payment tokens', async () => {
      const tokens = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'getAcceptedPaymentTokens',
      }) as Address[];

      console.log('[PaymentTokens] Accepted tokens:');
      for (const token of tokens) {
        const label =
          token.toLowerCase() === rootsTokenAddress.toLowerCase() ? 'ROOTS' :
          token.toLowerCase() === USDC_ADDRESS.toLowerCase() ? 'USDC' :
          token.toLowerCase() === USDT_ADDRESS.toLowerCase() ? 'USDT' :
          'Unknown';
        console.log(`  - ${token} (${label})`);
      }

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.map(t => t.toLowerCase())).toContain(rootsTokenAddress.toLowerCase());
    });

    it('should have swap router NOT configured', async () => {
      const swapRouter = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'swapRouter',
      });
      expect(swapRouter).toBe('0x0000000000000000000000000000000000000000');
      console.log('[PaymentTokens] Swap router: NOT configured ✓');
      console.log('[PaymentTokens] Note: Stablecoin payments require swap router');
    });
  });

  describe('ROOTS payment (Phase 2 direct)', () => {
    it('should accept payment with ROOTS token address', async () => {
      // Using ROOTS address explicitly
      const hash = await buyerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'purchase',
        args: [
          listingId,
          1n,
          false,
          '',
          rootsTokenAddress, // Explicit ROOTS address
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');
      console.log('[PaymentTokens] ROOTS payment (explicit address) ✓');

      // Wait for RPC to sync nonce
      await new Promise((r) => setTimeout(r, 3000));
    });

    it('should accept payment with zero address (defaults to ROOTS)', async () => {
      // Using address(0) defaults to ROOTS payment
      const hash = await buyerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'purchase',
        args: [
          listingId,
          1n,
          false,
          '',
          '0x0000000000000000000000000000000000000000' as Address,
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');
      console.log('[PaymentTokens] ROOTS payment (zero address) ✓');
    });
  });

  describe('Stablecoin payment (requires swap router)', () => {
    it('should reject USDC payment without swap router', async () => {
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: [
            listingId,
            1n,
            false,
            '',
            USDC_ADDRESS,
          ],
        })
      ).rejects.toThrow();
      console.log('[PaymentTokens] USDC payment rejected (no swap router) ✓');
    });

    it('should reject USDT payment without swap router', async () => {
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'purchase',
          args: [
            listingId,
            1n,
            false,
            '',
            USDT_ADDRESS,
          ],
        })
      ).rejects.toThrow();
      console.log('[PaymentTokens] USDT payment rejected (no swap router) ✓');
    });
  });

  describe('Summary', () => {
    it('should print summary', () => {
      console.log('\n=== PAYMENT TOKEN TESTS COMPLETE ===');
      console.log('Phase 2 payment options:');
      console.log('  ✓ ROOTS (direct) - Working');
      console.log('  ✗ USDC/USDT - Requires swap router');
      console.log('');
      console.log('To enable stablecoin payments:');
      console.log('  1. Deploy a swap router (Uniswap/DEX adapter)');
      console.log('  2. Admin calls setSwapRouter(routerAddress)');
      console.log('  3. Buyer approves stablecoin to marketplace');
      console.log('====================================\n');
      expect(true).toBe(true);
    });
  });
});
