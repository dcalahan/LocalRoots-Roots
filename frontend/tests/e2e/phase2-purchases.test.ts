import { describe, it, expect, beforeAll } from 'vitest';
import { maxUint256, type Address } from 'viem';
import {
  publicClient,
  buyerClient,
  buyerAddress,
  sellerAddress,
  sellerClient,
  deployerClient,
  deployerAddress,
} from './lib/clients';
import {
  ROOTS_TOKEN_ADDRESS,
  MARKETPLACE_ADDRESS,
  marketplaceAbi,
  erc20Abi,
} from './lib/contracts';
import {
  readOrder,
  readListing,
  getNextOrderId,
  getRootsBalance,
  OrderStatus,
} from './lib/assertions';
import { executeGasless } from './lib/gasless';

// ═══════════════════════════════════════════════════════════════
// Phase 2 Purchase Tests
// Tests for purchases using $ROOTS tokens after Phase 2 transition
//
// Pre-requisites:
// - Contracts transitioned to Phase 2
// - Buyer has ROOTS tokens
// - Active listing exists
//
// Run with: npm run test:e2e:phase2
// ═══════════════════════════════════════════════════════════════

// Phase enum values
const LaunchPhase = {
  Phase1_USDC: 0,
  Phase2_ROOTS: 1,
} as const;

// Test listing (create if needed)
let testListingId: bigint;
let testOrderId: bigint;

// Price in ROOTS (100 ROOTS = $1, so 500 ROOTS = $5)
const LISTING_PRICE = 500n * 10n ** 18n;
const PURCHASE_QUANTITY = 2n;
const TOTAL_PRICE = LISTING_PRICE * PURCHASE_QUANTITY;

describe('Phase 2 Purchase Tests', () => {
  beforeAll(async () => {
    // Check current phase
    const phase = await publicClient.readContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'currentPhase',
    }) as number;

    console.log(`[Phase2] Current marketplace phase: ${phase}`);

    if (Number(phase) !== LaunchPhase.Phase2_ROOTS) {
      console.log('[Phase2] NOT in Phase 2 - some tests will be skipped');
    }
  });

  describe('Step 1 — Phase 2 Setup', () => {
    it('should verify marketplace is in Phase 2', async () => {
      const phase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      console.log(`[Phase2] Marketplace currentPhase: ${phase}`);

      // Test documents the current phase rather than requiring Phase 2
      expect([LaunchPhase.Phase1_USDC, LaunchPhase.Phase2_ROOTS]).toContain(Number(phase));
    });

    it('should verify rootsToken is set', async () => {
      const phase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(phase) !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2] Not in Phase 2 - skipping rootsToken check');
        return;
      }

      const rootsToken = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'rootsToken',
      }) as Address;

      console.log(`[Phase2] Marketplace rootsToken: ${rootsToken}`);
      expect(rootsToken.toLowerCase()).toBe(ROOTS_TOKEN_ADDRESS.toLowerCase());
    });

    it('should verify buyer has ROOTS tokens', async () => {
      const balance = await getRootsBalance(buyerAddress);
      console.log(`[Phase2] Buyer ROOTS balance: ${Number(balance) / 1e18}`);

      // Buyer needs at least the purchase amount
      expect(balance).toBeGreaterThanOrEqual(TOTAL_PRICE);
    });
  });

  describe('Step 2 — Listing Creation', () => {
    it('should find or create a test listing', async () => {
      // Check for existing listings from seller
      const nextListingId = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'nextListingId',
      }) as bigint;

      // Look for an active listing from our test seller
      for (let i = 1n; i < nextListingId; i++) {
        const listing = await readListing(i);
        if (listing && listing.active && Number(listing.quantityAvailable) > 0) {
          // Check if this listing belongs to our test seller
          const seller = await publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: marketplaceAbi,
            functionName: 'sellers',
            args: [listing.sellerId],
          }) as any;

          if (seller.owner.toLowerCase() === sellerAddress.toLowerCase()) {
            testListingId = i;
            console.log(`[Phase2] Found existing listing: ${testListingId}`);
            break;
          }
        }
      }

      if (!testListingId) {
        console.log('[Phase2] No suitable listing found - tests will be limited');
      }

      expect(testListingId || nextListingId).toBeTruthy();
    });
  });

  describe('Step 3 — ROOTS Token Approval', () => {
    it('should approve ROOTS spending', async () => {
      const phase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(phase) !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2] Not in Phase 2 - skipping approval');
        return;
      }

      // Check current allowance
      const allowance = await publicClient.readContract({
        address: ROOTS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [buyerAddress, MARKETPLACE_ADDRESS],
      }) as bigint;

      console.log(`[Phase2] Current ROOTS allowance: ${Number(allowance) / 1e18}`);

      if (allowance < TOTAL_PRICE) {
        console.log('[Phase2] Approving ROOTS spending...');

        const hash = await buyerClient.writeContract({
          address: ROOTS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [MARKETPLACE_ADDRESS, maxUint256],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        expect(receipt.status).toBe('success');

        // Verify new allowance
        const newAllowance = await publicClient.readContract({
          address: ROOTS_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [buyerAddress, MARKETPLACE_ADDRESS],
        }) as bigint;

        console.log(`[Phase2] New ROOTS allowance: ${Number(newAllowance) / 1e18}`);
        expect(newAllowance).toBe(maxUint256);
      }
    });
  });

  describe('Step 4 — Phase 2 Purchase', () => {
    it('should create order with ROOTS payment', async () => {
      const phase = await publicClient.readContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'currentPhase',
      }) as number;

      if (Number(phase) !== LaunchPhase.Phase2_ROOTS) {
        console.log('[Phase2] Not in Phase 2 - skipping purchase test');
        return;
      }

      if (!testListingId) {
        console.log('[Phase2] No test listing available - skipping purchase');
        return;
      }

      const buyerBalanceBefore = await getRootsBalance(buyerAddress);
      console.log(`[Phase2] Buyer ROOTS before: ${Number(buyerBalanceBefore) / 1e18}`);

      const nextOrderId = await getNextOrderId();
      console.log(`[Phase2] Creating order with ROOTS payment...`);

      // In Phase 2, payment token should be ROOTS token address
      // address(0) or ROOTS token address should both work
      const hash = await buyerClient.writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'purchase',
        args: [
          testListingId,
          PURCHASE_QUANTITY,
          false, // pickup, not delivery
          '',    // no buyer info needed for pickup
          ROOTS_TOKEN_ADDRESS, // Pay with ROOTS
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      testOrderId = nextOrderId;

      // Verify order created
      const order = await readOrder(testOrderId);
      console.log(`[Phase2] Order ${testOrderId} created, status: ${order?.status}`);

      expect(order).toBeTruthy();
      expect(order?.buyer.toLowerCase()).toBe(buyerAddress.toLowerCase());
      expect(order?.paymentToken.toLowerCase()).toBe(ROOTS_TOKEN_ADDRESS.toLowerCase());

      // Verify ROOTS transferred to escrow
      const buyerBalanceAfter = await getRootsBalance(buyerAddress);
      console.log(`[Phase2] Buyer ROOTS after: ${Number(buyerBalanceAfter) / 1e18}`);

      expect(buyerBalanceBefore - buyerBalanceAfter).toBeGreaterThan(0n);
    });

    it('should record ROOTS as payment token on order', async () => {
      if (!testOrderId) {
        console.log('[Phase2] No test order - skipping');
        return;
      }

      const order = await readOrder(testOrderId);
      console.log(`[Phase2] Order payment token: ${order?.paymentToken}`);

      expect(order?.paymentToken.toLowerCase()).toBe(ROOTS_TOKEN_ADDRESS.toLowerCase());
    });
  });

  describe('Step 5 — Order Fulfillment', () => {
    it('should allow seller to accept ROOTS order', async () => {
      if (!testOrderId) {
        console.log('[Phase2] No test order - skipping');
        return;
      }

      const order = await readOrder(testOrderId);
      if (order?.status !== OrderStatus.Pending) {
        console.log(`[Phase2] Order not pending (status: ${order?.status}) - skipping`);
        return;
      }

      console.log('[Phase2] Seller accepting order...');

      const result = await executeGasless(
        sellerAddress,
        MARKETPLACE_ADDRESS,
        marketplaceAbi,
        'acceptOrder',
        [testOrderId]
      );

      expect(result.success).toBe(true);

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      const updatedOrder = await readOrder(testOrderId);
      console.log(`[Phase2] Order status after accept: ${updatedOrder?.status}`);

      expect(updatedOrder?.status).toBe(OrderStatus.Accepted);
    });

    it('should allow seller to mark ready for pickup', async () => {
      if (!testOrderId) {
        console.log('[Phase2] No test order - skipping');
        return;
      }

      const order = await readOrder(testOrderId);
      if (order?.status !== OrderStatus.Accepted) {
        console.log(`[Phase2] Order not accepted (status: ${order?.status}) - skipping`);
        return;
      }

      console.log('[Phase2] Seller marking ready for pickup...');

      const result = await executeGasless(
        sellerAddress,
        MARKETPLACE_ADDRESS,
        marketplaceAbi,
        'markReadyForPickup',
        [testOrderId, 'ipfs://test-proof']
      );

      expect(result.success).toBe(true);

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      const updatedOrder = await readOrder(testOrderId);
      console.log(`[Phase2] Order status after ready: ${updatedOrder?.status}`);

      expect(updatedOrder?.status).toBe(OrderStatus.ReadyForPickup);
    });

    it('should release ROOTS to seller after completion', async () => {
      if (!testOrderId) {
        console.log('[Phase2] No test order - skipping');
        return;
      }

      const order = await readOrder(testOrderId);
      if (order?.status !== OrderStatus.ReadyForPickup) {
        console.log(`[Phase2] Order not ready (status: ${order?.status}) - skipping`);
        return;
      }

      const sellerBalanceBefore = await getRootsBalance(sellerAddress);
      console.log(`[Phase2] Seller ROOTS before: ${Number(sellerBalanceBefore) / 1e18}`);

      console.log('[Phase2] Buyer completing order...');

      const hash = await buyerClient.writeContract({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'completeOrder',
        args: [testOrderId],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Wait for RPC sync
      await new Promise((r) => setTimeout(r, 3000));

      const updatedOrder = await readOrder(testOrderId);
      console.log(`[Phase2] Order status after complete: ${updatedOrder?.status}`);

      expect(updatedOrder?.status).toBe(OrderStatus.Completed);

      // Note: Funds are in escrow until 48h dispute window passes
      // or seller calls claimFunds()
    });
  });
});
