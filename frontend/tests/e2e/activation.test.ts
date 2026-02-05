/**
 * Seller Activation Test
 *
 * Tests the seller activation flow that requires 2 completed orders from 2 unique buyers.
 * This test adds a Buyer2 purchase to complement the Buyer1 purchases from lifecycle.test.ts.
 *
 * Activation requirements (from contract):
 * - completedOrderCount >= 2
 * - uniqueBuyerCount >= 2
 *
 * After this test + lifecycle test, seller will have:
 * - 2 orders from Buyer1 (pickup + delivery)
 * - 1 order from Buyer2
 *
 * Settlement test will verify activation after all orders complete (48h dispute window).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { decodeEventLog, parseEther, maxUint256, type Address } from 'viem';
import {
  publicClient,
  buyerClient,
  buyer2Client,
  buyer2Address,
  sellerAccount,
  sellerAddress,
} from './lib/clients';
import {
  marketplaceAddress,
  marketplaceAbi,
  rootsTokenAddress,
  rootsTokenAbi,
  ambassadorRewardsAddress,
  ambassadorAbi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import { readState, writeState } from './lib/state';

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
      // Not our event, continue
    }
  }
  throw new Error('OrderCreated event not found in receipt');
}

describe('Seller Activation (Buyer2 Purchase)', () => {
  let state: ReturnType<typeof readState>;
  let listingId: bigint;
  let sellerId: bigint;

  beforeAll(() => {
    state = readState();
    if (!state.listingId || !state.sellerId) {
      throw new Error('Run lifecycle.test.ts first to create seller and listing');
    }
    listingId = BigInt(state.listingId);
    sellerId = BigInt(state.sellerId);
    console.log('[Activation] Using listingId:', listingId.toString());
    console.log('[Activation] Using sellerId:', sellerId.toString());
  });

  describe('Pre-activation State', () => {
    it('should show seller NOT activated before buyer2 order', async () => {
      const isActivated = await publicClient.readContract({
        address: ambassadorRewardsAddress,
        abi: ambassadorAbi,
        functionName: 'isSellerActivated',
        args: [sellerId],
      });
      console.log('[Activation] isSellerActivated before buyer2:', isActivated);
      // Should be false - only buyer1 has orders, need 2 unique buyers
      expect(isActivated).toBe(false);
    });

    it('should show recruitment stats from buyer1 orders only', async () => {
      const recruitment = await publicClient.readContract({
        address: ambassadorRewardsAddress,
        abi: ambassadorAbi,
        functionName: 'getSellerRecruitment',
        args: [sellerId],
      }) as {
        ambassadorId: bigint;
        recruitedAt: bigint;
        totalSalesVolume: bigint;
        totalRewardsPaid: bigint;
        completedOrderCount: bigint;
        uniqueBuyerCount: bigint;
        activated: boolean;
      };

      console.log('[Activation] Recruitment before buyer2:');
      console.log('  ambassadorId:', recruitment.ambassadorId.toString());
      console.log('  completedOrderCount:', recruitment.completedOrderCount.toString());
      console.log('  uniqueBuyerCount:', recruitment.uniqueBuyerCount.toString());
      console.log('  activated:', recruitment.activated);

      // Buyer1's orders not yet completed (48h window), so counts should be 0
      expect(recruitment.uniqueBuyerCount).toBe(0n);
      expect(recruitment.completedOrderCount).toBe(0n);
      expect(recruitment.activated).toBe(false);
    });
  });

  describe('Buyer2 Token Approval', () => {
    it('should approve marketplace to spend ROOTS', async () => {
      // Check current allowance
      const currentAllowance = await publicClient.readContract({
        address: rootsTokenAddress,
        abi: rootsTokenAbi,
        functionName: 'allowance',
        args: [buyer2Address, marketplaceAddress],
      });

      if (currentAllowance < parseEther('1000')) {
        const hash = await buyer2Client.writeContract({
          address: rootsTokenAddress,
          abi: rootsTokenAbi,
          functionName: 'approve',
          args: [marketplaceAddress, maxUint256],
        });
        console.log('[Activation] Buyer2 approval tx:', hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe('success');
        console.log('[Activation] Buyer2 approval confirmed');

        // Wait for RPC sync
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        console.log('[Activation] Buyer2 already has sufficient allowance');
      }

      const allowance = await publicClient.readContract({
        address: rootsTokenAddress,
        abi: rootsTokenAbi,
        functionName: 'allowance',
        args: [buyer2Address, marketplaceAddress],
      });
      expect(allowance).toBeGreaterThan(0n);
    });
  });

  describe('Buyer2 Purchase', () => {
    let buyer2OrderId: bigint;

    it('should create purchase from buyer2', async () => {
      const hash = await buyer2Client.writeContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'purchase',
        args: [
          listingId,
          3n, // 3 units
          false, // pickup
          '', // no delivery info
          '0x0000000000000000000000000000000000000000' as Address, // ROOTS payment
        ],
      });
      console.log('[Activation] Buyer2 purchase tx:', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      buyer2OrderId = extractOrderId(receipt);
      console.log('[Activation] Buyer2 orderId:', buyer2OrderId.toString());

      // Persist to state
      writeState({ ...state, buyer2OrderId: buyer2OrderId.toString() });

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));
    });

    it('should verify buyer2 order created correctly', async () => {
      const savedState = readState();
      buyer2OrderId = BigInt(savedState.buyer2OrderId!);

      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [buyer2OrderId],
      }) as readonly [bigint, bigint, Address, bigint, bigint, boolean, number, bigint, Address, string, Address, string, bigint, string, Address];

      // order[2] = buyer, order[3] = quantity, order[6] = status
      expect(order[2].toLowerCase()).toBe(buyer2Address.toLowerCase());
      expect(order[3]).toBe(3n);
      expect(order[6]).toBe(0); // Pending
      console.log('[Activation] Buyer2 order verified: quantity=3, status=Pending');
    });
  });

  describe('Seller Accepts Buyer2 Order', () => {
    it('should accept buyer2 order via gasless relay', async () => {
      const savedState = readState();
      const buyer2OrderId = BigInt(savedState.buyer2OrderId!);

      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'acceptOrder',
        args: [buyer2OrderId],
        abi: marketplaceAbi,
      });
      console.log('[Activation] Accept buyer2 order tx:', hash);
      // executeGasless already waits for receipt and validates success

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      // Verify status
      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [buyer2OrderId],
      }) as readonly unknown[];
      expect(order[6]).toBe(1); // Accepted
      console.log('[Activation] Buyer2 order accepted');
    });
  });

  describe('Seller Uploads Proof for Buyer2 Order', () => {
    it('should mark buyer2 order ready for pickup', async () => {
      const savedState = readState();
      const buyer2OrderId = BigInt(savedState.buyer2OrderId!);

      const hash = await executeGasless({
        account: sellerAccount,
        to: marketplaceAddress,
        functionName: 'markReadyForPickup',
        args: [buyer2OrderId, 'ipfs://test-proof-buyer2-pickup'],
        abi: marketplaceAbi,
      });
      console.log('[Activation] Mark ready for pickup tx:', hash);
      // executeGasless already waits for receipt and validates success

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      // Verify status
      const order = await publicClient.readContract({
        address: marketplaceAddress,
        abi: marketplaceAbi,
        functionName: 'orders',
        args: [buyer2OrderId],
      }) as readonly unknown[];
      expect(order[6]).toBe(2); // ReadyForPickup
      console.log('[Activation] Buyer2 order ready for pickup');

      // Update proofUploadedAt in state
      writeState({
        ...readState(),
        buyer2ProofUploadedAt: Math.floor(Date.now() / 1000),
      });
    });
  });

  describe('Post-Order Activation State', () => {
    it('should still show seller NOT activated (orders not completed)', async () => {
      // Orders complete when claimFunds is called (after 48h dispute window)
      // So seller should still not be activated
      const isActivated = await publicClient.readContract({
        address: ambassadorRewardsAddress,
        abi: ambassadorAbi,
        functionName: 'isSellerActivated',
        args: [sellerId],
      });
      console.log('[Activation] isSellerActivated after buyer2 order:', isActivated);
      expect(isActivated).toBe(false);
    });

    it('should show recruitment stats still at zero (orders pending completion)', async () => {
      const recruitment = await publicClient.readContract({
        address: ambassadorRewardsAddress,
        abi: ambassadorAbi,
        functionName: 'getSellerRecruitment',
        args: [sellerId],
      }) as {
        ambassadorId: bigint;
        recruitedAt: bigint;
        totalSalesVolume: bigint;
        totalRewardsPaid: bigint;
        completedOrderCount: bigint;
        uniqueBuyerCount: bigint;
        activated: boolean;
      };

      console.log('[Activation] Recruitment after buyer2 order:');
      console.log('  completedOrderCount:', recruitment.completedOrderCount.toString());
      console.log('  uniqueBuyerCount:', recruitment.uniqueBuyerCount.toString());
      console.log('  activated:', recruitment.activated);

      // Still 0 because claimFunds hasn't been called yet
      expect(recruitment.completedOrderCount).toBe(0n);
      expect(recruitment.uniqueBuyerCount).toBe(0n);
      expect(recruitment.activated).toBe(false);
    });
  });

  describe('Summary', () => {
    it('should print activation test summary', () => {
      const savedState = readState();
      console.log('\n=== ACTIVATION TEST COMPLETE ===');
      console.log('Buyer2 order ID:', savedState.buyer2OrderId);
      console.log('');
      console.log('Orders pending completion:');
      console.log('  - Pickup order #' + savedState.pickupOrderId + ' (Buyer1)');
      console.log('  - Delivery order #' + savedState.deliveryOrderId + ' (Buyer1)');
      console.log('  - Pickup order #' + savedState.buyer2OrderId + ' (Buyer2)');
      console.log('');
      console.log('After running settlement.test.ts (48h+ later):');
      console.log('  - All 3 orders will have funds claimed');
      console.log('  - completedOrderCount will be >= 2');
      console.log('  - uniqueBuyerCount will be 2 (Buyer1 + Buyer2)');
      console.log('  - Seller will be ACTIVATED');
      console.log('  - Ambassador rewards will start queueing');
      console.log('================================\n');
      expect(true).toBe(true);
    });
  });
});
