import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  RequestSubmitted,
  RequestVoteCast,
  RequestResolved,
  RequestAdminResolved,
  DataExportUploaded,
} from "../generated/GovernmentRequests/GovernmentRequests";
import { GovernmentRequest, GovernmentRequestVote, GovernanceStats } from "../generated/schema";

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

export function handleRequestSubmitted(event: RequestSubmitted): void {
  let request = new GovernmentRequest(event.params.requestId.toString());
  request.requester = event.params.requester;
  request.agencyName = event.params.agencyName;
  request.agencyEmail = ""; // Not in event, would need contract call
  request.jurisdiction = event.params.jurisdiction;
  request.requestType = event.params.requestType;
  request.justification = ""; // Not in event, stored in contract
  request.credentialsIpfs = ""; // Not in event, stored in contract
  request.createdAt = event.block.timestamp;
  request.votingEndsAt = event.block.timestamp.plus(BigInt.fromI64(5 * 24 * 60 * 60)); // 5 days
  request.votesApprove = BigInt.fromI32(0);
  request.votesDeny = BigInt.fromI32(0);
  request.resolved = false;
  request.approved = false;
  request.dataExportIpfs = null;
  request.save();

  let stats = getOrCreateGovernanceStats();
  stats.totalGovernmentRequests = stats.totalGovernmentRequests.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleRequestVoteCast(event: RequestVoteCast): void {
  let voteId = event.params.requestId.toString() + "-" + event.params.ambassadorId.toString();
  let vote = new GovernmentRequestVote(voteId);
  vote.request = event.params.requestId.toString();
  vote.ambassadorId = event.params.ambassadorId;
  vote.ambassadorWallet = event.transaction.from;
  vote.approved = event.params.approved;
  vote.timestamp = event.block.timestamp;
  vote.txHash = event.transaction.hash;
  vote.save();

  // Update request vote counts
  let request = GovernmentRequest.load(event.params.requestId.toString());
  if (request) {
    if (event.params.approved) {
      request.votesApprove = request.votesApprove.plus(BigInt.fromI32(1));
    } else {
      request.votesDeny = request.votesDeny.plus(BigInt.fromI32(1));
    }
    request.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalGovernmentRequestVotes = stats.totalGovernmentRequestVotes.plus(BigInt.fromI32(1));
  stats.save();
}

export function handleRequestResolved(event: RequestResolved): void {
  let request = GovernmentRequest.load(event.params.requestId.toString());
  if (request) {
    request.resolved = true;
    request.approved = event.params.approved;
    request.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalGovernmentRequestsResolved = stats.totalGovernmentRequestsResolved.plus(BigInt.fromI32(1));
  if (event.params.approved) {
    stats.totalGovernmentRequestsApproved = stats.totalGovernmentRequestsApproved.plus(BigInt.fromI32(1));
  } else {
    stats.totalGovernmentRequestsDenied = stats.totalGovernmentRequestsDenied.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function handleRequestAdminResolved(event: RequestAdminResolved): void {
  let request = GovernmentRequest.load(event.params.requestId.toString());
  if (request) {
    request.resolved = true;
    request.approved = event.params.approved;
    request.save();
  }

  let stats = getOrCreateGovernanceStats();
  stats.totalGovernmentRequestsResolved = stats.totalGovernmentRequestsResolved.plus(BigInt.fromI32(1));
  if (event.params.approved) {
    stats.totalGovernmentRequestsApproved = stats.totalGovernmentRequestsApproved.plus(BigInt.fromI32(1));
  } else {
    stats.totalGovernmentRequestsDenied = stats.totalGovernmentRequestsDenied.plus(BigInt.fromI32(1));
  }
  stats.save();
}

export function handleDataExportUploaded(event: DataExportUploaded): void {
  let request = GovernmentRequest.load(event.params.requestId.toString());
  if (request) {
    request.dataExportIpfs = event.params.dataExportIpfs;
    request.save();
  }
}
