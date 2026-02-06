'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DisputeEvidence } from './DisputeEvidence';
import type { Dispute } from '@/lib/contracts/disputeResolution';

interface DisputeVoteModalProps {
  dispute: Dispute & { id: bigint };
  onClose: () => void;
  onVote: (disputeId: bigint, voteForBuyer: boolean, reason: string) => Promise<boolean>;
  isVoting: boolean;
}

const MIN_REASON_LENGTH = 20;

export function DisputeVoteModal({
  dispute,
  onClose,
  onVote,
  isVoting,
}: DisputeVoteModalProps) {
  const [selectedVote, setSelectedVote] = useState<'buyer' | 'seller' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const now = Date.now() / 1000;
  const votingEndsAt = Number(dispute.votingEndsAt);
  const isVotingActive = now < votingEndsAt && !dispute.resolved;

  // Format time remaining
  const getTimeRemaining = () => {
    if (dispute.resolved) return 'Resolved';
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

    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError(`Please provide a reason (at least ${MIN_REASON_LENGTH} characters)`);
      return;
    }

    setError(null);
    const success = await onVote(dispute.id, selectedVote === 'buyer', reason.trim());

    if (success) {
      onClose();
    } else {
      setError('Failed to submit vote. Please try again.');
    }
  };

  const totalVotes = Number(dispute.votesForBuyer + dispute.votesForSeller);
  const reasonIsValid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-heading font-bold">
                Dispute #{dispute.id.toString()}
              </h2>
              <p className="text-sm text-roots-gray mt-1">
                Order #{dispute.orderId.toString()} | Seller #{dispute.sellerId.toString()}
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
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                isVotingActive ? 'bg-roots-secondary animate-pulse' : 'bg-roots-gray'
              }`} />
              {getTimeRemaining()}
            </span>
            <span className="text-sm text-roots-gray">
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''} cast
            </span>
          </div>

          {/* Evidence sections */}
          <div className="space-y-4 mb-6">
            <DisputeEvidence
              title="Buyer's Statement"
              reason={dispute.buyerReason}
              evidenceIpfs={dispute.buyerEvidenceIpfs}
            />

            {dispute.sellerResponse ? (
              <DisputeEvidence
                title="Seller's Response"
                reason={dispute.sellerResponse}
                evidenceIpfs={dispute.sellerEvidenceIpfs}
              />
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Seller has not yet responded to this dispute.
                </p>
              </div>
            )}
          </div>

          {/* Current vote counts */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {dispute.votesForBuyer.toString()}
              </p>
              <p className="text-sm text-roots-gray">For Buyer</p>
            </div>
            <div className="flex-1 bg-roots-secondary/10 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-roots-secondary">
                {dispute.votesForSeller.toString()}
              </p>
              <p className="text-sm text-roots-gray">For Seller</p>
            </div>
          </div>

          {/* Voting UI */}
          {isVotingActive && (
            <>
              <div className="mb-4">
                <p className="text-sm font-medium mb-3">Cast your vote:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedVote('buyer')}
                    disabled={isVoting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedVote === 'buyer'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-center">
                      <span className="text-2xl mb-1 block">👤</span>
                      <span className="font-medium">Side with Buyer</span>
                      <p className="text-xs text-roots-gray mt-1">
                        Refund the buyer
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedVote('seller')}
                    disabled={isVoting}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedVote === 'seller'
                        ? 'border-roots-secondary bg-roots-secondary/10'
                        : 'border-gray-200 hover:border-roots-secondary/50'
                    } ${isVoting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="text-center">
                      <span className="text-2xl mb-1 block">🌱</span>
                      <span className="font-medium">Side with Seller</span>
                      <p className="text-xs text-roots-gray mt-1">
                        Release funds to seller
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Reason input */}
              {selectedVote && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Explain your decision <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      selectedVote === 'buyer'
                        ? "Explain why you believe the buyer's claim is valid..."
                        : "Explain why you believe the seller fulfilled their obligations..."
                    }
                    className={`w-full p-3 border rounded-lg h-24 resize-none focus:ring-2 focus:ring-roots-primary focus:border-transparent ${
                      reason.length > 0 && !reasonIsValid
                        ? 'border-red-300'
                        : 'border-gray-300'
                    }`}
                    disabled={isVoting}
                  />
                  <p className={`text-xs mt-1 ${
                    reason.length > 0 && !reasonIsValid
                      ? 'text-red-500'
                      : 'text-roots-gray'
                  }`}>
                    {reason.length}/{MIN_REASON_LENGTH} characters minimum
                    {reasonIsValid && ' ✓'}
                  </p>
                </div>
              )}

              {/* Seeds reward notice */}
              <div className="bg-roots-cream rounded-lg p-3 mb-4">
                <p className="text-sm text-roots-gray">
                  <span className="font-medium text-roots-primary">+100 Seeds</span> for voting
                  {' '}• <span className="font-medium text-roots-primary">+50 bonus</span> if you vote with the majority
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
                  disabled={isVoting || !selectedVote || !reasonIsValid}
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
                {dispute.resolved
                  ? `This dispute has been resolved. ${dispute.buyerWon ? 'Buyer won.' : 'Seller won.'}`
                  : 'Voting has ended. This dispute is pending resolution.'}
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
