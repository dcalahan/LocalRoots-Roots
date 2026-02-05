import { type Address, formatUnits } from 'viem';
import { publicClient } from './clients';
import {
  ROOTS_TOKEN_ADDRESS,
  MARKETPLACE_ADDRESS,
  AMBASSADOR_REWARDS_ADDRESS,
  erc20Abi,
  marketplaceAbi,
  ambassadorAbi,
} from './contracts';
import { expect } from 'vitest';

// ─── Token Balances ───

export async function getTokenBalance(token: Address, account: Address): Promise<bigint> {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  }) as Promise<bigint>;
}

export async function getRootsBalance(account: Address): Promise<bigint> {
  return getTokenBalance(ROOTS_TOKEN_ADDRESS, account);
}

export function expectBalanceDelta(
  before: bigint,
  after: bigint,
  expectedDelta: bigint,
  label: string
) {
  const actualDelta = after - before;
  console.log(`[Balance] ${label}: ${formatUnits(before, 18)} → ${formatUnits(after, 18)} (delta: ${formatUnits(actualDelta, 18)}, expected: ${formatUnits(expectedDelta, 18)})`);
  expect(actualDelta).toBe(expectedDelta);
}

// ─── Order State ───

export interface OrderStruct {
  listingId: bigint;
  sellerId: bigint;
  buyer: Address;
  quantity: bigint;
  totalPrice: bigint;
  isDelivery: boolean;
  status: number;
  createdAt: bigint;
  completedAt: bigint;
  rewardQueued: boolean;
  proofIpfs: string;
  proofUploadedAt: bigint;
  fundsReleased: boolean;
  buyerInfoIpfs: string;
  paymentToken: Address;
}

// Order status enum matching the contract
export const OrderStatus = {
  Pending: 0,
  Accepted: 1,
  ReadyForPickup: 2,
  OutForDelivery: 3,
  Completed: 4,
  Disputed: 5,
  Refunded: 6,
  Cancelled: 7,
} as const;

export async function readOrder(orderId: bigint): Promise<OrderStruct> {
  const result = await publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'orders',
    args: [orderId],
  });

  const r = result as readonly [bigint, bigint, Address, bigint, bigint, boolean, number, bigint, bigint, boolean, string, bigint, boolean, string, Address];
  return {
    listingId: r[0],
    sellerId: r[1],
    buyer: r[2],
    quantity: r[3],
    totalPrice: r[4],
    isDelivery: r[5],
    status: r[6],
    createdAt: r[7],
    completedAt: r[8],
    rewardQueued: r[9],
    proofIpfs: r[10],
    proofUploadedAt: r[11],
    fundsReleased: r[12],
    buyerInfoIpfs: r[13],
    paymentToken: r[14],
  };
}

// ─── Seller State ───

export interface SellerStruct {
  owner: Address;
  geohash: string;
  storefrontIpfs: string;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: bigint;
  createdAt: bigint;
  active: boolean;
}

export async function readSeller(sellerId: bigint): Promise<SellerStruct> {
  const result = await publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'sellers',
    args: [sellerId],
  });

  const r = result as readonly [Address, string, string, boolean, boolean, bigint, bigint, boolean];
  return {
    owner: r[0],
    geohash: r[1],
    storefrontIpfs: r[2],
    offersDelivery: r[3],
    offersPickup: r[4],
    deliveryRadiusKm: r[5],
    createdAt: r[6],
    active: r[7],
  };
}

export async function getSellerIdByOwner(owner: Address): Promise<bigint> {
  return publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'sellerIdByOwner',
    args: [owner],
  }) as Promise<bigint>;
}

// ─── Listing State ───

export interface ListingStruct {
  sellerId: bigint;
  metadataIpfs: string;
  pricePerUnit: bigint;
  quantityAvailable: bigint;
  active: boolean;
}

export async function readListing(listingId: bigint): Promise<ListingStruct> {
  const result = await publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'listings',
    args: [listingId],
  });

  const r = result as readonly [bigint, string, bigint, bigint, boolean];
  return {
    sellerId: r[0],
    metadataIpfs: r[1],
    pricePerUnit: r[2],
    quantityAvailable: r[3],
    active: r[4],
  };
}

export async function getNextListingId(): Promise<bigint> {
  return publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'nextListingId',
  }) as Promise<bigint>;
}

export async function getNextOrderId(): Promise<bigint> {
  return publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'nextOrderId',
  }) as Promise<bigint>;
}

// ─── Ambassador State ───

export interface AmbassadorStruct {
  wallet: Address;
  uplineId: bigint;
  totalEarned: bigint;
  totalPending: bigint;
  recruitedSellers: bigint;
  recruitedAmbassadors: bigint;
  createdAt: bigint;
  active: boolean;
  suspended: boolean;
  regionGeohash: string;
}

export async function readAmbassador(ambassadorId: bigint): Promise<AmbassadorStruct> {
  const result = await publicClient.readContract({
    address: AMBASSADOR_REWARDS_ADDRESS,
    abi: ambassadorAbi,
    functionName: 'ambassadors',
    args: [ambassadorId],
  });

  const r = result as readonly [Address, bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean, string];
  return {
    wallet: r[0],
    uplineId: r[1],
    totalEarned: r[2],
    totalPending: r[3],
    recruitedSellers: r[4],
    recruitedAmbassadors: r[5],
    createdAt: r[6],
    active: r[7],
    suspended: r[8],
    regionGeohash: r[9],
  };
}

export async function getAmbassadorIdByWallet(wallet: Address): Promise<bigint> {
  // Try both the mapping and the explicit getter function
  const mappingId = await publicClient.readContract({
    address: AMBASSADOR_REWARDS_ADDRESS,
    abi: ambassadorAbi,
    functionName: 'ambassadorIdByWallet',
    args: [wallet],
  }) as bigint;

  if (mappingId > 0n) return mappingId;

  // Fallback: try getAmbassadorId which may have different logic
  try {
    const getterId = await publicClient.readContract({
      address: AMBASSADOR_REWARDS_ADDRESS,
      abi: ambassadorAbi,
      functionName: 'getAmbassadorId',
      args: [wallet],
    }) as bigint;
    return getterId;
  } catch {
    return mappingId;
  }
}

export async function getNextAmbassadorId(): Promise<bigint> {
  return publicClient.readContract({
    address: AMBASSADOR_REWARDS_ADDRESS,
    abi: ambassadorAbi,
    functionName: 'nextAmbassadorId',
  }) as Promise<bigint>;
}

export async function getDisputeWindow(): Promise<bigint> {
  return publicClient.readContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: 'DISPUTE_WINDOW',
  }) as Promise<bigint>;
}
