/**
 * Dispute and Refund Flow Test
 *
 * Tests the buyer dispute → seller refund flow.
 * Creates a fresh order to avoid interfering with lifecycle tests.
 *
 * Order statuses:
 * 0: Pending
 * 1: Accepted
 * 2: ReadyForPickup
 * 3: OutForDelivery
 * 4: Completed
 * 5: Disputed
 * 6: Refunded
 * 7: Cancelled
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { decodeEventLog, parseEther, maxUint256, type Address } from 'viem';
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
  rootsTokenAddress,
  rootsTokenAbi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import { readState } from './lib/state';

// Order statuses
const OrderStatus = {
  Pending: 0,
  Accepted: 1,
  ReadyForPickup: 2,
  OutForDelivery: 3,
  Completed: 4,
  Disputed: 5,
  Refunded: 6,
  Cancelled: 7,
};

// Event ABI for extracting order ID
const orderCreatedAbi = [
  {
    type: 'event',
    name: 'OrderCreated',
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'listingId', type: 'uint256', indexed: true },
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'quantity', type: 'uint256', indexed: false },
    ],
  },
] as const;

function extractOrderId(receipt: { logs: readonly { data: `0x${string}`; topics: readonly `0x${string}`[] }[] }): bigint {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: orderCreatedAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'OrderCreated') {
        return decoded.args.orderId;
      }
    } catch {
      // Not our event
    }
  }
  throw new Error('OrderCreated event not found');
}

describe('Dispute and Refund Flow', () => {
  let listingId: bigint;
  let disputeOrderId: bigint;
  let buyerBalanceBefore: bigint;

  beforeAll(() => {
    const state = readState();
    if (!state.listingId) {
      throw new Error('Run lifecycle.test.ts first to create listing');
    }
    listingId = BigInt(state.listingId);
    console.log('[Dispute] Using listingId:', listingId.toString());
  });

  describe('Setup — Create order for dispute test', () => {
    it('should ensure buyer has ROOTS approval', async () => {
      const allowance = await publicClient.readContract({
        address: rootsTokenAddress,
        abi: rootsTokenAbi,
        functionName: 'allowance',
        args: [buyerAddress, marketplaceAddress],
      });

      if (allowance < parseEther('500')) {
        const hash = await buyerClient.writeContract({
          address: rootsTokenAddress,
          abi: rootsTokenAbi,
          functionName: 'approve',
          args: [marketplaceAddress, maxUint256],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe('success');
        await new Promise((r) => setTimeout(r, 3000));
      }
      console.log('[Dispute] Buyer approval OK');
    });

    it('should record buyer balance before purchase', async () => {
      buyerBalanceBefore = await publicClient.readContract({
        address: rootsTokenAddress,
        abi: rootsTokenAbi,
        functionName: 'balanceOf',
        args: [buyerAddress],
      }) as bigint;
      console.log('[Dispute] Buyer ROOTS before:', buyerBalanceBefore.toString());
    });

    it('should create a purchase for dispute test', async () => {
      const hash = await buyerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'purchase',
        args: [
          listingId,
          2n, // 2 units = 200 ROOTS
          false, // pickup
          '',
          '0x0000000000000000000000000000000000000000' as Address, // ROOTS payment
        ],
      });
      console.log('[Dispute] Purchase tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      disputeOrderId = extractOrderId(receipt);
      console.log('[Dispute] Order ID for dispute test:', disputeOrderId.toString());

      await new Promise((r) => setTimeout(r, 3000));
    });

    it('should verify order is Pending', async () => {
      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      expect(order[6]).toBe(OrderStatus.Pending);
      console.log('[Dispute] Order status: Pending');
    });
  });

  describe('Seller accepts and marks ready', () => {
    it('should accept order via gasless relay', async () => {
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [disputeOrderId],
        abi: marketplaceAbi,
      });
      console.log('[Dispute] Accept tx:', hash);

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      expect(order[6]).toBe(OrderStatus.Accepted);
      console.log('[Dispute] Order status: Accepted');
    });

    it('should mark ready for pickup', async () => {
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'markReadyForPickup',
        args: [disputeOrderId, 'ipfs://test-proof-dispute'],
        abi: marketplaceAbi,
      });
      console.log('[Dispute] Mark ready tx:', hash);

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      expect(order[6]).toBe(OrderStatus.ReadyForPickup);
      console.log('[Dispute] Order status: ReadyForPickup');
    });
  });

  describe('Buyer raises dispute', () => {
    it('should raise dispute from buyer wallet', async () => {
      const hash = await buyerClient.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'raiseDispute',
        args: [disputeOrderId],
      });
      console.log('[Dispute] raiseDispute tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      await new Promise((r) => setTimeout(r, 3000));

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      expect(order[6]).toBe(OrderStatus.Disputed);
      console.log('[Dispute] Order status: Disputed');
    });

    it('should verify funds NOT released yet', async () => {
      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      // fundsReleased is index 12
      expect(order[12]).toBe(false);
      console.log('[Dispute] fundsReleased: false (still in escrow)');
    });
  });

  describe('Seller refunds buyer', () => {
    it('should refund buyer via gasless relay', async () => {
      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'refundBuyer',
        args: [disputeOrderId],
        abi: marketplaceAbi,
      });
      console.log('[Dispute] refundBuyer tx:', hash);

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      expect(order[6]).toBe(OrderStatus.Refunded);
      console.log('[Dispute] Order status: Refunded');
    });

    it('should verify funds released (to buyer)', async () => {
      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [disputeOrderId],
      }) as readonly unknown[];

      // fundsReleased is index 12
      expect(order[12]).toBe(true);
      console.log('[Dispute] fundsReleased: true');
    });

    it('should verify buyer received refund', async () => {
      const buyerBalanceAfter = await publicClient.readContract({
        address: rootsTokenAddress,
        abi: rootsTokenAbi,
        functionName: 'balanceOf',
        args: [buyerAddress],
      }) as bigint;

      console.log('[Dispute] Buyer ROOTS after refund:', buyerBalanceAfter.toString());

      // Buyer should have their tokens back (balance restored)
      // Small tolerance for any fees
      expect(buyerBalanceAfter).toBeGreaterThanOrEqual(buyerBalanceBefore - parseEther('1'));
      console.log('[Dispute] Buyer refund verified');
    });
  });

  describe('Negative tests — Invalid dispute attempts', () => {
    it('should reject dispute on already refunded order', async () => {
      // Try to raise dispute again on refunded order
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'raiseDispute',
          args: [disputeOrderId],
        })
      ).rejects.toThrow();
      console.log('[Dispute] Cannot dispute refunded order ✓');
    });

    it('should reject refund on non-disputed order', async () => {
      // Create a new order and try to refund without disputing
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
      const newOrderId = extractOrderId(receipt);
      await new Promise((r) => setTimeout(r, 3000));

      // Try to refund without disputing first
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'refundBuyer',
          args: [newOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[Dispute] Cannot refund non-disputed order ✓');
    });
  });

  describe('Summary', () => {
    it('should print dispute flow summary', () => {
      console.log('\n=== DISPUTE FLOW TEST COMPLETE ===');
      console.log('Order ID:', disputeOrderId.toString());
      console.log('Flow tested:');
      console.log('  1. Purchase → Pending');
      console.log('  2. Accept → Accepted');
      console.log('  3. Mark ready → ReadyForPickup');
      console.log('  4. Raise dispute → Disputed');
      console.log('  5. Refund buyer → Refunded');
      console.log('  6. Buyer tokens returned ✓');
      console.log('Negative tests:');
      console.log('  - Cannot dispute refunded order');
      console.log('  - Cannot refund non-disputed order');
      console.log('==================================\n');
      expect(true).toBe(true);
    });
  });
});
