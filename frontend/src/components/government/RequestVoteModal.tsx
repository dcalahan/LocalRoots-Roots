'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { DataRequest } from '@/lib/contracts/governmentRequests';

interface RequestVoteModalProps {
  request: DataRequest & { id: bigint };
  onClose: () => void;
  onVote: (requestId: bigint, approve: boolean) => Promise<boolean>;
  isVoting: boolean;
}

export function RequestVoteModal({
  request,
  onClose,
  onVote,
  isVoting,
}: RequestVoteModalProps) {
  const [selectedVote, setSelectedVote] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = Date.now() / 1000;
  const votingEndsAt = Number(request.votingEndsAt);
  const isVotingActive = now < votingEndsAt && !request.resolved;

  // Format time remaining
  const getTimeRemaining = () => {
    if (request.resolved) return 'Resolved';
    const secondsRemaining = votingEndsAt - now;
    if (secondsRemaining <= 0) return 'Voting ended';

    const hours = Math.floor(secondsRemaining / 3600);
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    if (days > 0) return `${days}d ${remainingHours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const handleVote = async () => {
    if (!selectedVote) return;

    setError(null);
    const success = await onVote(request.id, selectedVote === 'approve');

    if (success) {
      onClose();
    } else {
      setError('Failed to submit vote. Please try again.');
    }
  };

  const totalVotes = Number(request.votesApprove + request.votesDeny);

  // Format date
  const formatDate = (timestamp: bigint) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Get credentials URL
  const getCredentialsUrl = () => {
    if (!request.credentialsIpfs) return null;
    const hash = request.credentialsIpfs.replace('ipfs://', '');
    return `https://gateway.pinata.cloud/ipfs/${hash}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-heading font-bold">
                Government Data Request
              </h2>
              <p className="text-sm text-roots-gray mt-1">
                Request #{request.id.toString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-roots-gray hover:text-gray-900 text-2xl leading-none"
              disabled={isVoting}
            >
              &times;
            </button>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-4">
            <span className="text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${
                  isVotingActive ? 'bg-blue-500 animate-pulse' : 'bg-roots-gray'
                }`}
              />
              {getTimeRemaining()}
            </span>
            <span className="text-sm text-roots-gray">
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
            </span>
          </div>

          {/* Request details */}
          <div className="space-y-4 mb-6">
            {/* Agency info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-roots-gray">Agency</p>
                  <p className="font-medium">{request.agencyName}</p>
                </div>
                <div>
                  <p className="text-xs text-roots-gray">Jurisdiction</p>
                  <p className="font-medium">{request.jurisdiction}</p>
                </div>
                <div>
                  <p className="text-xs text-roots-gray">Email</p>
                  <p className="font-medium">{request.agencyEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-roots-gray">Submitted</p>
                  <p className="font-medium">{formatDate(request.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Request type */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-roots-gray mb-1">Request Type</p>
              <span
                className={`inline-block px-2 py-1 text-sm rounded-full ${
                  request.requestType.toLowerCase().includes('food')
                    ? 'bg-roots-primary/20 text-roots-primary'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {request.requestType.toLowerCase().includes('food')
                  ? 'Food Safety Investigation'
                  : request.requestType}
              </span>
            </div>

            {/* Justification */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-roots-gray mb-2">Justification</p>
              <p className="text-sm whitespace-pre-wrap">{request.justification}</p>
            </div>

            {/* Credentials */}
            {getCredentialsUrl() && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-roots-gray mb-2">Supporting Documentation</p>
                <a
                  href={getCredentialsUrl()!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-roots-primary hover:underline"
                >
                  <span>📄</span>
                  <span>View credentials (PDF)</span>
                </a>
              </div>
            )}
          </div>

          {/* Current vote counts */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-roots-secondary/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-roots-secondary">
                {request.votesApprove.toString()}
              </p>
              <p className="text-sm text-roots-gray">Approve</p>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-red-600">
                {request.votesDeny.toString()}
              </p>
              <p className="text-sm text-roots-gray">Deny</p>
            </div>
          </div>

          {/* Voting UI */}
          {isVotingActive && (
            <>
              <div className="mb-4">
                <p className="text-sm font-medium mb-3">Cast your vote:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedVote('approve')}
                    disabled={isVoting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedVote === 'approve'
                        ? 'border-roots-secondary bg-roots-secondary/10'
                        : 'border-gray-200 hover:border-roots-secondary/50'
                    } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-center">
                      <span className="text-2xl mb-1 block">✅</span>
                      <span className="font-medium">Approve Request</span>
                      <p className="text-xs text-roots-gray mt-1">
                        Allow data to be shared
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedVote('deny')}
                    disabled={isVoting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedVote === 'deny'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-center">
                      <span className="text-2xl mb-1 block">❌</span>
                      <span className="font-medium">Deny Request</span>
                      <p className="text-xs text-roots-gray mt-1">
                        Reject this request
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Carefully review the credentials and
                  justification before voting. Approving this request will allow the
                  agency access to transaction data.
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isVoting}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
                  onClick={handleVote}
                  disabled={isVoting || !selectedVote}
                >
                  {isVoting ? 'Submitting...' : 'Submit Vote'}
                </Button>
              </div>
            </>
          )}

          {/* Not voting state */}
          {!isVotingActive && (
            <div className="text-center">
              <p className="text-sm text-roots-gray mb-4">
                {request.resolved
                  ? `This request has been ${request.approved ? 'approved' : 'denied'}.`
                  : 'Voting has ended. This request is pending resolution.'}
              </p>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
