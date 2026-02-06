'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useDisputes, useHasVoted } from '@/hooks/useDisputes';
import { useVoteOnDispute, useResolveDispute } from '@/hooks/useVoteOnDispute';
import { DisputeCard } from '@/components/disputes/DisputeCard';
import { DisputeVoteModal } from '@/components/disputes/DisputeVoteModal';
import { useToast } from '@/hooks/use-toast';
import type { Dispute } from '@/lib/contracts/disputeResolution';

type Tab = 'open' | 'voted' | 'resolved';

export default function AmbassadorDisputesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { authenticated: isConnected } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const { isAmbassador, ambassadorId, isLoading: isLoadingAmbassador } = useAmbassadorStatus();

  const [activeTab, setActiveTab] = useState<Tab>('open');
  const [selectedDispute, setSelectedDispute] = useState<(Dispute & { id: bigint }) | null>(null);
  const [votedDisputeIds, setVotedDisputeIds] = useState<Set<string>>(new Set());

  // Fetch all disputes
  const { disputes, isLoading: isLoadingDisputes, error, refetch } = useDisputes();
  const { vote, isLoading: isVoting } = useVoteOnDispute();
  const { resolveDispute, isLoading: isResolving } = useResolveDispute();

  // Redirect if not an ambassador
  useEffect(() => {
    if (!isLoadingAmbassador && isConnected && !isAmbassador) {
      router.push('/ambassador');
    }
  }, [isAmbassador, isLoadingAmbassador, isConnected, router]);

  // Check voted status for each dispute
  useEffect(() => {
    if (!ambassadorId || disputes.length === 0) return;

    // Track which disputes the ambassador has voted on
    const checkVoted = async () => {
      const newVotedIds = new Set<string>();
      // For now, we'll check individually. In production, consider batching.
      for (const dispute of disputes) {
        // We'd need a way to check hasVoted for each dispute
        // This could be optimized with a multicall
      }
      setVotedDisputeIds(newVotedIds);
    };

    checkVoted();
  }, [disputes, ambassadorId]);

  // Filter disputes by tab
  const now = Date.now() / 1000;
  const filteredDisputes = disputes.filter((d) => {
    const votingEndsAt = Number(d.votingEndsAt);
    const isVotingActive = now < votingEndsAt && !d.resolved;
    const hasVoted = votedDisputeIds.has(d.id.toString());

    switch (activeTab) {
      case 'open':
        return isVotingActive && !hasVoted;
      case 'voted':
        return !d.resolved && hasVoted;
      case 'resolved':
        return d.resolved;
      default:
        return true;
    }
  });

  const handleVote = (disputeId: bigint) => {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (dispute) {
      setSelectedDispute(dispute);
    }
  };

  const handleVoteSubmit = async (disputeId: bigint, voteForBuyer: boolean, reason: string): Promise<boolean> => {
    const success = await vote(disputeId, voteForBuyer, reason);
    if (success) {
      toast({
        title: 'Vote submitted!',
        description: 'You earned 100 Seeds for participating.',
      });
      // Add to voted set
      setVotedDisputeIds((prev) => new Set([...prev, disputeId.toString()]));
      // Refetch disputes to update counts
      setTimeout(() => refetch(), 2000);
    }
    return success;
  };

  const handleResolve = async (disputeId: bigint) => {
    const success = await resolveDispute(disputeId);
    if (success) {
      toast({
        title: 'Dispute resolved!',
        description: 'The dispute has been finalized.',
      });
      refetch();
    } else {
      toast({
        title: 'Failed to resolve',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-4xl mb-4">🔗</div>
            <p className="text-roots-gray mb-4">Connect your wallet to view disputes</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoadingAmbassador) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Count for badges
  const openCount = disputes.filter((d) => {
    const votingEndsAt = Number(d.votingEndsAt);
    return now < votingEndsAt && !d.resolved && !votedDisputeIds.has(d.id.toString());
  }).length;

  const votedCount = disputes.filter(
    (d) => !d.resolved && votedDisputeIds.has(d.id.toString())
  ).length;

  const resolvedCount = disputes.filter((d) => d.resolved).length;

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Dispute Resolution</h1>
            <p className="text-roots-gray">
              Review disputes and vote to help resolve them
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/ambassador/governance">
              <Button variant="outline" size="sm">
                Gov Requests
              </Button>
            </Link>
            <Link href="/ambassador/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Info banner */}
        <Card className="mb-6 bg-roots-cream border-roots-primary/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚖️</span>
              <div>
                <p className="text-sm font-medium mb-1">How Dispute Voting Works</p>
                <p className="text-sm text-roots-gray">
                  When a buyer disputes an order, ambassadors vote on the outcome.
                  Review the evidence from both parties before casting your vote.
                  You earn <strong>100 Seeds</strong> for voting, plus <strong>50 bonus Seeds</strong> if you vote with the majority.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b pb-4">
          <button
            onClick={() => setActiveTab('open')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'open'
                ? 'bg-roots-primary text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Open
            {openCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {openCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('voted')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'voted'
                ? 'bg-roots-secondary text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Voted
            {votedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {votedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('resolved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'resolved'
                ? 'bg-roots-gray text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Resolved
            {resolvedCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {resolvedCount}
              </span>
            )}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-4">
              <p className="text-sm text-red-700">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading disputes */}
        {isLoadingDisputes && (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
                  <div className="flex gap-4">
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Dispute list */}
        {!isLoadingDisputes && filteredDisputes.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {filteredDisputes.map((dispute) => (
              <DisputeCard
                key={dispute.id.toString()}
                dispute={dispute}
                hasVoted={votedDisputeIds.has(dispute.id.toString())}
                onVote={
                  dispute.resolved
                    ? () => {} // No action for resolved
                    : now >= Number(dispute.votingEndsAt)
                    ? handleResolve
                    : handleVote
                }
              />
            ))}
          </div>
        )}

        {/* Empty states */}
        {!isLoadingDisputes && filteredDisputes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              {activeTab === 'open' && (
                <>
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="font-medium mb-2">No open disputes</h3>
                  <p className="text-sm text-roots-gray">
                    All disputes have been voted on. Check back later!
                  </p>
                </>
              )}
              {activeTab === 'voted' && (
                <>
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="font-medium mb-2">No pending votes</h3>
                  <p className="text-sm text-roots-gray">
                    You haven't voted on any disputes that are still being counted.
                  </p>
                </>
              )}
              {activeTab === 'resolved' && (
                <>
                  <div className="text-4xl mb-4">📜</div>
                  <h3 className="font-medium mb-2">No resolved disputes</h3>
                  <p className="text-sm text-roots-gray">
                    Resolved disputes will appear here for reference.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Vote modal */}
        {selectedDispute && (
          <DisputeVoteModal
            dispute={selectedDispute}
            onClose={() => setSelectedDispute(null)}
            onVote={handleVoteSubmit}
            isVoting={isVoting}
          />
        )}
      </div>
    </div>
  );
}
