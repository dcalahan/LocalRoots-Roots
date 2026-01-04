import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  SellerRegistered,
  SellerUpdated,
  ListingCreated,
  ListingUpdated,
  OrderCreated,
  OrderStatusChanged,
  DisputeRaised,
  SeedsEarned,
  SellerMilestoneSeeds,
} from "../generated/LocalRootsMarketplace/LocalRootsMarketplace";
import { Seller, Listing, Order, MarketplaceStats, SeedsBalance, SeedsEvent, GlobalSeedsStats } from "../generated/schema";

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

export function handleSellerRegistered(event: SellerRegistered): void {
  let seller = new Seller(event.params.sellerId.toString());
  seller.owner = event.params.owner;
  seller.geohash = event.params.geohash;
  seller.geohashPrefix = event.params.geohash.toHexString().slice(0, 10); // First 4 bytes as hex
  seller.storefrontIpfs = "";
  seller.offersDelivery = false;
  seller.offersPickup = true;
  seller.deliveryRadiusKm = BigInt.fromI32(0);
  seller.createdAt = event.block.timestamp;
  seller.active = true;
  seller.totalSales = BigInt.fromI32(0);
  seller.totalOrders = BigInt.fromI32(0);
  seller.save();

  let stats = getOrCreateStats();
  stats.totalSellers = stats.totalSellers.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleSellerUpdated(event: SellerUpdated): void {
  let seller = Seller.load(event.params.sellerId.toString());
  if (seller) {
    // Note: We'd need to call the contract to get updated values
    // For now, we just mark that an update occurred
    seller.save();
  }
}

export function handleListingCreated(event: ListingCreated): void {
  let listing = new Listing(event.params.listingId.toString());
  listing.seller = event.params.sellerId.toString();
  listing.metadataIpfs = "";
  listing.pricePerUnit = event.params.pricePerUnit;
  listing.quantityAvailable = BigInt.fromI32(0);
  listing.active = true;
  listing.totalSold = BigInt.fromI32(0);
  listing.save();

  let stats = getOrCreateStats();
  stats.totalListings = stats.totalListings.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleListingUpdated(event: ListingUpdated): void {
  let listing = Listing.load(event.params.listingId.toString());
  if (listing) {
    // Note: Would need contract call for full data
    listing.save();
  }
}

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString());
  order.listing = event.params.listingId.toString();
  order.buyer = event.params.buyer;
  order.quantity = event.params.quantity;
  order.totalPrice = BigInt.fromI32(0); // Would need contract call
  order.isDelivery = false;
  order.status = "Pending";
  order.createdAt = event.block.timestamp;

  let listing = Listing.load(event.params.listingId.toString());
  if (listing) {
    order.seller = listing.seller;
    listing.totalSold = listing.totalSold.plus(event.params.quantity);
    listing.save();
  } else {
    order.seller = "0";
  }

  order.save();

  let stats = getOrCreateStats();
  stats.totalOrders = stats.totalOrders.plus(BigInt.fromI32(1));
  stats.save();

  // Update seller stats
  if (listing) {
    let seller = Seller.load(listing.seller);
    if (seller) {
      seller.totalOrders = seller.totalOrders.plus(BigInt.fromI32(1));
      seller.save();
    }
  }
}

export function handleOrderStatusChanged(event: OrderStatusChanged): void {
  let order = Order.load(event.params.orderId.toString());
  if (order) {
    let status = event.params.status;
    if (status == 0) order.status = "Pending";
    else if (status == 1) order.status = "Accepted";
    else if (status == 2) order.status = "ReadyForPickup";
    else if (status == 3) order.status = "OutForDelivery";
    else if (status == 4) {
      order.status = "Completed";
      order.completedAt = event.block.timestamp;

      // Update seller total sales
      let seller = Seller.load(order.seller);
      if (seller) {
        seller.totalSales = seller.totalSales.plus(order.totalPrice);
        seller.save();
      }

      // Update global stats
      let stats = getOrCreateStats();
      stats.totalVolume = stats.totalVolume.plus(order.totalPrice);
      stats.save();
    } else if (status == 5) order.status = "Disputed";
    else if (status == 6) order.status = "Refunded";
    else if (status == 7) order.status = "Cancelled";

    order.save();
  }
}

export function handleDisputeRaised(event: DisputeRaised): void {
  let order = Order.load(event.params.orderId.toString());
  if (order) {
    order.status = "Disputed";
    order.disputedAt = event.block.timestamp;
    order.save();
  }
}

// ============ Phase 1 Seeds Handlers ============

export function handleSeedsEarned(event: SeedsEarned): void {
  let userAddress = event.params.user;
  let amount = event.params.amount;
  let reason = event.params.reason;
  let orderId = event.params.orderId;
  let timestamp = event.block.timestamp;

  // Calculate multiplier and adjusted amount
  let multiplier = getMultiplier(timestamp);
  let adjustedAmount = amount.times(BigInt.fromI32(multiplier)).div(BigInt.fromI32(100));

  // Create Seeds event record
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let seedsEvent = new SeedsEvent(eventId);
  seedsEvent.user = userAddress;
  seedsEvent.amount = amount;
  seedsEvent.adjustedAmount = adjustedAmount;
  seedsEvent.reason = reason;
  seedsEvent.orderId = orderId;
  seedsEvent.multiplier = multiplier;
  seedsEvent.timestamp = timestamp;
  seedsEvent.txHash = event.transaction.hash;
  seedsEvent.blockNumber = event.block.number;
  seedsEvent.save();

  // Update user's Seeds balance
  let balance = getOrCreateSeedsBalance(userAddress);
  let isNewEarner = balance.total.equals(BigInt.fromI32(0));

  if (reason == "purchase") {
    balance.purchases = balance.purchases.plus(adjustedAmount);
  } else if (reason == "sale") {
    balance.sales = balance.sales.plus(adjustedAmount);
  }

  balance.total = balance.total.plus(adjustedAmount);
  balance.lastUpdated = timestamp;
  balance.eventCount = balance.eventCount.plus(BigInt.fromI32(1));
  balance.save();

  // Update global stats
  let globalStats = getOrCreateGlobalSeedsStats();
  globalStats.totalSeeds = globalStats.totalSeeds.plus(adjustedAmount);

  if (reason == "purchase") {
    globalStats.totalSeedsFromPurchases = globalStats.totalSeedsFromPurchases.plus(adjustedAmount);
  } else if (reason == "sale") {
    globalStats.totalSeedsFromSales = globalStats.totalSeedsFromSales.plus(adjustedAmount);
  }

  if (isNewEarner) {
    globalStats.uniqueEarners = globalStats.uniqueEarners.plus(BigInt.fromI32(1));
  }

  globalStats.save();
}

export function handleSellerMilestoneSeeds(event: SellerMilestoneSeeds): void {
  let sellerAddress = event.params.seller;
  let sellerId = event.params.sellerId;
  let amount = event.params.amount;
  let milestone = event.params.milestone;
  let timestamp = event.block.timestamp;

  // Calculate multiplier and adjusted amount
  let multiplier = getMultiplier(timestamp);
  let adjustedAmount = amount.times(BigInt.fromI32(multiplier)).div(BigInt.fromI32(100));

  // Create Seeds event record
  let eventId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let seedsEvent = new SeedsEvent(eventId);
  seedsEvent.user = sellerAddress;
  seedsEvent.amount = amount;
  seedsEvent.adjustedAmount = adjustedAmount;
  seedsEvent.reason = "milestone";
  seedsEvent.sellerId = sellerId;
  seedsEvent.milestone = milestone;
  seedsEvent.multiplier = multiplier;
  seedsEvent.timestamp = timestamp;
  seedsEvent.txHash = event.transaction.hash;
  seedsEvent.blockNumber = event.block.number;
  seedsEvent.save();

  // Update user's Seeds balance
  let balance = getOrCreateSeedsBalance(sellerAddress);
  let isNewEarner = balance.total.equals(BigInt.fromI32(0));

  balance.milestones = balance.milestones.plus(adjustedAmount);
  balance.total = balance.total.plus(adjustedAmount);
  balance.lastUpdated = timestamp;
  balance.eventCount = balance.eventCount.plus(BigInt.fromI32(1));
  balance.save();

  // Update global stats
  let globalStats = getOrCreateGlobalSeedsStats();
  globalStats.totalSeeds = globalStats.totalSeeds.plus(adjustedAmount);
  globalStats.totalSeedsFromMilestones = globalStats.totalSeedsFromMilestones.plus(adjustedAmount);

  if (isNewEarner) {
    globalStats.uniqueEarners = globalStats.uniqueEarners.plus(BigInt.fromI32(1));
  }

  globalStats.save();
}
