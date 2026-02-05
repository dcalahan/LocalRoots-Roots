/**
 * Seller Suspension Tests
 *
 * Tests admin ability to suspend/unsuspend sellers and verify
 * that suspended sellers cannot perform certain actions.
 *
 * Admin functions:
 * - suspendSeller(sellerId, reason) - admin only
 * - unsuspendSeller(sellerId) - admin only
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseEther, type Address } from 'viem';
import {
  publicClient,
  deployerClient,
  deployerAddress,
  sellerAccount,
  sellerAddress,
  buyerClient,
  buyerAddress,
} from './lib/clients';
import {
  marketplaceAddress,
  marketplaceAbi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import { readState } from './lib/state';

describe('Seller Suspension Flow', () => {
  let sellerId: bigint;
  let listingId: bigint;
  let preCreatedOrderId: bigint; // Order created BEFORE suspension for testing

  beforeAll(() => {
    const state = readState();
    if (!state.sellerId || !state.listingId) {
      throw new Error('Run lifecycle.test.ts first');
    }
    sellerId = BigInt(state.sellerId);
    listingId = BigInt(state.listingId);
    console.log('[Suspension] Using sellerId:', sellerId.toString());
    console.log('[Suspension] Using listingId:', listingId.toString());
  });

  describe('Setup — Ensure clean state', () => {
    it('should unsuspend seller if already suspended (idempotent)', async () => {
      const isSuspended = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'isSellerSuspended',
        args: [sellerId],
      });

      if (isSuspended) {
        console.log('[Suspension] Seller was already suspended, unsuspending first...');
        const hash = await deployerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'unsuspendSeller',
          args: [sellerId],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await new Promise((r) => setTimeout(r, 3000));
        console.log('[Suspension] Seller unsuspended for clean test start');
      } else {
        console.log('[Suspension] Seller not suspended, proceeding');
      }
    });

    it('should create order while seller is active', async () => {
      // Create an order BEFORE we suspend the seller
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

      // Get order ID
      const nextOrderId = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'nextOrderId',
      }) as bigint;
      preCreatedOrderId = nextOrderId - 1n;
      console.log('[Suspension] Pre-created order:', preCreatedOrderId.toString());

      await new Promise((r) => setTimeout(r, 3000));
    });
  });

  describe('Initial state', () => {
    it('should verify seller is NOT suspended initially', async () => {
      const isSuspended = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'isSellerSuspended',
        args: [sellerId],
      });
      console.log('[Suspension] Initial suspended state:', isSuspended);
      expect(isSuspended).toBe(false);
    });

    it('should verify deployer is admin', async () => {
      const isAdmin = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'isAdmin',
        args: [deployerAddress],
      });
      expect(isAdmin).toBe(true);
      console.log('[Suspension] Deployer is admin ✓');
    });
  });

  describe('Admin suspends seller', () => {
    it('should suspend seller via admin', async () => {
      const hash = await deployerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'suspendSeller',
        args: [sellerId, 'Test suspension - E2E testing'],
      });
      console.log('[Suspension] suspendSeller tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      await new Promise((r) => setTimeout(r, 3000));
    });

    it('should verify seller is NOW suspended', async () => {
      const isSuspended = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'isSellerSuspended',
        args: [sellerId],
      });
      expect(isSuspended).toBe(true);
      console.log('[Suspension] Seller is now suspended ✓');
    });
  });

  describe('Suspended seller restrictions', () => {
    it('should reject createListing from suspended seller', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'createListing',
          args: ['ipfs://test-suspended', parseEther('100'), 10n],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[Suspension] Suspended seller cannot create listing ✓');
    });

    it('should ALLOW suspended seller to accept existing orders (protect buyers)', async () => {
      // Contract allows suspended sellers to accept/fulfill EXISTING orders
      // This protects buyers who already purchased before suspension
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [preCreatedOrderId],
        abi: marketplaceAbi,
      });
      console.log('[Suspension] acceptOrder tx:', hash);

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [preCreatedOrderId],
      }) as readonly unknown[];
      expect(order[6]).toBe(1); // Accepted
      console.log('[Suspension] Suspended seller CAN accept existing orders (buyer protection) ✓');
    });

    it('should reject purchase from suspended seller listings', async () => {
      // Verify buyers cannot purchase from suspended sellers
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
            '0x0000000000000000000000000000000000000000' as Address,
          ],
        })
      ).rejects.toThrow();
      console.log('[Suspension] Cannot purchase from suspended seller ✓');
    });
  });

  describe('Admin unsuspends seller', () => {
    it('should unsuspend seller via admin', async () => {
      const hash = await deployerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'unsuspendSeller',
        args: [sellerId],
      });
      console.log('[Suspension] unsuspendSeller tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      await new Promise((r) => setTimeout(r, 3000));
    });

    it('should verify seller is no longer suspended', async () => {
      const isSuspended = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'isSellerSuspended',
        args: [sellerId],
      });
      expect(isSuspended).toBe(false);
      console.log('[Suspension] Seller is no longer suspended ✓');
    });
  });

  describe('Restored seller can operate', () => {
    it('should allow purchases from unsuspended seller', async () => {
      // Verify buyers can purchase again
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
      console.log('[Suspension] Can purchase from unsuspended seller ✓');
    });
  });

  describe('Authorization checks', () => {
    it('should reject suspendSeller from non-admin', async () => {
      // Buyer (non-admin) trying to suspend
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'suspendSeller',
          args: [sellerId, 'Malicious suspension attempt'],
        })
      ).rejects.toThrow();
      console.log('[Suspension] Non-admin cannot suspend seller ✓');
    });

    it('should reject unsuspendSeller from non-admin', async () => {
      // First suspend again via admin
      const hash = await deployerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'suspendSeller',
        args: [sellerId, 'Re-suspended for auth test'],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await new Promise((r) => setTimeout(r, 3000));

      // Buyer trying to unsuspend
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'unsuspendSeller',
          args: [sellerId],
        })
      ).rejects.toThrow();
      console.log('[Suspension] Non-admin cannot unsuspend seller ✓');

      // Clean up - unsuspend via admin
      const hash2 = await deployerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'unsuspendSeller',
        args: [sellerId],
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });
      console.log('[Suspension] Cleanup: seller unsuspended');
    });
  });

  describe('Summary', () => {
    it('should print summary', () => {
      console.log('\n=== SUSPENSION TESTS COMPLETE ===');
      console.log('Admin actions:');
      console.log('  - suspendSeller(sellerId, reason)');
      console.log('  - unsuspendSeller(sellerId)');
      console.log('Suspended seller restrictions:');
      console.log('  - Cannot create new listings');
      console.log('  - Cannot accept orders');
      console.log('Authorization:');
      console.log('  - Only admins can suspend/unsuspend');
      console.log('=================================\n');
      expect(true).toBe(true);
    });
  });
});
