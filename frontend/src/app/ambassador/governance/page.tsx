'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useActiveGovernmentRequests } from '@/hooks/useGovernmentRequests';
import { useVoteOnGovRequest, useResolveGovRequest } from '@/hooks/useVoteOnGovRequest';
import { RequestCard } from '@/components/government/RequestCard';
import { RequestVoteModal } from '@/components/government/RequestVoteModal';
import { useToast } from '@/hooks/use-toast';
import type { DataRequest } from '@/lib/contracts/governmentRequests';

export default function AmbassadorGovernancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { authenticated: isConnected } = usePrivy();
  const { wallets } = useWallets();
  const { isAmbassador, ambassadorId, isLoading: isLoadingAmbassador } = useAmbassadorStatus();

  const [selectedRequest, setSelectedRequest] = useState<(DataRequest & { id: bigint }) | null>(null);
  const [votedRequestIds, setVotedRequestIds] = useState<Set<string>>(new Set());

  // Fetch active government requests
  const { requests, isLoading: isLoadingRequests, error, refetch } = useActiveGovernmentRequests();
  const { vote, isLoading: isVoting } = useVoteOnGovRequest();
  const { resolveRequest, isLoading: isResolving } = useResolveGovRequest();

  // Redirect if not an ambassador
  useEffect(() => {
    if (!isLoadingAmbassador && isConnected && !isAmbassador) {
      router.push('/ambassador');
    }
  }, [isAmbassador, isLoadingAmbassador, isConnected, router]);

  const handleVote = (requestId: bigint) => {
    const request = requests.find((r) => r.id === requestId);
    if (request) {
      setSelectedRequest(request);
    }
  };

  const handleVoteSubmit = async (requestId: bigint, approve: boolean): Promise<boolean> => {
    const success = await vote(requestId, approve);
    if (success) {
      toast({
        title: 'Vote submitted!',
        description: 'Your vote has been recorded.',
      });
      // Add to voted set
      setVotedRequestIds((prev) => new Set([...prev, requestId.toString()]));
      // Refetch to update counts
      setTimeout(() => refetch(), 2000);
    }
    return success;
  };

  const handleResolve = async (requestId: bigint) => {
    const success = await resolveRequest(requestId);
    if (success) {
      toast({
        title: 'Request resolved!',
        description: 'The request has been finalized.',
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
            <p className="text-roots-gray mb-4">Connect your wallet to view governance</p>
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

  const now = Date.now() / 1000;

  // Separate open vs voted requests
  const openRequests = requests.filter(
    (r) => !votedRequestIds.has(r.id.toString()) && now < Number(r.votingEndsAt)
  );
  const votedRequests = requests.filter(
    (r) => votedRequestIds.has(r.id.toString()) && !r.resolved
  );

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Government Requests</h1>
            <p className="text-roots-gray">
              Review and vote on government data access requests
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/ambassador/disputes">
              <Button variant="outline" size="sm">
                View Disputes
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
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏛️</span>
              <div>
                <p className="text-sm font-medium mb-1">About Government Data Requests</p>
                <p className="text-sm text-roots-gray">
                  Government agencies can request access to transaction data for legitimate
                  investigations (e.g., food safety). As an ambassador, you help protect user
                  privacy by voting on whether each request should be approved. Requests need
                  at least <strong>10 votes</strong> and a <strong>5-day</strong> voting period.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Loading */}
        {isLoadingRequests && (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
                  <div className="h-20 bg-gray-200 rounded mb-4" />
                  <div className="flex gap-4">
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Open requests */}
        {!isLoadingRequests && openRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              Pending Your Vote ({openRequests.length})
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {openRequests.map((request) => (
                <RequestCard
                  key={request.id.toString()}
                  request={request}
                  hasVoted={false}
                  onVote={handleVote}
                />
              ))}
            </div>
          </div>
        )}

        {/* Voted requests */}
        {!isLoadingRequests && votedRequests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">
              Awaiting Resolution ({votedRequests.length})
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {votedRequests.map((request) => (
                <RequestCard
                  key={request.id.toString()}
                  request={request}
                  hasVoted={true}
                  showVoteButton={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingRequests && requests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="font-medium mb-2">No active requests</h3>
              <p className="text-sm text-roots-gray mb-4">
                There are currently no government data requests pending.
              </p>
              <Link href="/government/requests">
                <Button variant="outline">View Public Request Log</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* All voted empty state */}
        {!isLoadingRequests && requests.length > 0 && openRequests.length === 0 && (
          <Card className="mb-8">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="font-medium mb-2">You're all caught up!</h3>
              <p className="text-sm text-roots-gray">
                You've voted on all active government requests.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Vote modal */}
        {selectedRequest && (
          <RequestVoteModal
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onVote={handleVoteSubmit}
            isVoting={isVoting}
          />
        )}

        {/* Link to public log */}
        <div className="mt-8 text-center">
          <Link
            href="/government/requests"
            className="text-sm text-roots-primary hover:underline"
          >
            View all requests (public log) →
          </Link>
        </div>
      </div>
    </div>
  );
}
