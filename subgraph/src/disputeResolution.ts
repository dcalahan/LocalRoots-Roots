import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  DisputeOpened,
  SellerResponseSubmitted,
  DisputeVoteCast,
  DisputeResolved,
  DisputeAdminResolved,
  SellerStrikeAdded,
  BuyerStrikeAdded,
} from "../generated/DisputeResolution/DisputeResolution";
import { Dispute, DisputeVote, UserStrikes, GovernanceStats } from "../generated/schema";

function getOrCreateGovernanceStats(): GovernanceStats {
  let stats = GovernanceStats.load("global");
  if (!stats) {
    stats = new GovernanceStats("global");
    stats.totalDisputes = BigInt.fromI32(0);
    stats.totalDisputesResolved = BigInt.fromI32(0);
    stats.totalDisputesBuyerWon = BigInt.fromI32(0);
    stats.totalDisputesSellerWon = BigInt.fromI32(0);
    stats.totalDisputeVotes = BigInt.fromI32(0);
    stats.totalGovernmentRequests = BigInt.fromI32(0);
    stats.totalGovernmentRequestsResolved = BigInt.fromI32(0);
    stats.totalGovernmentRequestsApproved = BigInt.fromI32(0);
    stats.totalGovernmentRequestsDenied = BigInt.fromI32(0);
    stats.totalGovernmentRequestVotes = BigInt.fromI32(0);
  }
  return stats;
}

function getOrCreateUserStrikes(userAddress: Bytes): UserStrikes {
  let id = userAddress.toHexString().toLowerCase();
  let strikes = UserStrikes.load(id);
  if (!strikes) {
    strikes = new UserStrikes(id);
    strikes.user = userAddress;
    strikes.sellerStrikes = BigInt.fromI32(0);
    strikes.buyerStrikes = BigInt.fromI32(0);
    strikes.lastStrikeAt = BigInt.fromI32(0);
  }
  return strikes;
}

export function handleDisputeOpened(event: DisputeOpened): void {
  let dispute = new Dispute(event.params.disputeId.toString());
  dispute.orderId = event.params.orderId;
  dispute.sellerId = event.params.sellerId;
  dispute.buyerReason = event.params.reason;
  dispute.buyerEvidenceIpfs = event.params.evidenceIpfs;
  dispute.sellerResponse = null;
  dispute.sellerEvidenceIpfs = null;
  dispute.createdAt = event.block.timestamp;
  dispute.votingEndsAt = event.block.timestamp.plus(BigInt.fromI64(3 * 24 * 60 * 60)); // 3 days
  dispute.votesForBuyer = BigInt.fromI32(0);
  dispute.votesForSeller = BigInt.fromI32(0);
  dispute.resolved = false;
  dispute.buyerWon = false;
  dispute.extended = false;
  dispute.adminResolved = false;
  dispute.adminReason = null;
  dispute.save();

  let stats = getOrCreateGovernanceStats();
  stats.totalDisputes = stats.totalDisputes.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleSellerResponseSubmitted(event: SellerResponseSubmitted): void {
  let dispute = Dispute.load(event.params.disputeId.toString());
  if (dispute) {
    dispute.sellerResponse = event.params.response;
    dispute.sellerEvidenceIpfs = event.params.evidenceIpfs;
    dispute.save();
  }
}

export function handleDisputeVoteCast(event: DisputeVoteCast): void {
  let voteId = event.params.disputeId.toString() + "-" + event.params.ambassadorId.toString();
  let vote = new DisputeVote(voteId);
  vote.dispute = event.params.disputeId.toString();
  vote.ambassadorId = event.params.ambassadorId;
  vote.ambassadorWallet = event.transaction.from;
  vote.votedForBuyer = event.params.votedForBuyer;
  vote.seedsEarned = event.params.seedsEarned;
  vote.timestamp = event.block.timestamp;
  vote.txHash = event.transaction.hash;
  vote.save();

  // Update dispute vote counts
  let dispute = Dispute.load(event.params.disputeId.toString());
  if (dispute) {
    if (event.params.votedForBuyer) {
      dispute.votesForBuyer = dispute.votesForBuyer.plus(BigInt.fromI32(1));
    } else {
      dispute.votesForSeller = dispute.votesForSeller.plus(BigInt.fromI32(1));
    }
    dispute.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalDisputeVotes = stats.totalDisputeVotes.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleDisputeResolved(event: DisputeResolved): void {
  let dispute = Dispute.load(event.params.disputeId.toString());
  if (dispute) {
    dispute.resolved = true;
    dispute.buyerWon = event.params.buyerWon;
    dispute.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalDisputesResolved = stats.totalDisputesResolved.plus(BigInt.fromI32(1));
  if (event.params.buyerWon) {
    stats.totalDisputesBuyerWon = stats.totalDisputesBuyerWon.plus(BigInt.fromI32(1));
  } else {
    stats.totalDisputesSellerWon = stats.totalDisputesSellerWon.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function handleDisputeAdminResolved(event: DisputeAdminResolved): void {
  let dispute = Dispute.load(event.params.disputeId.toString());
  if (dispute) {
    dispute.resolved = true;
    dispute.buyerWon = event.params.buyerWon;
    dispute.adminResolved = true;
    dispute.adminReason = event.params.reason;
    dispute.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalDisputesResolved = stats.totalDisputesResolved.plus(BigInt.fromI32(1));
  if (event.params.buyerWon) {
    stats.totalDisputesBuyerWon = stats.totalDisputesBuyerWon.plus(BigInt.fromI32(1));
  } else {
    stats.totalDisputesSellerWon = stats.totalDisputesSellerWon.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function handleSellerStrikeAdded(event: SellerStrikeAdded): void {
  let strikes = getOrCreateUserStrikes(event.params.seller);
  strikes.sellerStrikes = event.params.totalStrikes;
  strikes.lastStrikeAt = event.block.timestamp;
  strikes.save();
}

export function handleBuyerStrikeAdded(event: BuyerStrikeAdded): void {
  let strikes = getOrCreateUserStrikes(event.params.buyer);
  strikes.buyerStrikes = event.params.totalStrikes;
  strikes.lastStrikeAt = event.block.timestamp;
  strikes.save();
}
