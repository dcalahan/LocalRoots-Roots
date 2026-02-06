'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DataRequest } from '@/lib/contracts/governmentRequests';

interface RequestCardProps {
  request: DataRequest & { id: bigint };
  hasVoted: boolean;
  onVote?: (requestId: bigint) => void;
  showVoteButton?: boolean;
}

export function RequestCard({
  request,
  hasVoted,
  onVote,
  showVoteButton = true,
}: RequestCardProps) {
  const now = Date.now() / 1000;
  const votingEndsAt = Number(request.votingEndsAt);
  const isVotingActive = now < votingEndsAt && !request.resolved;
  const totalVotes = Number(request.votesApprove + request.votesDeny);

  // Format time remaining
  const getTimeRemaining = () => {
    if (request.resolved) return 'Resolved';
    const secondsRemaining = votingEndsAt - now;
    if (secondsRemaining <= 0) return 'Voting ended';

    const hours = Math.floor(secondsRemaining / 3600);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    return `${hours}h left`;
  };

  // Format date
  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Status badge
  const getStatusBadge = () => {
    if (request.resolved) {
      return (
        <span
          className={`px-2 py-1 text-xs rounded-full ${
            request.approved
              ? 'bg-roots-secondary/20 text-roots-secondary'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {request.approved ? 'Approved' : 'Denied'}
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
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
        Active Voting
      </span>
    );
  };

  // Request type badge
  const getTypeBadge = () => {
    const isFood = request.requestType.toLowerCase().includes('food');
    return (
      <span
        className={`px-2 py-1 text-xs rounded-full ${
          isFood ? 'bg-roots-primary/20 text-roots-primary' : 'bg-gray-200 text-gray-700'
        }`}
      >
        {isFood ? 'Food Safety' : 'Other'}
      </span>
    );
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{request.agencyName}</CardTitle>
            <p className="text-sm text-roots-gray mt-1">{request.jurisdiction}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {getStatusBadge()}
            {getTypeBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Justification */}
        <div className="mb-4">
          <p className="text-sm font-medium text-roots-gray">Justification:</p>
          <p className="text-sm mt-1 line-clamp-3">{request.justification}</p>
        </div>

        {/* Vote counts */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 bg-roots-secondary/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-roots-secondary">
              {request.votesApprove.toString()}
            </p>
            <p className="text-xs text-roots-gray">Approve</p>
          </div>
          <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">
              {request.votesDeny.toString()}
            </p>
            <p className="text-xs text-roots-gray">Deny</p>
          </div>
        </div>

        {/* Metadata */}
        <div className="text-xs text-roots-gray mb-3 flex gap-3">
          <span>Submitted: {formatDate(request.createdAt)}</span>
          <span>|</span>
          <span>{request.agencyEmail}</span>
        </div>

        {/* Time remaining and action */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-roots-gray">
            {getTimeRemaining()} | {totalVotes} votes
          </span>

          {showVoteButton && isVotingActive && !hasVoted && onVote && (
            <Button
              onClick={() => onVote(request.id)}
              size="sm"
              className="bg-roots-primary hover:bg-roots-primary/90"
            >
              Vote
            </Button>
          )}

          {hasVoted && (
            <span className="text-sm text-roots-secondary font-medium">Voted</span>
          )}

          {!isVotingActive && !request.resolved && onVote && (
            <Button onClick={() => onVote(request.id)} size="sm" variant="outline">
              Resolve
            </Button>
          )}

          {request.resolved && request.approved && request.dataExportIpfs && (
            <a
              href={`https://gateway.pinata.cloud/ipfs/${request.dataExportIpfs.replace(
                'ipfs://',
                ''
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-roots-primary hover:underline"
            >
              View Export
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
