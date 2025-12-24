import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  AmbassadorRegistered,
  SellerRecruited,
  RewardDistributed,
} from "../generated/AmbassadorRewards/AmbassadorRewards";
import {
  Ambassador,
  Seller,
  AmbassadorReward,
  MarketplaceStats,
} from "../generated/schema";

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

  // Link to senior ambassador if exists
  if (event.params.seniorId.gt(BigInt.fromI32(0))) {
    ambassador.seniorAmbassador = event.params.seniorId.toString();

    // Update senior's recruited count
    let senior = Ambassador.load(event.params.seniorId.toString());
    if (senior) {
      senior.recruitedAmbassadorsCount = senior.recruitedAmbassadorsCount.plus(
        BigInt.fromI32(1)
      );
      senior.save();
    }
  }

  ambassador.save();

  let stats = getOrCreateStats();
  stats.totalAmbassadors = stats.totalAmbassadors.plus(BigInt.fromI32(1));
  stats.save();
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

export function handleRewardDistributed(event: RewardDistributed): void {
  let rewardId =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let reward = new AmbassadorReward(rewardId);
  reward.ambassador = event.params.ambassadorId.toString();
  reward.seller = event.params.sellerId.toString();
  reward.amount = event.params.amount;
  reward.seniorAmount = event.params.seniorAmount;
  reward.timestamp = event.block.timestamp;
  reward.txHash = event.transaction.hash;
  reward.save();

  // Update ambassador totals
  let ambassador = Ambassador.load(event.params.ambassadorId.toString());
  if (ambassador) {
    ambassador.totalEarned = ambassador.totalEarned.plus(event.params.amount);
    ambassador.save();
  }

  // Update global stats
  let stats = getOrCreateStats();
  let totalReward = event.params.amount.plus(event.params.seniorAmount);
  stats.totalAmbassadorRewards = stats.totalAmbassadorRewards.plus(totalReward);
  stats.save();
}
