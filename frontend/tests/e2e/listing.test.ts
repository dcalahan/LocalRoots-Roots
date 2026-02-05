/**
 * Listing Deactivation Tests
 *
 * Tests seller ability to deactivate/reactivate listings via updateListing.
 * Deactivated listings cannot receive new purchases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { parseEther, type Address } from 'viem';
import {
  publicClient,
  buyerClient,
  buyerAddress,
  sellerAccount,
  sellerAddress,
} from './lib/clients';
import {
  marketplaceAddress,
  marketplaceAbi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import { readState } from './lib/state';

describe('Listing Deactivation Flow', () => {
  let listingId: bigint;
  let originalMetadata: string;
  let originalPrice: bigint;
  let originalQuantity: bigint;

  beforeAll(async () => {
    const state = readState();
    if (!state.listingId) {
      throw new Error('Run lifecycle.test.ts first');
    }
    listingId = BigInt(state.listingId);
    console.log('[Listing] Using listingId:', listingId.toString());

    // Get current listing state to preserve values
    const listing = await publicClient.readContract({
      address: marketplaceAddress,
      abi: marketplaceAbi,
      functionName: 'listings',
      args: [listingId],
    }) as readonly [bigint, string, bigint, bigint, boolean];

    originalMetadata = listing[1];
    originalPrice = listing[2];
    originalQuantity = listing[3];
    console.log('[Listing] Original price:', originalPrice.toString());
    console.log('[Listing] Original quantity:', originalQuantity.toString());
  });

  describe('Initial state', () => {
    it('should verify listing is active initially', async () => {
      const listing = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'listings',
        args: [listingId],
      }) as readonly [bigint, string, bigint, bigint, boolean];

      // listing[4] is active
      expect(listing[4]).toBe(true);
      console.log('[Listing] Listing is active ✓');
    });
  });

  describe('Seller deactivates listing', () => {
    it('should deactivate listing via updateListing', async () => {
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'updateListing',
        args: [
          listingId,
          originalMetadata,
          originalPrice,
          originalQuantity,
          false, // active = false
        ],
        abi: marketplaceAbi,
      });
      console.log('[Listing] updateListing (deactivate) tx:', hash);
    });

    it('should verify listing is now inactive', async () => {
      const listing = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'listings',
        args: [listingId],
      }) as readonly [bigint, string, bigint, bigint, boolean];

      expect(listing[4]).toBe(false);
      console.log('[Listing] Listing is now inactive ✓');
    });
  });

  describe('Cannot purchase from inactive listing', () => {
    it('should reject purchase from inactive listing', async () => {
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
      console.log('[Listing] Cannot purchase from inactive listing ✓');
    });
  });

  describe('Seller reactivates listing', () => {
    it('should reactivate listing via updateListing', async () => {
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'updateListing',
        args: [
          listingId,
          originalMetadata,
          originalPrice,
          originalQuantity,
          true, // active = true
        ],
        abi: marketplaceAbi,
      });
      console.log('[Listing] updateListing (reactivate) tx:', hash);
    });

    it('should verify listing is active again', async () => {
      const listing = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'listings',
        args: [listingId],
      }) as readonly [bigint, string, bigint, bigint, boolean];

      expect(listing[4]).toBe(true);
      console.log('[Listing] Listing is active again ✓');
    });

    it('should allow purchase from reactivated listing', async () => {
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
      console.log('[Listing] Can purchase from reactivated listing ✓');
    });
  });

  describe('Authorization checks', () => {
    it('should reject updateListing from non-owner', async () => {
      // Buyer trying to update seller's listing
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'updateListing',
          args: [
            listingId,
            'ipfs://malicious',
            parseEther('1'), // Try to set price to 1
            1000n,
            true,
          ],
        })
      ).rejects.toThrow();
      console.log('[Listing] Non-owner cannot update listing ✓');
    });
  });

  describe('Summary', () => {
    it('should print summary', () => {
      console.log('\n=== LISTING TESTS COMPLETE ===');
      console.log('Seller actions:');
      console.log('  - updateListing(..., active=false) to deactivate');
      console.log('  - updateListing(..., active=true) to reactivate');
      console.log('Restrictions:');
      console.log('  - Cannot purchase from inactive listing');
      console.log('  - Only listing owner can update');
      console.log('==============================\n');
      expect(true).toBe(true);
    });
  });
});
