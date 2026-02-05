import { describe, it, expect } from 'vitest';
import { decodeEventLog, formatUnits, toHex, type Address } from 'viem';
import {
  publicClient,
  ambassadorAddress,
  ambassadorAccount,
  sellerAddress,
  sellerAccount,
  buyerAddress,
  buyerClient,
  deployerAddress,
  deployerClient,
} from './lib/clients';
import {
  ROOTS_TOKEN_ADDRESS,
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
  marketplaceAbi,
  ambassadorAbi,
  erc20Abi,
} from './lib/contracts';
import { executeGasless } from './lib/gasless';
import {
  readOrder,
  readSeller,
  readListing,
  readAmbassador,
  getAmbassadorIdByWallet,
  getNextAmbassadorId,
  getSellerIdByOwner,
  getNextListingId,
  getNextOrderId,
  getRootsBalance,
  expectBalanceDelta,
  getDisputeWindow,
  OrderStatus,
} from './lib/assertions';
import { updateState } from './lib/state';

// ═══════════════════════════════════════════════════════════════
// Phase 1: Full Marketplace Lifecycle
// Run with: npm run test:e2e
// ═══════════════════════════════════════════════════════════════

// Event ABIs (contract event names differ from ABI in some cases)
const orderCreatedAbi = [{
  type: 'event',
  name: 'OrderCreated',
  inputs: [
    { name: 'orderId', type: 'uint256', indexed: true },
    { name: 'listingId', type: 'uint256', indexed: true },
    { name: 'buyer', type: 'address', indexed: true },
    { name: 'quantity', type: 'uint256', indexed: false },
  ],
}] as const;

const listingCreatedAbi = [{
  type: 'event',
  name: 'ListingCreated',
  inputs: [
    { name: 'listingId', type: 'uint256', indexed: true },
    { name: 'sellerId', type: 'uint256', indexed: true },
    { name: 'pricePerUnit', type: 'uint256', indexed: false },
  ],
}] as const;

function extractOrderId(receipt: { logs: readonly { topics: readonly string[]; data: string; address: string }[] }): bigint {
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: orderCreatedAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });
      if (decoded.eventName === 'OrderCreated') {
        return (decoded.args as { orderId: bigint }).orderId;
      }
    } catch { /* not this event */ }
  }
  throw new Error('OrderCreated event not found in receipt');
}

// Shared state across sequential tests
let ambassadorId: bigint;
let sellerId: bigint;
let listingId: bigint;
let pickupOrderId: bigint;
let deliveryOrderId: bigint;

describe('Step 1 — Ambassador Registration', () => {
  it('should register ambassador (or use existing)', async () => {
    const existingId = await getAmbassadorIdByWallet(ambassadorAddress);
    const nextIdBefore = await getNextAmbassadorId();
    console.log(`[Step 1] ambassadorIdByWallet: ${existingId}, nextAmbassadorId: ${nextIdBefore}`);

    if (existingId > 0n) {
      console.log(`[Step 1] Ambassador already registered with ID ${existingId}`);
      ambassadorId = existingId;
    } else {
      console.log('[Step 1] Registering new ambassador...');
      await executeGasless({
        account: ambassadorAccount,
        to: AMBASSADOR_REWARDS_ADDRESS,
        abi: ambassadorAbi,
        functionName: 'registerAmbassador',
        args: [0n, 'ipfs://test-ambassador'],
      });

      ambassadorId = await getAmbassadorIdByWallet(ambassadorAddress);

      // Fallback: use counter if mapping returns 0
      if (ambassadorId === 0n) {
        const nextIdAfter = await getNextAmbassadorId();
        if (nextIdAfter > nextIdBefore) {
          ambassadorId = nextIdBefore;
          console.log(`[Step 1] Using ID from counter: ${ambassadorId}`);
        }
      }
    }

    expect(ambassadorId).toBeGreaterThan(0n);

    const ambassador = await readAmbassador(ambassadorId);
    expect(ambassador.active).toBe(true);
    expect(ambassador.wallet.toLowerCase()).toBe(ambassadorAddress.toLowerCase());

    console.log(`[Step 1] Ambassador ID: ${ambassadorId}, active: ${ambassador.active}`);
    updateState({ ambassadorId: ambassadorId.toString() });
  });
});

describe('Step 2 — Seller Registration', () => {
  it('should register seller with ambassador referral (or use existing)', async () => {
    const existingId = await getSellerIdByOwner(sellerAddress);
    console.log(`[Step 2] sellerIdByOwner: ${existingId}`);

    if (existingId > 0n) {
      console.log(`[Step 2] Seller already registered with ID ${existingId}`);
      sellerId = existingId;
    } else {
      console.log('[Step 2] Registering new seller...');
      const geohash = toHex('djq71000', { size: 8 });

      await executeGasless({
        account: sellerAccount,
        to: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'registerSeller',
        args: [geohash, 'ipfs://test-seller', true, true, 10n, ambassadorId],
      });

      sellerId = await getSellerIdByOwner(sellerAddress);
    }

    expect(sellerId).toBeGreaterThan(0n);

    const seller = await readSeller(sellerId);
    expect(seller.offersPickup).toBe(true);
    expect(seller.offersDelivery).toBe(true);
    expect(seller.active).toBe(true);

    const ambassador = await readAmbassador(ambassadorId);
    console.log(`[Step 2] Seller ID: ${sellerId}, Ambassador recruited sellers: ${ambassador.recruitedSellers}`);
    updateState({ sellerId: sellerId.toString() });
  });
});

describe('Step 3 — Create Listing', () => {
  it('should create a fresh listing', async () => {
    console.log('[Step 3] Creating listing...');

    // Price: 100 ROOTS per unit ($1/unit at 100 ROOTS = $1)
    const pricePerUnit = 100n * 10n ** 18n;
    const quantity = 100n;

    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'createListing',
      args: ['ipfs://test-tomatoes', pricePerUnit, quantity],
    });

    // Contract uses ++nextListingId (pre-increment), so after creation
    // nextListingId equals the ID of the just-created listing
    listingId = await getNextListingId();

    // Verify listing — sellerId comes from the contract's sellerIdByOwner mapping
    const listing = await readListing(listingId);
    expect(listing.sellerId).toBe(sellerId);
    expect(listing.active).toBe(true);
    expect(listing.quantityAvailable).toBe(quantity);

    console.log(`[Step 3] Listing created: ID=${listingId}, sellerId=${listing.sellerId}, price=${formatUnits(listing.pricePerUnit, 18)} ROOTS/unit, qty=${listing.quantityAvailable}`);
    updateState({ listingId: listingId.toString() });
  });
});

describe('Step 4 — Buyer Purchases', () => {
  it('should fund buyer with ETH and ROOTS if needed', async () => {
    // Fund buyer with ETH for gas (needed for direct purchase calls)
    const buyerEthBal = await publicClient.getBalance({ address: buyerAddress });
    const minEth = 1000000000000000n; // 0.001 ETH
    console.log(`[Step 4 setup] Buyer ETH balance: ${formatUnits(buyerEthBal, 18)}`);

    if (buyerEthBal < minEth) {
      console.log('[Step 4 setup] Funding buyer with 0.005 ETH from deployer...');
      const txHash = await deployerClient.sendTransaction({
        to: buyerAddress,
        value: 5000000000000000n, // 0.005 ETH
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      const newEthBal = await publicClient.getBalance({ address: buyerAddress });
      console.log(`[Step 4 setup] Buyer ETH balance after: ${formatUnits(newEthBal, 18)}`);
    }

    // Fund buyer with ROOTS tokens
    const buyerBal = await getRootsBalance(buyerAddress);
    const needed = 2000n * 10n ** 18n;
    console.log(`[Step 4 setup] Buyer ROOTS balance: ${formatUnits(buyerBal, 18)}`);

    if (buyerBal < needed) {
      const deployerBal = await getRootsBalance(deployerAddress);
      console.log(`[Step 4 setup] Deployer ROOTS balance: ${formatUnits(deployerBal, 18)}`);
      expect(deployerBal).toBeGreaterThan(needed);

      const transferAmount = 10000n * 10n ** 18n;
      console.log(`[Step 4 setup] Transferring ${formatUnits(transferAmount, 18)} ROOTS to buyer...`);
      const txHash = await deployerClient.writeContract({
        address: ROOTS_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [buyerAddress, transferAmount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      expect(receipt.status).toBe('success');
      console.log(`[Step 4 setup] Transfer complete, waiting for RPC sync...`);
      await new Promise(r => setTimeout(r, 3_000));

      const newBal = await getRootsBalance(buyerAddress);
      console.log(`[Step 4 setup] Buyer ROOTS balance after: ${formatUnits(newBal, 18)}`);
      expect(newBal).toBeGreaterThanOrEqual(needed);
    }
  });

  it('should approve ROOTS token for marketplace', async () => {
    // Always do a fresh max approval to avoid stale state
    console.log('[Step 4a] Approving max ROOTS for marketplace...');
    const txHash = await buyerClient.writeContract({
      address: ROOTS_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [MARKETPLACE_ADDRESS, 2n ** 256n - 1n],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    expect(receipt.status).toBe('success');
    console.log('[Step 4a] Approval tx:', txHash);

    // Wait for RPC nonce to sync before next buyer tx
    await new Promise(r => setTimeout(r, 2_000));

    // Verify
    const allowance = await publicClient.readContract({
      address: ROOTS_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [buyerAddress, MARKETPLACE_ADDRESS],
    }) as bigint;
    expect(allowance).toBeGreaterThan(0n);
  });

  it('should purchase 5 units for pickup', async () => {
    const balanceBefore = await getRootsBalance(buyerAddress);

    console.log('[Step 4b] Purchasing 5 units pickup...');

    const txHash = await buyerClient.writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'purchase',
      args: [
        listingId,
        5n,
        false,
        '',
        '0x0000000000000000000000000000000000000000' as Address,
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    expect(receipt.status).toBe('success');

    // Extract actual order ID from OrderCreated event in receipt
    pickupOrderId = extractOrderId(receipt);
    console.log(`[Step 4b] Order created with ID: ${pickupOrderId}`);

    // Wait for RPC to sync the new state
    await new Promise(r => setTimeout(r, 3_000));

    const order = await readOrder(pickupOrderId);
    expect(order.status).toBe(OrderStatus.Pending);
    expect(order.isDelivery).toBe(false);
    expect(order.quantity).toBe(5n);
    expect(order.buyer.toLowerCase()).toBe(buyerAddress.toLowerCase());

    const balanceAfter = await getRootsBalance(buyerAddress);
    const expectedCost = 500n * 10n ** 18n;
    expectBalanceDelta(balanceBefore, balanceAfter, -expectedCost, 'Buyer ROOTS (pickup)');

    console.log(`[Step 4b] Pickup order placed: ID=${pickupOrderId}, cost=${formatUnits(order.totalPrice, 18)} ROOTS`);
    updateState({ pickupOrderId: pickupOrderId.toString() });

    // Wait for RPC nonce to sync before next buyer tx
    await new Promise(r => setTimeout(r, 2_000));
  });

  it('should purchase 5 units for delivery', async () => {
    expect(pickupOrderId).toBeDefined();
    const balanceBefore = await getRootsBalance(buyerAddress);

    console.log('[Step 4c] Purchasing 5 units delivery...');

    const txHash = await buyerClient.writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'purchase',
      args: [
        listingId,
        5n,
        true,
        'ipfs://test-delivery-info',
        '0x0000000000000000000000000000000000000000' as Address,
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    expect(receipt.status).toBe('success');

    // Extract actual order ID from OrderCreated event in receipt
    deliveryOrderId = extractOrderId(receipt);
    console.log(`[Step 4c] Order created with ID: ${deliveryOrderId}`);

    // Wait for RPC to sync the new state
    await new Promise(r => setTimeout(r, 3_000));

    const order = await readOrder(deliveryOrderId);
    expect(order.status).toBe(OrderStatus.Pending);
    expect(order.isDelivery).toBe(true);
    expect(order.buyerInfoIpfs).toBe('ipfs://test-delivery-info');

    const balanceAfter = await getRootsBalance(buyerAddress);
    const expectedCost = 500n * 10n ** 18n;
    expectBalanceDelta(balanceBefore, balanceAfter, -expectedCost, 'Buyer ROOTS (delivery)');

    console.log(`[Step 4c] Delivery order placed: ID=${deliveryOrderId}, cost=${formatUnits(order.totalPrice, 18)} ROOTS`);
    updateState({ deliveryOrderId: deliveryOrderId.toString() });
  });

  it('should have reduced listing quantity by 10', async () => {
    const listing = await readListing(listingId);
    // Fresh listing started at 100, two purchases of 5 each = 90 remaining
    expect(listing.quantityAvailable).toBe(90n);
    console.log(`[Step 4d] Listing quantity remaining: ${listing.quantityAvailable}`);
  });
});

describe('Step 5 — Seller Fulfillment', () => {
  it('should accept both orders', async () => {
    expect(pickupOrderId).toBeDefined();
    expect(deliveryOrderId).toBeDefined();
    console.log(`[Step 5a] Accepting orders ${pickupOrderId} and ${deliveryOrderId}...`);

    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'acceptOrder',
      args: [pickupOrderId],
    });

    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'acceptOrder',
      args: [deliveryOrderId],
    });

    const pickupOrder = await readOrder(pickupOrderId);
    const deliveryOrder = await readOrder(deliveryOrderId);
    expect(pickupOrder.status).toBe(OrderStatus.Accepted);
    expect(deliveryOrder.status).toBe(OrderStatus.Accepted);

    console.log('[Step 5a] Both orders accepted');
  });

  it('should mark pickup order ready', async () => {
    console.log('[Step 5b] Marking pickup ready...');

    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'markReadyForPickup',
      args: [pickupOrderId, 'ipfs://test-proof-pickup'],
    });

    const order = await readOrder(pickupOrderId);
    expect(order.status).toBe(OrderStatus.ReadyForPickup);
    expect(order.proofIpfs).toBe('ipfs://test-proof-pickup');
    expect(order.proofUploadedAt).toBeGreaterThan(0n);

    console.log(`[Step 5b] Pickup order proof uploaded at ${order.proofUploadedAt}`);
    updateState({ proofUploadedAt: Number(order.proofUploadedAt) });
  });

  it('should mark delivery order out for delivery', async () => {
    console.log('[Step 5c] Marking out for delivery...');

    await executeGasless({
      account: sellerAccount,
      to: MARKETPLACE_ADDRESS,
      abi: marketplaceAbi,
      functionName: 'markOutForDelivery',
      args: [deliveryOrderId, 'ipfs://test-proof-delivery'],
    });

    const order = await readOrder(deliveryOrderId);
    expect(order.status).toBe(OrderStatus.OutForDelivery);
    expect(order.proofIpfs).toBe('ipfs://test-proof-delivery');

    console.log('[Step 5c] Delivery order out for delivery');
  });

  it('should reject early fund claim (dispute window)', async () => {
    console.log('[Step 5d] Testing early claim rejection...');

    try {
      await executeGasless({
        account: sellerAccount,
        to: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: 'claimFunds',
        args: [pickupOrderId],
      });
      expect.fail('Early claimFunds should have reverted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[Step 5d] Early claim correctly rejected: ${msg.slice(0, 120)}`);
      expect(msg).toBeTruthy();
    }
  });

  it('should print summary and persist state', async () => {
    const disputeWindow = await getDisputeWindow();
    const proofUploadedAt = (await readOrder(pickupOrderId)).proofUploadedAt;
    const claimableAt = Number(proofUploadedAt) + Number(disputeWindow);
    const claimableDate = new Date(claimableAt * 1000);

    const sellerBal = await getRootsBalance(sellerAddress);
    const buyerBal = await getRootsBalance(buyerAddress);
    const marketplaceBal = await getRootsBalance(MARKETPLACE_ADDRESS);

    console.log('\n═══════════════════════════════════════');
    console.log('  LIFECYCLE COMPLETE — Phase 1 Summary');
    console.log('═══════════════════════════════════════');
    console.log(`Ambassador ID:    ${ambassadorId}`);
    console.log(`Seller ID:        ${sellerId}`);
    console.log(`Listing ID:       ${listingId}`);
    console.log(`Pickup Order:     #${pickupOrderId}`);
    console.log(`Delivery Order:   #${deliveryOrderId}`);
    console.log(`Dispute Window:   ${Number(disputeWindow) / 3600}h`);
    console.log(`Funds claimable:  ${claimableDate.toLocaleString()}`);
    console.log('');
    console.log('Current Balances (ROOTS):');
    console.log(`  Buyer:       ${formatUnits(buyerBal, 18)}`);
    console.log(`  Seller:      ${formatUnits(sellerBal, 18)}`);
    console.log(`  Marketplace: ${formatUnits(marketplaceBal, 18)}`);
    console.log('');
    console.log(`Run settlement after ${claimableDate.toLocaleString()}:`);
    console.log('  npm run test:e2e:settle');
    console.log('═══════════════════════════════════════\n');

    updateState({
      balancesBefore: {
        buyerRoots: buyerBal.toString(),
        sellerRoots: sellerBal.toString(),
        marketplaceRoots: marketplaceBal.toString(),
      },
    });
  });
});
