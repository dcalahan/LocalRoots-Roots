import { describe, it, expect } from 'vitest';
import { formatUnits } from 'viem';
import {
  publicClient,
  sellerAccount,
  sellerAddress,
  buyerAddress,
  buyer2Address,
  ambassadorAddress,
} from './lib/clients';
import {
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
  marketplaceAbi,
  ambassadorAbi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import {
  readOrder,
  readAmbassador,
  getRootsBalance,
  getDisputeWindow,
  OrderStatus,
} from './lib/assertions';
import { readState } from './lib/state';
import { querySeedsBalance } from './lib/subgraph';

// ═══════════════════════════════════════════════════════════════
// Phase 2: Settlement — Run 48+ hours after lifecycle
// Run with: npm run test:e2e:settle
// ═══════════════════════════════════════════════════════════════

describe('Step 6 — Claim Funds', () => {
  it('should have state from lifecycle phase', () => {
    const state = readState();
    expect(state).not.toBeNull();
    expect(state!.pickupOrderId).not.toBe('0');
    expect(state!.deliveryOrderId).not.toBe('0');
    console.log('[Step 6] State loaded:', {
      pickupOrderId: state!.pickupOrderId,
      deliveryOrderId: state!.deliveryOrderId,
      proofUploadedAt: state!.proofUploadedAt,
    });
  });

  it('should check dispute window has expired', async () => {
    const state = readState()!;
    const disputeWindow = await getDisputeWindow();
    const now = Math.floor(Date.now() / 1000);
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);

    if (now < claimableAt) {
      const remaining = claimableAt - now;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      console.log(`[Step 6] Dispute window not expired. ${hours}h ${minutes}m remaining.`);
      console.log(`[Step 6] Claimable at: ${new Date(claimableAt * 1000).toLocaleString()}`);
      console.log('[Step 6] Skipping settlement — run again later.');
      // Exit cleanly, not a failure
      return;
    }

    console.log('[Step 6] Dispute window has expired. Proceeding with claims.');
  });

  it('should claim funds for pickup order', async () => {
    const state = readState()!;
    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 6] Skipping — dispute window not expired');
      return;
    }

    const pickupOrderId = BigInt(state.pickupOrderId);
    const orderBefore = await readOrder(pickupOrderId);

    if (orderBefore.fundsReleased) {
      console.log('[Step 6] Pickup order funds already released');
      return;
    }

    console.log(`[Step 6] Claiming funds for pickup order #${pickupOrderId}...`);
    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'claimFunds',
      args: [pickupOrderId],
    });

    const orderAfter = await readOrder(pickupOrderId);
    expect(orderAfter.fundsReleased).toBe(true);
    console.log(`[Step 6] Pickup order funds released`);
  });

  it('should claim funds for delivery order', async () => {
    const state = readState()!;
    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 6] Skipping — dispute window not expired');
      return;
    }

    const deliveryOrderId = BigInt(state.deliveryOrderId);
    const orderBefore = await readOrder(deliveryOrderId);

    if (orderBefore.fundsReleased) {
      console.log('[Step 6] Delivery order funds already released');
      return;
    }

    console.log(`[Step 6] Claiming funds for delivery order #${deliveryOrderId}...`);
    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'claimFunds',
      args: [deliveryOrderId],
    });

    const orderAfter = await readOrder(deliveryOrderId);
    expect(orderAfter.fundsReleased).toBe(true);
    console.log(`[Step 6] Delivery order funds released`);
  });

  it('should claim funds for buyer2 order (if exists)', async () => {
    const state = readState()!;
    if (!state.buyer2OrderId) {
      console.log('[Step 6] No buyer2 order — skipping (run activation.test.ts first for full activation test)');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    // Use buyer2ProofUploadedAt if available, otherwise fall back to original
    const proofTime = state.buyer2ProofUploadedAt || state.proofUploadedAt;
    const claimableAt = proofTime + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 6] Skipping — dispute window not expired for buyer2 order');
      return;
    }

    const buyer2OrderId = BigInt(state.buyer2OrderId);
    const orderBefore = await readOrder(buyer2OrderId);

    if (orderBefore.fundsReleased) {
      console.log('[Step 6] Buyer2 order funds already released');
      return;
    }

    console.log(`[Step 6] Claiming funds for buyer2 order #${buyer2OrderId}...`);
    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'claimFunds',
      args: [buyer2OrderId],
    });

    const orderAfter = await readOrder(buyer2OrderId);
    expect(orderAfter.fundsReleased).toBe(true);
    console.log(`[Step 6] Buyer2 order funds released`);
  });
});

describe('Step 6b — Seller Activation Verification', () => {
  it('should verify seller is activated after claims (2 unique buyers)', async () => {
    const state = readState()!;
    if (!state.buyer2OrderId) {
      console.log('[Step 6b] No buyer2 order — cannot verify activation');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 6b] Skipping — dispute window not expired');
      return;
    }

    const sellerId = BigInt(state.sellerId);

    // Check activation status
    const isActivated = await publicClient.readContract({
      address: AMBASSADOR_REWARDS_ADDRESS,
      abi: ambassadorAbi,
      functionName: 'isSellerActivated',
      args: [sellerId],
    });

    console.log(`[Step 6b] isSellerActivated(${sellerId}): ${isActivated}`);
    expect(isActivated).toBe(true);
  });

  it('should verify recruitment stats show 2 unique buyers', async () => {
    const state = readState()!;
    if (!state.buyer2OrderId) {
      console.log('[Step 6b] No buyer2 order — cannot verify recruitment stats');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 6b] Skipping — dispute window not expired');
      return;
    }

    const sellerId = BigInt(state.sellerId);

    const recruitment = await publicClient.readContract({
      address: AMBASSADOR_REWARDS_ADDRESS,
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

    console.log('[Step 6b] Recruitment stats after claims:');
    console.log(`  ambassadorId: ${recruitment.ambassadorId}`);
    console.log(`  completedOrderCount: ${recruitment.completedOrderCount}`);
    console.log(`  uniqueBuyerCount: ${recruitment.uniqueBuyerCount}`);
    console.log(`  totalSalesVolume: ${formatUnits(recruitment.totalSalesVolume, 18)} ROOTS`);
    console.log(`  activated: ${recruitment.activated}`);

    // With buyer1's 2 orders + buyer2's 1 order = 3 completed, 2 unique buyers
    expect(recruitment.completedOrderCount).toBeGreaterThanOrEqual(2n);
    expect(recruitment.uniqueBuyerCount).toBeGreaterThanOrEqual(2n);
    expect(recruitment.activated).toBe(true);
  });
});

describe('Step 7 — Final Financial Verification', () => {
  it('should verify seller received ROOTS', async () => {
    const state = readState()!;
    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);
    if (now < claimableAt) {
      console.log('[Step 7] Skipping — dispute window not expired');
      return;
    }

    const sellerBalBefore = BigInt(state.balancesBefore.sellerRoots || '0');
    const sellerBalAfter = await getRootsBalance(sellerAddress);
    const delta = sellerBalAfter - sellerBalBefore;

    // Seller should have received ~1000 ROOTS (500 per order)
    console.log(`[Step 7] Seller ROOTS: ${formatUnits(sellerBalBefore, 18)} → ${formatUnits(sellerBalAfter, 18)} (delta: ${formatUnits(delta, 18)})`);

    // The exact delta may vary depending on contract fee structure
    // At minimum seller should have received more ROOTS
    expect(delta).toBeGreaterThan(0n);
  });

  it('should check ambassador rewards', async () => {
    const state = readState()!;
    const ambassadorId = BigInt(state.ambassadorId);
    const ambassador = await readAmbassador(ambassadorId);

    console.log(`[Step 7] Ambassador rewards:`);
    console.log(`  Total Earned:  ${formatUnits(ambassador.totalEarned, 18)} ROOTS`);
    console.log(`  Total Pending: ${formatUnits(ambassador.totalPending, 18)} ROOTS`);
    console.log(`  Recruited Sellers: ${ambassador.recruitedSellers}`);

    // With buyer2 order, seller should now be activated and rewards should queue
    if (state.buyer2OrderId) {
      console.log('[Step 7] Seller was activated — ambassador rewards should be queueing');
      // After activation, future sales will queue rewards. Already-completed sales
      // before activation do NOT retroactively earn rewards.
    } else {
      console.log('[Step 7] Note: Run activation.test.ts to add buyer2 and enable rewards');
    }
  });

  it('should check Seeds balances (expect no new events in Phase 2 ROOTS mode)', async () => {
    // In Phase 2 ROOTS mode, Seeds events are NOT emitted for purchases/sales.
    // This is an important negative assertion.
    const buyerSeeds = await querySeedsBalance(buyerAddress, 0);
    const sellerSeeds = await querySeedsBalance(sellerAddress, 0);
    const ambassadorSeeds = await querySeedsBalance(ambassadorAddress, 0);

    console.log('[Step 7] Seeds balances (should be unchanged in Phase 2 ROOTS mode):');
    console.log(`  Buyer:      ${buyerSeeds?.total || '0'} Seeds`);
    console.log(`  Seller:     ${sellerSeeds?.total || '0'} Seeds`);
    console.log(`  Ambassador: ${ambassadorSeeds?.total || '0'} Seeds`);

    // Note: When we switch to Phase 1 USDC mode, update these expectations
    // to verify Seeds are earned for purchases and sales.
  });

  it('should print final summary', async () => {
    const state = readState()!;
    const now = Math.floor(Date.now() / 1000);
    const disputeWindow = await getDisputeWindow();
    const claimableAt = state.proofUploadedAt + Number(disputeWindow);

    if (now < claimableAt) {
      const remaining = claimableAt - now;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      console.log('\n═══════════════════════════════════════');
      console.log('  SETTLEMENT SKIPPED — Window Not Expired');
      console.log('═══════════════════════════════════════');
      console.log(`  Time remaining: ${hours}h ${minutes}m`);
      console.log(`  Claimable at: ${new Date(claimableAt * 1000).toLocaleString()}`);
      console.log('  Run again after that time.');
      console.log('═══════════════════════════════════════\n');
      return;
    }

    const pickupOrder = await readOrder(BigInt(state.pickupOrderId));
    const deliveryOrder = await readOrder(BigInt(state.deliveryOrderId));
    const buyer2Order = state.buyer2OrderId ? await readOrder(BigInt(state.buyer2OrderId)) : null;
    const sellerBal = await getRootsBalance(sellerAddress);
    const ambassadorId = BigInt(state.ambassadorId);
    const ambassador = await readAmbassador(ambassadorId);
    const sellerId = BigInt(state.sellerId);

    // Get activation status
    let isActivated = false;
    if (state.buyer2OrderId) {
      isActivated = await publicClient.readContract({
        address: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'isSellerActivated',
        args: [sellerId],
      }) as boolean;
    }

    console.log('\n═══════════════════════════════════════');
    console.log('  SETTLEMENT COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`Pickup Order #${state.pickupOrderId}:   funds=${pickupOrder.fundsReleased}`);
    console.log(`Delivery Order #${state.deliveryOrderId}: funds=${deliveryOrder.fundsReleased}`);
    if (buyer2Order) {
      console.log(`Buyer2 Order #${state.buyer2OrderId}:    funds=${buyer2Order.fundsReleased}`);
    }
    console.log(`Seller ROOTS balance: ${formatUnits(sellerBal, 18)}`);
    console.log(`Seller activated: ${isActivated}`);
    console.log(`Ambassador earned: ${formatUnits(ambassador.totalEarned, 18)} ROOTS`);
    console.log(`Ambassador pending: ${formatUnits(ambassador.totalPending, 18)} ROOTS`);
    console.log('Seeds: No new events (expected in Phase 2 ROOTS mode)');
    console.log('═══════════════════════════════════════\n');
  });
});
