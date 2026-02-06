'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Dispute } from '@/lib/contracts/disputeResolution';

interface DisputeCardProps {
  dispute: Dispute & { id: bigint };
  hasVoted: boolean;
  onVote: (disputeId: bigint) => void;
}

export function DisputeCard({ dispute, hasVoted, onVote }: DisputeCardProps) {
  const now = Date.now() / 1000;
  const votingEndsAt = Number(dispute.votingEndsAt);
  const isVotingActive = now < votingEndsAt && !dispute.resolved;
  const totalVotes = Number(dispute.votesForBuyer + dispute.votesForSeller);

  // Format time remaining
  const getTimeRemaining = () => {
    if (dispute.resolved) return 'Resolved';
    const secondsRemaining = votingEndsAt - now;
    if (secondsRemaining <= 0) return 'Voting ended';

    const hours = Math.floor(secondsRemaining / 3600);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    return `${hours}h left`;
  };

  // Status badge
  const getStatusBadge = () => {
    if (dispute.resolved) {
      return (
        <span className={`px-2 py-1 text-xs rounded-full ${
          dispute.buyerWon ? 'bg-blue-100 text-blue-800' : 'bg-roots-secondary/20 text-roots-secondary'
        }`}>
          {dispute.buyerWon ? 'Buyer Won' : 'Seller Won'}
        </span>
      );
    }
    if (!isVotingActive) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
          Pending Resolution
        </span>
      );
    }
    if (dispute.extended) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">
          Extended
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-roots-secondary/20 text-roots-secondary">
        Active
      </span>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">
              Order #{dispute.orderId.toString()}
            </CardTitle>
            <p className="text-sm text-roots-gray mt-1">
              Seller #{dispute.sellerId.toString()}
            </p>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        {/* Reason */}
        <div className="mb-4">
          <p className="text-sm font-medium text-roots-gray">Buyer&apos;s reason:</p>
          <p className="text-sm mt-1 line-clamp-2">{dispute.buyerReason}</p>
        </div>

        {/* Vote counts */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {dispute.votesForBuyer.toString()}
            </p>
            <p className="text-xs text-roots-gray">For Buyer</p>
          </div>
          <div className="flex-1 bg-roots-secondary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-roots-secondary">
              {dispute.votesForSeller.toString()}
            </p>
            <p className="text-xs text-roots-gray">For Seller</p>
          </div>
        </div>

        {/* Time remaining and action */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-roots-gray">
            {getTimeRemaining()} | {totalVotes} votes
          </span>

          {isVotingActive && !hasVoted && (
            <Button
              onClick={() => onVote(dispute.id)}
              size="sm"
              className="bg-roots-primary hover:bg-roots-primary/90"
            >
              Vote
            </Button>
          )}

          {hasVoted && (
            <span className="text-sm text-roots-secondary font-medium">
              Voted
            </span>
          )}

          {!isVotingActive && !dispute.resolved && (
            <Button
              onClick={() => onVote(dispute.id)}
              size="sm"
              variant="outline"
            >
              Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
