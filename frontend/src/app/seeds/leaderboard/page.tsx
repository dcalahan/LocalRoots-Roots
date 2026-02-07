'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { useSeedsLeaderboard, useGlobalSeedsStats, useSeeds, formatSeeds } from '@/hooks/useSeeds';

// Mock data for when subgraph is not deployed
const MOCK_LEADERBOARD = [
  { id: '0x1234...5678', user: '0x1234567890abcdef1234567890abcdef12345678', total: '125000000000', sales: '100000000000', purchases: '5000000000', referrals: '15000000000', milestones: '5000000000', recruitments: '0', lastUpdated: '0', eventCount: '45' },
  { id: '0x2345...6789', user: '0x2345678901abcdef2345678901abcdef23456789', total: '98000000000', sales: '80000000000', purchases: '8000000000', referrals: '10000000000', milestones: '0', recruitments: '0', lastUpdated: '0', eventCount: '32' },
  { id: '0x3456...7890', user: '0x3456789012abcdef3456789012abcdef34567890', total: '75000000000', sales: '60000000000', purchases: '10000000000', referrals: '5000000000', milestones: '0', recruitments: '0', lastUpdated: '0', eventCount: '28' },
  { id: '0x4567...8901', user: '0x4567890123abcdef4567890123abcdef45678901', total: '52000000000', sales: '45000000000', purchases: '2000000000', referrals: '5000000000', milestones: '0', recruitments: '0', lastUpdated: '0', eventCount: '19' },
  { id: '0x5678...9012', user: '0x5678901234abcdef5678901234abcdef56789012', total: '41000000000', sales: '30000000000', purchases: '6000000000', referrals: '5000000000', milestones: '0', recruitments: '0', lastUpdated: '0', eventCount: '15' },
];

const MOCK_STATS = {
  totalSeeds: '891000000000',
  totalSeedsFromPurchases: '156000000000',
  totalSeedsFromSales: '580000000000',
  totalSeedsFromReferrals: '120000000000',
  totalSeedsFromMilestones: '35000000000',
  totalSeedsFromRecruitments: '0',
  uniqueEarners: '147',
};

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getRankBadge(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function getRankStyle(rank: number): string {
  if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (rank === 2) return 'bg-gray-100 text-gray-700 border-gray-300';
  if (rank === 3) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-gray-50 text-gray-600 border-gray-200';
}

export default function SeedsLeaderboardPage() {
  const { address } = useAccount();
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Use real data if subgraph is deployed, otherwise use mock
  const { data: leaderboard, isLoading: leaderboardLoading } = useSeedsLeaderboard(pageSize, page * pageSize);
  const { data: globalStats, isLoading: statsLoading } = useGlobalSeedsStats();
  const { data: userSeeds } = useSeeds(address);

  // Determine if we're using mock data
  const isSubgraphAvailable = process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  const displayLeaderboard = isSubgraphAvailable && leaderboard?.length ? leaderboard : MOCK_LEADERBOARD;
  const displayStats = isSubgraphAvailable && globalStats ? globalStats : MOCK_STATS;
  const isUsingMockData = !isSubgraphAvailable || !leaderboard?.length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🏆</span>
            <h1 className="text-3xl md:text-4xl font-bold">Seeds Leaderboard</h1>
          </div>
          <p className="text-amber-100 max-w-2xl">
            Track the top Seeds earners in the Local Roots community. This is preview mode — Seeds earned now are for testing only and won't carry over to mainnet launch.
          </p>
          {isUsingMockData && (
            <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-sm bg-amber-600/50 border border-amber-400">
              Preview Mode - Showing sample data
            </div>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Global Stats */}
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-roots-primary">{formatSeeds(displayStats.totalSeeds)}</div>
              <div className="text-sm text-gray-500">Total Seeds Earned</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{displayStats.uniqueEarners}</div>
              <div className="text-sm text-gray-500">Unique Earners</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{formatSeeds(displayStats.totalSeedsFromSales)}</div>
              <div className="text-sm text-gray-500">From Sales</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{formatSeeds(displayStats.totalSeedsFromReferrals)}</div>
              <div className="text-sm text-gray-500">From Referrals</div>
            </div>
          </div>
        </section>

        {/* User's Position */}
        {address && (
          <section className="mb-8">
            <div className="bg-gradient-to-r from-roots-primary/10 to-roots-secondary/10 rounded-xl p-6 border border-roots-primary/20">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Your Seeds Balance</div>
                  <div className="text-3xl font-bold text-roots-primary">
                    {userSeeds ? formatSeeds(userSeeds.total) : '0'}
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold">{userSeeds ? formatSeeds(userSeeds.sales) : '0'}</div>
                    <div className="text-xs text-gray-500">From Sales</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{userSeeds ? formatSeeds(userSeeds.purchases) : '0'}</div>
                    <div className="text-xs text-gray-500">From Purchases</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{userSeeds ? formatSeeds(userSeeds.referrals) : '0'}</div>
                    <div className="text-xs text-gray-500">From Referrals</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Leaderboard Table */}
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Top Earners</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Seeds</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Sales</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Purchases</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Referrals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayLeaderboard.map((entry, index) => {
                  const rank = page * pageSize + index + 1;
                  const isCurrentUser = address && entry.user.toLowerCase() === address.toLowerCase();

                  return (
                    <tr
                      key={entry.id}
                      className={`${isCurrentUser ? 'bg-roots-primary/5' : 'hover:bg-gray-50'} transition-colors`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRankStyle(rank)}`}>
                          {getRankBadge(rank)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {shortenAddress(entry.user)}
                          </span>
                          {isCurrentUser && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-roots-primary text-white">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-semibold text-gray-900">{formatSeeds(entry.total)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 hidden md:table-cell">
                        {formatSeeds(entry.sales)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 hidden md:table-cell">
                        {formatSeeds(entry.purchases)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 hidden lg:table-cell">
                        {formatSeeds(entry.referrals)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isUsingMockData && (
            <div className="px-6 py-4 border-t flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Page {page + 1}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => p + 1)}
                disabled={displayLeaderboard.length < pageSize}
              >
                Next
              </Button>
            </div>
          )}
        </section>

        {/* How to Earn */}
        <section className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">How to Earn Seeds</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🧑‍🌾</div>
              <h3 className="font-medium mb-1">Sell Produce</h3>
              <p className="text-sm text-gray-600">500 Seeds per $1 earned from sales</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🛒</div>
              <h3 className="font-medium mb-1">Buy Local</h3>
              <p className="text-sm text-gray-600">50 Seeds per $1 spent on purchases</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🌟</div>
              <h3 className="font-medium mb-1">Refer Sellers</h3>
              <p className="text-sm text-gray-600">25% of your recruited sellers' sales + 2,500 bonus per activation</p>
            </div>
          </div>

          {/* Preview Mode Note */}
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">🧪</span>
              <span className="font-medium text-amber-800">Preview Mode</span>
            </div>
            <p className="text-sm text-amber-700">
              Seeds earned now are for testing only. When we launch on mainnet, everyone starts fresh —
              that's when early adopters will earn <strong>2x Seeds</strong> for the first 90 days.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-8 text-center">
          <div className="flex justify-center gap-4 flex-wrap">
            <Link href="/sell/register">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Start Selling
              </Button>
            </Link>
            <Link href="/buy">
              <Button variant="outline">
                Browse Produce
              </Button>
            </Link>
            <Link href="/about/tokenomics">
              <Button variant="outline">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-roots-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
