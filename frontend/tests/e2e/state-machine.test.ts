/**
 * Order State Machine Edge Case Tests
 *
 * Tests invalid order state transitions to ensure contract enforces
 * the correct state machine.
 *
 * Valid state transitions:
 * Pending → Accepted (seller accepts)
 * Accepted → ReadyForPickup (pickup order) or OutForDelivery (delivery order)
 * ReadyForPickup/OutForDelivery → Completed (buyer completes) or Disputed
 * Disputed → Refunded (seller refunds)
 *
 * This test verifies that invalid transitions are rejected.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { decodeEventLog, parseEther, maxUint256, type Address } from 'viem';
import {
  publicClient,
  buyerClient,
  buyerAddress,
  buyer2Client,
  buyer2Address,
  sellerAccount,
  sellerAddress,
  deployerClient,
  deployerAddress,
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

// Event ABI
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
    } catch { /* continue */ }
  }
  throw new Error('OrderCreated event not found');
}

async function createTestOrder(listingId: bigint): Promise<bigint> {
  const hash = await buyerClient.writeContract({
    address: marketplaceAddress,
    abi: marketplaceAbi,
    functionName: 'purchase',
    args: [listingId, 1n, false, '', '0x0000000000000000000000000000000000000000' as Address],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  await new Promise(r => setTimeout(r, 3000));
  return extractOrderId(receipt);
}

describe('Order State Machine Edge Cases', () => {
  let listingId: bigint;

  beforeAll(() => {
    const state = readState();
    if (!state.listingId) {
      throw new Error('Run lifecycle.test.ts first');
    }
    listingId = BigInt(state.listingId);
    console.log('[StateMachine] Using listingId:', listingId.toString());
  });

  describe('Pending state restrictions', () => {
    let pendingOrderId: bigint;

    it('should create a pending order', async () => {
      pendingOrderId = await createTestOrder(listingId);
      console.log('[StateMachine] Created pending order:', pendingOrderId.toString());

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [pendingOrderId],
      }) as readonly unknown[];
      expect(order[6]).toBe(OrderStatus.Pending);
    });

    it('should reject markReadyForPickup on Pending order', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'markReadyForPickup',
          args: [pendingOrderId, 'ipfs://invalid'],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot markReadyForPickup on Pending ✓');
    });

    it('should reject markOutForDelivery on Pending order', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'markOutForDelivery',
          args: [pendingOrderId, 'ipfs://invalid'],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot markOutForDelivery on Pending ✓');
    });

    it('should reject claimFunds on Pending order', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'claimFunds',
          args: [pendingOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot claimFunds on Pending ✓');
    });

    it('should reject completeOrder on Pending order', async () => {
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [pendingOrderId],
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot completeOrder on Pending ✓');
    });
  });

  describe('Accepted state restrictions', () => {
    let acceptedOrderId: bigint;

    it('should create and accept an order', async () => {
      acceptedOrderId = await createTestOrder(listingId);
      await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [acceptedOrderId],
        abi: marketplaceAbi,
      });
      console.log('[StateMachine] Created accepted order:', acceptedOrderId.toString());

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [acceptedOrderId],
      }) as readonly unknown[];
      expect(order[6]).toBe(OrderStatus.Accepted);
    });

    it('should reject accepting already accepted order', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'acceptOrder',
          args: [acceptedOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot accept already-accepted order ✓');
    });

    it('should reject claimFunds on Accepted (no proof yet)', async () => {
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'claimFunds',
          args: [acceptedOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot claimFunds on Accepted ✓');
    });

    it('should reject completeOrder on Accepted (no proof yet)', async () => {
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [acceptedOrderId],
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot completeOrder on Accepted ✓');
    });
  });

  describe('Authorization checks', () => {
    let testOrderId: bigint;

    it('should create order for auth tests', async () => {
      testOrderId = await createTestOrder(listingId);
      console.log('[StateMachine] Created order for auth tests:', testOrderId.toString());
    });

    it('should reject accept from non-seller', async () => {
      // Buyer trying to accept their own order
      await expect(
        buyerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'acceptOrder',
          args: [testOrderId],
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Non-seller cannot accept order ✓');
    });

    it('should reject raiseDispute from non-buyer', async () => {
      // Accept the order first
      await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [testOrderId],
        abi: marketplaceAbi,
      });

      // Seller trying to raise dispute
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'raiseDispute',
          args: [testOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Non-buyer cannot raise dispute ✓');
    });

    it('should reject completeOrder from non-buyer', async () => {
      // Mark ready for pickup
      await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'markReadyForPickup',
        args: [testOrderId, 'ipfs://test'],
        abi: marketplaceAbi,
      });

      // Deployer (not buyer) trying to complete
      await expect(
        deployerClient.writeContract({
          address: marketplaceAddress,
          abi: marketplaceAbi,
          functionName: 'completeOrder',
          args: [testOrderId],
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Non-buyer cannot complete order ✓');
    });
  });

  describe('claimFunds timing restrictions', () => {
    let readyOrderId: bigint;

    it('should create order in ReadyForPickup state', async () => {
      readyOrderId = await createTestOrder(listingId);
      await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [readyOrderId],
        abi: marketplaceAbi,
      });
      await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'markReadyForPickup',
        args: [readyOrderId, 'ipfs://ready-test'],
        abi: marketplaceAbi,
      });
      console.log('[StateMachine] Created ReadyForPickup order:', readyOrderId.toString());
    });

    it('should reject early claimFunds (dispute window not passed)', async () => {
      // This test confirms the 48h dispute window is enforced
      await expect(
        executeGasless({
          account: sellerAccount,
          to: marketplaceAddress,
          functionName: 'claimFunds',
          args: [readyOrderId],
          abi: marketplaceAbi,
        })
      ).rejects.toThrow();
      console.log('[StateMachine] Cannot claimFunds before dispute window expires ✓');
    });
  });

  describe('Summary', () => {
    it('should print summary', () => {
      console.log('\n=== STATE MACHINE TESTS COMPLETE ===');
      console.log('Tested invalid transitions:');
      console.log('  Pending: no mark ready, no claim, no complete');
      console.log('  Accepted: no double accept, no claim, no complete');
      console.log('Tested auth restrictions:');
      console.log('  Non-seller cannot accept');
      console.log('  Non-buyer cannot dispute or complete');
      console.log('Tested timing restrictions:');
      console.log('  Cannot claim before dispute window');
      console.log('====================================\n');
      expect(true).toBe(true);
    });
  });
});
