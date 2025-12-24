import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  SellerRegistered,
  SellerUpdated,
  ListingCreated,
  ListingUpdated,
  OrderCreated,
  OrderStatusChanged,
  DisputeRaised,
} from "../generated/LocalRootsMarketplace/LocalRootsMarketplace";
import { Seller, Listing, Order, MarketplaceStats } from "../generated/schema";

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
