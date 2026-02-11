'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSellerOrders, OrderStatus } from '@/hooks/useSellerOrders';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { rootsToFiat, formatFiat, formatRoots } from '@/lib/pricing';
import Link from 'next/link';

export default function EarningsPage() {
  const router = useRouter();
  const { isSeller, isLoading: isCheckingSeller } = useSellerStatus();
  const { orders, isLoading: isLoadingOrders } = useSellerOrders();

  // Calculate earnings from real order data
  const completedOrders = orders.filter(o => o.status === OrderStatus.Completed);
  const pendingOrders = orders.filter(o =>
    o.status === OrderStatus.Pending ||
    o.status === OrderStatus.Accepted ||
    o.status === OrderStatus.ReadyForPickup ||
    o.status === OrderStatus.OutForDelivery
  );

  // Total earned (completed orders only)
  const totalEarnedRoots = completedOrders.reduce((sum, o) => {
    return sum + BigInt(o.totalPrice);
  }, BigInt(0));

  // Pending (not yet completed)
  const pendingRoots = pendingOrders.reduce((sum, o) => {
    return sum + BigInt(o.totalPrice);
  }, BigInt(0));

  // Seeds earned = same as ROOTS amount (1:1 during pre-launch)
  const totalSeeds = totalEarnedRoots;

  // Format for display
  const totalUsd = rootsToFiat(totalEarnedRoots);
  const pendingUsd = rootsToFiat(pendingRoots);

  if (isCheckingSeller) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <div className="text-roots-gray">Loading...</div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-heading text-3xl font-bold mb-4">Not Registered</h1>
          <p className="text-roots-gray mb-8">You need to register as a seller first.</p>
          <Link href="/sell/register">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Register as Seller
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/sell/dashboard')}
              className="text-roots-gray hover:text-roots-primary flex items-center gap-2 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="font-heading text-3xl font-bold">Your Earnings</h1>
            <p className="text-roots-gray">Track your sales and Seeds rewards</p>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Cash Earnings */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Total Earned</p>
                <p className="text-3xl font-heading font-bold text-gray-900">
                  {isLoadingOrders ? '...' : formatFiat(totalUsd)}
                </p>
                {pendingRoots > BigInt(0) && (
                  <p className="text-sm text-roots-secondary mt-1">
                    +{formatFiat(pendingUsd)} pending
                  </p>
                )}
                <p className="text-xs text-roots-gray mt-2">
                  From {completedOrders.length} completed sale{completedOrders.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            {/* Seeds Balance */}
            <Card className="border-roots-secondary/20 bg-roots-secondary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Seeds Earned</p>
                <p className="text-3xl font-heading font-bold text-roots-secondary">
                  {isLoadingOrders ? '...' : formatRoots(totalSeeds)}
                  <span className="text-lg ml-1">Seeds</span>
                </p>
                <p className="text-sm text-roots-gray mt-1">
                  Converts to $ROOTS at token launch
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Seeds Info */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <div className="w-8 h-8 bg-roots-secondary rounded-full flex items-center justify-center">
                  <span className="text-white text-lg">🌱</span>
                </div>
                What are Seeds?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-roots-gray mb-4">
                Seeds are loyalty points you earn with every sale. When LocalRoots launches the $ROOTS token,
                your Seeds will convert to real $ROOTS tokens at a fixed rate.
              </p>
              <ul className="space-y-2 text-roots-gray">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Earn automatically</strong> - Seeds are recorded on-chain with every sale</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Early adopter bonus</strong> - Early sellers get more Seeds per dollar earned</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Convert to $ROOTS</strong> - At token launch, claim your $ROOTS airdrop</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Recent Sales</CardTitle>
              <CardDescription>Your completed transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingOrders ? (
                <div className="text-center py-8 text-roots-gray">Loading sales...</div>
              ) : completedOrders.length === 0 ? (
                <div className="text-center py-8 text-roots-gray">
                  <p>No completed sales yet. Start by adding listings!</p>
                  <Button
                    onClick={() => router.push('/sell/listings/new')}
                    className="mt-4 bg-roots-primary"
                  >
                    Add Your First Listing
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium text-roots-gray">Date</th>
                        <th className="pb-3 font-medium text-roots-gray">Item</th>
                        <th className="pb-3 font-medium text-roots-gray text-right">Qty</th>
                        <th className="pb-3 font-medium text-roots-gray text-right">Earned</th>
                        <th className="pb-3 font-medium text-roots-gray text-right">Seeds</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrders
                        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())
                        .slice(0, 20)
                        .map((order) => {
                          const priceRoots = BigInt(order.totalPrice);
                          return (
                            <tr key={order.orderId} className="border-b last:border-0">
                              <td className="py-3 text-sm">
                                {order.completedAt?.toLocaleDateString() || order.createdAt.toLocaleDateString()}
                              </td>
                              <td className="py-3">{order.produceName || 'Unknown'}</td>
                              <td className="py-3 text-right">{order.quantity}</td>
                              <td className="py-3 text-right font-medium">
                                {formatFiat(rootsToFiat(priceRoots))}
                              </td>
                              <td className="py-3 text-right text-roots-secondary font-medium">
                                +{formatRoots(priceRoots)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  {completedOrders.length > 20 && (
                    <p className="text-center text-sm text-roots-gray mt-4">
                      Showing most recent 20 of {completedOrders.length} sales
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Note about payments */}
          <div className="mt-8 text-center text-sm text-roots-gray">
            <p>
              Payments are received directly to your wallet when orders are completed.
            </p>
            <p className="mt-1">
              Seeds are tracked on-chain and will be converted to $ROOTS at token launch.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
