'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parseAbiItem } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MARKETPLACE_ADDRESS } from '@/lib/contracts/marketplace';
import { publicClient } from '@/lib/viemClient';

// Admin wallet addresses (configure these)
const ADMIN_ADDRESSES = [
  '0x40b98F81f19eF4e64633D791F24C886Ce8dcF99c', // Founder wallet
];

interface ActivityEvent {
  type: 'seller_registered' | 'listing_created' | 'order_placed' | 'order_status' | 'funds_released';
  timestamp: Date;
  blockNumber: bigint;
  txHash: string;
  details: Record<string, string | number>;
}

type Tab = 'activity' | 'sellers' | 'orders' | 'disputes' | 'settings';

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSellers: 0,
    totalListings: 0,
    totalOrders: 0,
    activeDisputes: 0,
  });

  // Check if user is admin
  const isAdmin = isConnected && address && ADMIN_ADDRESSES.map(a => a.toLowerCase()).includes(address.toLowerCase());

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchStats() {
      try {
        // Fetch contract stats
        const [nextSellerId, nextListingId, nextOrderId] = await Promise.all([
          publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: [{ type: 'function', name: 'nextSellerId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'nextSellerId',
          }),
          publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: [{ type: 'function', name: 'nextListingId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'nextListingId',
          }),
          publicClient.readContract({
            address: MARKETPLACE_ADDRESS,
            abi: [{ type: 'function', name: 'nextOrderId', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'nextOrderId',
          }),
        ]);

        setStats({
          totalSellers: Number(nextSellerId) - 1,
          totalListings: Number(nextListingId) - 1,
          totalOrders: Number(nextOrderId) - 1,
          activeDisputes: 0, // TODO: Count disputed orders
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    }

    async function fetchRecentActivity() {
      setIsLoading(true);
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock - 10000n; // Last ~10000 blocks

        // Fetch recent events
        const [sellerEvents, listingEvents, orderEvents] = await Promise.all([
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: parseAbiItem('event SellerRegistered(uint256 indexed sellerId, address indexed owner, bytes8 geohash)'),
            fromBlock,
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: parseAbiItem('event ListingCreated(uint256 indexed listingId, uint256 indexed sellerId, uint256 pricePerUnit)'),
            fromBlock,
          }),
          publicClient.getLogs({
            address: MARKETPLACE_ADDRESS,
            event: parseAbiItem('event OrderPlaced(uint256 indexed orderId, uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPrice)'),
            fromBlock,
          }),
        ]);

        const events: ActivityEvent[] = [];

        for (const log of sellerEvents) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          events.push({
            type: 'seller_registered',
            timestamp: new Date(Number(block.timestamp) * 1000),
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            details: {
              sellerId: Number(log.args.sellerId),
              owner: log.args.owner?.slice(0, 10) + '...',
            },
          });
        }

        for (const log of listingEvents) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          events.push({
            type: 'listing_created',
            timestamp: new Date(Number(block.timestamp) * 1000),
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            details: {
              listingId: Number(log.args.listingId),
              sellerId: Number(log.args.sellerId),
            },
          });
        }

        for (const log of orderEvents) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
          events.push({
            type: 'order_placed',
            timestamp: new Date(Number(block.timestamp) * 1000),
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            details: {
              orderId: Number(log.args.orderId),
              listingId: Number(log.args.listingId),
              quantity: Number(log.args.quantity),
            },
          });
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setActivities(events.slice(0, 50)); // Last 50 events
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
    fetchRecentActivity();

    // TODO: Set up real-time event listeners with websockets
  }, [isAdmin]);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <p className="text-roots-gray">Please connect your wallet to access the admin dashboard.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
        <p className="text-roots-gray">Your wallet does not have admin access.</p>
        <p className="text-sm text-gray-400 mt-2">Connected: {address?.slice(0, 10)}...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold">Admin Dashboard</h1>
          <p className="text-roots-gray">Monitor and manage LocalRoots marketplace</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-roots-gray">Live on Base Sepolia</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Total Sellers</p>
            <p className="text-3xl font-heading font-bold">{stats.totalSellers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Total Listings</p>
            <p className="text-3xl font-heading font-bold">{stats.totalListings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Total Orders</p>
            <p className="text-3xl font-heading font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card className={stats.activeDisputes > 0 ? 'border-red-500 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <p className="text-sm text-roots-gray mb-1">Active Disputes</p>
            <p className={`text-3xl font-heading font-bold ${stats.activeDisputes > 0 ? 'text-red-600' : ''}`}>
              {stats.activeDisputes}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto">
        {(['activity', 'sellers', 'orders', 'disputes', 'settings'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-colors capitalize whitespace-nowrap ${
              activeTab === tab
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            {tab === 'activity' ? 'Live Activity' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <Card>
        <CardContent className="pt-6">
          {activeTab === 'activity' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-heading text-xl font-bold">Recent Activity</h2>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>
              {isLoading ? (
                <div className="text-center py-12 text-roots-gray">Loading activity...</div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-roots-gray">No recent activity</div>
              ) : (
                <div className="space-y-3">
                  {activities.map((event, i) => (
                    <div
                      key={`${event.txHash}-${i}`}
                      className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        event.type === 'seller_registered' ? 'bg-blue-100' :
                        event.type === 'listing_created' ? 'bg-green-100' :
                        event.type === 'order_placed' ? 'bg-purple-100' :
                        'bg-gray-100'
                      }`}>
                        {event.type === 'seller_registered' && '👤'}
                        {event.type === 'listing_created' && '🌱'}
                        {event.type === 'order_placed' && '🛒'}
                        {event.type === 'order_status' && '📦'}
                        {event.type === 'funds_released' && '💰'}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {event.type === 'seller_registered' && `New seller registered (#${event.details.sellerId})`}
                          {event.type === 'listing_created' && `New listing created (#${event.details.listingId})`}
                          {event.type === 'order_placed' && `Order placed (#${event.details.orderId})`}
                        </p>
                        <p className="text-sm text-roots-gray">
                          {event.timestamp.toLocaleString()} · Block {event.blockNumber.toString()}
                        </p>
                      </div>
                      <a
                        href={`https://sepolia.basescan.org/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-roots-primary hover:underline"
                      >
                        View Tx
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'sellers' && (
            <div className="text-center py-12 text-roots-gray">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-semibold mb-2">Seller Management</h3>
              <p>View all registered sellers, their listings, and performance metrics.</p>
              <p className="text-sm mt-4">Coming soon...</p>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="text-center py-12 text-roots-gray">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="font-semibold mb-2">Order Monitoring</h3>
              <p>View all orders, their status, and escrow state.</p>
              <p className="text-sm mt-4">Coming soon...</p>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="text-center py-12 text-roots-gray">
              <div className="text-4xl mb-4">⚖️</div>
              <h3 className="font-semibold mb-2">Dispute Resolution</h3>
              <p>Review and resolve disputes between buyers and sellers.</p>
              <p className="text-sm mt-4">Coming soon...</p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="text-center py-12 text-roots-gray">
              <div className="text-4xl mb-4">⚙️</div>
              <h3 className="font-semibold mb-2">Admin Settings</h3>
              <p>Configure marketplace parameters and admin access.</p>
              <p className="text-sm mt-4">Coming soon...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Real-time indicator */}
      <div className="mt-8 text-center text-sm text-roots-gray">
        <p>Real-time event streaming coming soon. Currently refreshes on page load.</p>
        <p className="mt-1">Contract: <a href={`https://sepolia.basescan.org/address/${MARKETPLACE_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-roots-primary hover:underline">{MARKETPLACE_ADDRESS}</a></p>
      </div>
    </div>
  );
}
