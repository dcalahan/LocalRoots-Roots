import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AmbassadorRegistered,
  StateFounderRegistered,
  SellerRecruited,
  SellerActivated,
  RewardQueued,
  RewardClaimed,
  AmbassadorSeedsEarned,
  AmbassadorRecruitmentSeeds,
} from "../generated/AmbassadorRewards/AmbassadorRewards";
import {
  Ambassador,
  Seller,
  AmbassadorReward,
  MarketplaceStats,
  SeedsBalance,
  SeedsEvent,
  GlobalSeedsStats,
} from "../generated/schema";

// Phase 1 launch timestamp (November 1, 2026 00:00:00 UTC)
const PHASE1_LAUNCH = BigInt.fromI64(1793577600);
const DAY_90 = PHASE1_LAUNCH.plus(BigInt.fromI64(90 * 86400));
const DAY_180 = PHASE1_LAUNCH.plus(BigInt.fromI64(180 * 86400));

function getMultiplier(timestamp: BigInt): i32 {
  if (timestamp.lt(DAY_90)) return 200;      // 2.0x
  if (timestamp.lt(DAY_180)) return 150;     // 1.5x
  return 100;                                 // 1.0x
}

function getOrCreateSeedsBalance(userAddress: Bytes): SeedsBalance {
  let id = userAddress.toHexString().toLowerCase();
  let balance = SeedsBalance.load(id);
  if (!balance) {
    balance = new SeedsBalance(id);
    balance.user = userAddress;
    balance.purchases = BigInt.fromI32(0);
    balance.sales = BigInt.fromI32(0);
    balance.referrals = BigInt.fromI32(0);
    balance.milestones = BigInt.fromI32(0);
    balance.recruitments = BigInt.fromI32(0);
    balance.total = BigInt.fromI32(0);
    balance.lastUpdated = BigInt.fromI32(0);
    balance.eventCount = BigInt.fromI32(0);
  }
  return balance;
}

function getOrCreateGlobalSeedsStats(): GlobalSeedsStats {
  let stats = GlobalSeedsStats.load("global");
  if (!stats) {
    stats = new GlobalSeedsStats("global");
    stats.totalSeeds = BigInt.fromI32(0);
    stats.totalSeedsFromPurchases = BigInt.fromI32(0);
    stats.totalSeedsFromSales = BigInt.fromI32(0);
    stats.totalSeedsFromReferrals = BigInt.fromI32(0);
    stats.totalSeedsFromMilestones = BigInt.fromI32(0);
    stats.totalSeedsFromRecruitments = BigInt.fromI32(0);
    stats.uniqueEarners = BigInt.fromI32(0);
    stats.phase1StartTimestamp = PHASE1_LAUNCH;
  }
  return stats;
}

function getOrCreateStats(): MarketplaceStats {
  let stats = MarketplaceStats.load("global");
  if (!stats) {
    stats = new MarketplaceStats("global");
    stats.totalSellers = BigInt.fromI32(0);
    stats.totalListings = BigInt.fromI32(0);
    stats.totalOrders = BigInt.fromI32(0);
    stats.totalVolume = BigInt.fromI32(0);
    stats.totalAmbassadors = BigInt.fromI32(0);
    stats.totalAmbassadorRewards = BigInt.fromI32(0);
  }
  return stats;
}

export function handleAmbassadorRegistered(event: AmbassadorRegistered): void {
  let ambassador = new Ambassador(event.params.ambassadorId.toString());
  ambassador.wallet = event.params.wallet;
  ambassador.totalEarned = BigInt.fromI32(0);
  ambassador.recruitedSellersCount = BigInt.fromI32(0);
  ambassador.recruitedAmbassadorsCount = BigInt.fromI32(0);
  ambassador.createdAt = event.block.timestamp;
  ambassador.active = true;

  // Link to upline ambassador if exists
  if (event.params.uplineId.gt(BigInt.fromI32(0))) {
    ambassador.seniorAmbassador = event.params.uplineId.toString();

    // Update upline's recruited count
    let upline = Ambassador.load(event.params.uplineId.toString());
    if (upline) {
      upline.recruitedAmbassadorsCount = upline.recruitedAmbassadorsCount.plus(
        BigInt.fromI32(1)
      );
      upline.save();
    }
  }

  ambassador.save();

  let stats = getOrCreateStats();
  stats.totalAmbassadors = stats.totalAmbassadors.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleStateFounderRegistered(event: StateFounderRegistered): void {
  let ambassador = new Ambassador(event.params.ambassadorId.toString());
  ambassador.wallet = event.params.wallet;
  ambassador.totalEarned = BigInt.fromI32(0);
  ambassador.recruitedSellersCount = BigInt.fromI32(0);
  ambassador.recruitedAmbassadorsCount = BigInt.fromI32(0);
  ambassador.createdAt = event.block.timestamp;
  ambassador.active = true;
  // State founders have no upline
  ambassador.save();

  let stats = getOrCreateStats();
  stats.totalAmbassadors = stats.totalAmbassadors.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleSellerActivated(event: SellerActivated): void {
  // Seller activation - could trigger recruitment Seeds
  // This is handled by AmbassadorRecruitmentSeeds event
}

export function handleSellerRecruited(event: SellerRecruited): void {
  let seller = Seller.load(event.params.sellerId.toString());
  if (seller) {
    seller.ambassador = event.params.ambassadorId.toString();
    seller.save();
  }

  let ambassador = Ambassador.load(event.params.ambassadorId.toString());
  if (ambassador) {
    ambassador.recruitedSellersCount = ambassador.recruitedSellersCount.plus(
      BigInt.fromI32(1)
    );
    ambassador.save();
  }
}

export function handleRewardQueued(event: RewardQueued): void {
  // Reward queued - will be claimed after vesting period
  // pendingRewardId, orderId, totalAmount, chainDepth
  let rewardId = event.params.pendingRewardId.toString();

  // Update global stats for queued rewards
  let stats = getOrCreateStats();
  stats.totalAmbassadorRewards = stats.totalAmbassadorRewards.plus(event.params.totalAmount);
  stats.save();
}

export function handleRewardClaimed(event: RewardClaimed): void {
  // Reward claimed after vesting
  // pendingRewardId, ambassadorId, amount
  let rewardId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let reward = new AmbassadorReward(rewardId);
  reward.ambassador = event.params.ambassadorId.toString();
  reward.seller = "0"; // We don't have sellerId in this event, would need to look up
  reward.amount = event.params.amount;
  reward.seniorAmount = BigInt.fromI32(0);
  reward.timestamp = event.block.timestamp;
  reward.txHash = event.transaction.hash;
  reward.save();

  // Update ambassador totals
  let ambassador = Ambassador.load(event.params.ambassadorId.toString());
  if (ambassador) {
    ambassador.totalEarned = ambassador.totalEarned.plus(event.params.amount);
    ambassador.save();
  }
}

// ============ Phase 1 Seeds Handlers ============

export function handleAmbassadorSeedsEarned(event: AmbassadorSeedsEarned): void {
  let ambassadorId = event.params.ambassadorId;
  let amount = event.params.seedsAmount;
  let orderId = event.params.orderId;
  let chainLevel = event.params.chainLevel;
  let timestamp = event.block.timestamp;

  // Get ambassador's wallet address
  let ambassador = Ambassador.load(ambassadorId.toString());
  if (!ambassador) return;

  let userAddress = ambassador.wallet;

  // Calculate multiplier and adjusted amount
  let multiplier = getMultiplier(timestamp);
  let adjustedAmount = amount.times(BigInt.fromI32(multiplier)).div(BigInt.fromI32(100));

  // Create Seeds event record
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let seedsEvent = new SeedsEvent(eventId);
  seedsEvent.user = userAddress;
  seedsEvent.amount = amount;
  seedsEvent.adjustedAmount = adjustedAmount;
  seedsEvent.reason = "referral";
  seedsEvent.orderId = orderId;
  seedsEvent.ambassadorId = ambassadorId;
  seedsEvent.chainLevel = chainLevel;
  seedsEvent.multiplier = multiplier;
  seedsEvent.timestamp = timestamp;
  seedsEvent.txHash = event.transaction.hash;
  seedsEvent.blockNumber = event.block.number;
  seedsEvent.save();

  // Update user's Seeds balance
  let balance = getOrCreateSeedsBalance(userAddress);
  let isNewEarner = balance.total.equals(BigInt.fromI32(0));

  balance.referrals = balance.referrals.plus(adjustedAmount);
  balance.total = balance.total.plus(adjustedAmount);
  balance.lastUpdated = timestamp;
  balance.eventCount = balance.eventCount.plus(BigInt.fromI32(1));
  balance.save();

  // Update global stats
  let globalStats = getOrCreateGlobalSeedsStats();
  globalStats.totalSeeds = globalStats.totalSeeds.plus(adjustedAmount);
  globalStats.totalSeedsFromReferrals = globalStats.totalSeedsFromReferrals.plus(adjustedAmount);

  if (isNewEarner) {
    globalStats.uniqueEarners = globalStats.uniqueEarners.plus(BigInt.fromI32(1));
  }

  globalStats.save();
}

export function handleAmbassadorRecruitmentSeeds(event: AmbassadorRecruitmentSeeds): void {
  let ambassadorId = event.params.ambassadorId;
  let sellerId = event.params.sellerId;
  let amount = event.params.seedsAmount;
  let timestamp = event.block.timestamp;

  // Get ambassador's wallet address
  let ambassador = Ambassador.load(ambassadorId.toString());
  if (!ambassador) return;

  let userAddress = ambassador.wallet;

  // Calculate multiplier and adjusted amount
  let multiplier = getMultiplier(timestamp);
  let adjustedAmount = amount.times(BigInt.fromI32(multiplier)).div(BigInt.fromI32(100));

  // Create Seeds event record
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let seedsEvent = new SeedsEvent(eventId);
  seedsEvent.user = userAddress;
  seedsEvent.amount = amount;
  seedsEvent.adjustedAmount = adjustedAmount;
  seedsEvent.reason = "recruitment";
  seedsEvent.sellerId = sellerId;
  seedsEvent.ambassadorId = ambassadorId;
  seedsEvent.multiplier = multiplier;
  seedsEvent.timestamp = timestamp;
  seedsEvent.txHash = event.transaction.hash;
  seedsEvent.blockNumber = event.block.number;
  seedsEvent.save();

  // Update user's Seeds balance
  let balance = getOrCreateSeedsBalance(userAddress);
  let isNewEarner = balance.total.equals(BigInt.fromI32(0));

  balance.recruitments = balance.recruitments.plus(adjustedAmount);
  balance.total = balance.total.plus(adjustedAmount);
  balance.lastUpdated = timestamp;
  balance.eventCount = balance.eventCount.plus(BigInt.fromI32(1));
  balance.save();

  // Update global stats
  let globalStats = getOrCreateGlobalSeedsStats();
  globalStats.totalSeeds = globalStats.totalSeeds.plus(adjustedAmount);
  globalStats.totalSeedsFromRecruitments = globalStats.totalSeedsFromRecruitments.plus(adjustedAmount);

  if (isNewEarner) {
    globalStats.uniqueEarners = globalStats.uniqueEarners.plus(BigInt.fromI32(1));
  }

  globalStats.save();
}
