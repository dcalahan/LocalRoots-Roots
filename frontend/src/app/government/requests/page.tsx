'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGovernmentRequests } from '@/hooks/useGovernmentRequests';
import { RequestCard } from '@/components/government/RequestCard';

type Tab = 'all' | 'active' | 'approved' | 'denied';

export default function GovernmentRequestsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const { requests, isLoading, error, refetch } = useGovernmentRequests();

  const now = Date.now() / 1000;

  // Filter requests by tab
  const filteredRequests = requests.filter((r) => {
    switch (activeTab) {
      case 'active':
        return !r.resolved && now < Number(r.votingEndsAt);
      case 'approved':
        return r.resolved && r.approved;
      case 'denied':
        return r.resolved && !r.approved;
      default:
        return true;
    }
  });

  // Sort by most recent first
  const sortedRequests = [...filteredRequests].sort(
    (a, b) => Number(b.createdAt) - Number(a.createdAt)
  );

  // Tab counts
  const activeCount = requests.filter(
    (r) => !r.resolved && now < Number(r.votingEndsAt)
  ).length;
  const approvedCount = requests.filter((r) => r.resolved && r.approved).length;
  const deniedCount = requests.filter((r) => r.resolved && !r.approved).length;

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/government"
          className="inline-flex items-center gap-1 text-sm text-roots-gray hover:text-roots-primary mb-6"
        >
          ← Back to Government Portal
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold">Public Request Log</h1>
            <p className="text-roots-gray mt-1">
              All government data requests are publicly logged for transparency.
            </p>
          </div>
          <Link href="/government/request">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Submit Request
            </Button>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-roots-primary text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            All ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Active Voting ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'approved'
                ? 'bg-roots-secondary text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveTab('denied')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'denied'
                ? 'bg-red-600 text-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Denied ({deniedCount})
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

        {/* Loading state */}
        {isLoading && (
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
                  <div className="h-16 bg-gray-200 rounded mb-4" />
                  <div className="flex gap-4">
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                    <div className="h-16 bg-gray-200 rounded flex-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Request list */}
        {!isLoading && sortedRequests.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {sortedRequests.map((request) => (
              <RequestCard
                key={request.id.toString()}
                request={request}
                hasVoted={false} // Public view doesn't show vote status
                showVoteButton={false} // Public view doesn't allow voting
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sortedRequests.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              {activeTab === 'all' && (
                <>
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="font-medium mb-2">No requests yet</h3>
                  <p className="text-sm text-roots-gray mb-4">
                    Government data requests will appear here once submitted.
                  </p>
                  <Link href="/government/request">
                    <Button className="bg-roots-primary hover:bg-roots-primary/90">
                      Submit First Request
                    </Button>
                  </Link>
                </>
              )}
              {activeTab === 'active' && (
                <>
                  <div className="text-4xl mb-4">⏳</div>
                  <h3 className="font-medium mb-2">No active voting</h3>
                  <p className="text-sm text-roots-gray">
                    There are no requests currently being voted on.
                  </p>
                </>
              )}
              {activeTab === 'approved' && (
                <>
                  <div className="text-4xl mb-4">✅</div>
                  <h3 className="font-medium mb-2">No approved requests</h3>
                  <p className="text-sm text-roots-gray">
                    Approved requests will appear here.
                  </p>
                </>
              )}
              {activeTab === 'denied' && (
                <>
                  <div className="text-4xl mb-4">❌</div>
                  <h3 className="font-medium mb-2">No denied requests</h3>
                  <p className="text-sm text-roots-gray">
                    Denied requests will appear here.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transparency note */}
        <div className="mt-12 p-4 bg-roots-secondary/5 rounded-lg border border-roots-secondary/20">
          <h3 className="font-medium mb-2 flex items-center gap-2">
            <span>🔍</span>
            Transparency Commitment
          </h3>
          <p className="text-sm text-roots-gray">
            LocalRoots believes in complete transparency around government data requests.
            Every request, vote, and outcome is permanently recorded on the blockchain
            and displayed here for public review. This ensures accountability and protects
            our community from unauthorized surveillance.
          </p>
        </div>
      </div>
    </div>
  );
}
