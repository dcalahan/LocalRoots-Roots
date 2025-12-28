'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data - in production this would come from API/blockchain
const MOCK_LISTINGS = [
  { id: 1, name: 'Heirloom Tomatoes', price: 4.50, unit: 'lb', quantity: 12, status: 'active' },
  { id: 2, name: 'Fresh Basil', price: 3.00, unit: 'bunch', quantity: 8, status: 'active' },
  { id: 3, name: 'Bell Peppers', price: 2.00, unit: 'each', quantity: 0, status: 'sold_out' },
];

const MOCK_ORDERS = [
  { id: 101, buyer: 'Sarah M.', items: 'Heirloom Tomatoes (3 lb)', total: 13.50, status: 'pending', date: '2024-12-24' },
  { id: 102, buyer: 'John D.', items: 'Fresh Basil (2 bunches)', total: 6.00, status: 'ready', date: '2024-12-23' },
];

const MOCK_HISTORY = [
  { id: 201, buyer: 'Mike R.', items: 'Bell Peppers (5)', total: 10.00, status: 'completed', date: '2024-12-20' },
  { id: 202, buyer: 'Lisa K.', items: 'Heirloom Tomatoes (2 lb)', total: 9.00, status: 'completed', date: '2024-12-18' },
  { id: 203, buyer: 'Tom B.', items: 'Fresh Basil (1 bunch)', total: 3.00, status: 'completed', date: '2024-12-15' },
];

type Tab = 'listings' | 'orders' | 'history';

export default function SellerDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('listings');

  const pendingOrders = MOCK_ORDERS.filter(o => o.status === 'pending').length;
  const totalEarnings = MOCK_HISTORY.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="font-heading text-3xl font-bold">Seller Dashboard</h1>
            <p className="text-roots-gray">Manage your garden store</p>
          </div>
          <Link href="/sell/listings/new">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              + Add Listing
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Active Listings</p>
              <p className="text-2xl font-heading font-bold">
                {MOCK_LISTINGS.filter(l => l.status === 'active').length}
              </p>
            </CardContent>
          </Card>
          <Card className={pendingOrders > 0 ? 'border-roots-secondary bg-roots-secondary/5' : ''}>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Pending Orders</p>
              <p className={`text-2xl font-heading font-bold ${pendingOrders > 0 ? 'text-roots-secondary' : ''}`}>
                {pendingOrders}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-roots-gray mb-1">Completed Sales</p>
              <p className="text-2xl font-heading font-bold">{MOCK_HISTORY.length}</p>
            </CardContent>
          </Card>
          <Link href="/sell/earnings">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow border-roots-primary/20 bg-roots-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Total Earnings</p>
                <p className="text-2xl font-heading font-bold text-roots-primary">
                  ${totalEarnings.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          <button
            onClick={() => setActiveTab('listings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'listings'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            My Listings
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              activeTab === 'orders'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            Orders
            {pendingOrders > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-roots-secondary text-white text-xs rounded-full flex items-center justify-center">
                {pendingOrders}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-roots-primary border-b-2 border-roots-primary'
                : 'text-roots-gray hover:text-gray-900'
            }`}
          >
            History
          </button>
        </div>

        {/* Tab Content */}
        <Card>
          <CardContent className="pt-6">
            {activeTab === 'listings' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-heading text-xl font-bold">Your Listings</h2>
                </div>
                {MOCK_LISTINGS.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p className="mb-4">You haven&apos;t added any listings yet.</p>
                    <Link href="/sell/listings/new">
                      <Button className="bg-roots-primary">Add Your First Listing</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {MOCK_LISTINGS.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-roots-primary/10 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-roots-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium">{listing.name}</p>
                            <p className="text-sm text-roots-gray">
                              ${listing.price.toFixed(2)} / {listing.unit} • {listing.quantity} available
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            listing.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {listing.status === 'active' ? 'Active' : 'Sold Out'}
                          </span>
                          <Button variant="outline" size="sm">Edit</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'orders' && (
              <>
                <h2 className="font-heading text-xl font-bold mb-4">Pending Orders</h2>
                {MOCK_ORDERS.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p>No pending orders right now.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {MOCK_ORDERS.map((order) => (
                      <div
                        key={order.id}
                        className={`p-4 rounded-lg border-2 ${
                          order.status === 'pending'
                            ? 'border-roots-secondary bg-roots-secondary/5'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{order.buyer}</p>
                            <p className="text-sm text-roots-gray">{order.items}</p>
                          </div>
                          <p className="font-bold">${order.total.toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-roots-gray">{order.date}</span>
                          <div className="flex gap-2">
                            {order.status === 'pending' ? (
                              <>
                                <Button size="sm" variant="outline">Message</Button>
                                <Button size="sm" className="bg-roots-secondary hover:bg-roots-secondary/90">
                                  Mark Ready
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" className="bg-roots-primary hover:bg-roots-primary/90">
                                Complete Handoff
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <>
                <h2 className="font-heading text-xl font-bold mb-4">Sales History</h2>
                {MOCK_HISTORY.length === 0 ? (
                  <div className="text-center py-12 text-roots-gray">
                    <p>No completed sales yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-3 font-medium text-roots-gray">Date</th>
                          <th className="pb-3 font-medium text-roots-gray">Buyer</th>
                          <th className="pb-3 font-medium text-roots-gray">Items</th>
                          <th className="pb-3 font-medium text-roots-gray text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MOCK_HISTORY.map((sale) => (
                          <tr key={sale.id} className="border-b last:border-0">
                            <td className="py-3 text-sm">{sale.date}</td>
                            <td className="py-3">{sale.buyer}</td>
                            <td className="py-3 text-roots-gray">{sale.items}</td>
                            <td className="py-3 text-right font-medium">${sale.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
