'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Mock data - in production this would come from the blockchain/API
const MOCK_EARNINGS = {
  totalUsd: 247.50,
  pendingUsd: 35.00,
  rootsBalance: 1250.75,
  transactions: [
    { id: 1, date: '2024-12-20', item: 'Heirloom Tomatoes', quantity: 5, amount: 22.50, rootsEarned: 112.5 },
    { id: 2, date: '2024-12-18', item: 'Fresh Basil', quantity: 3, amount: 15.00, rootsEarned: 75.0 },
    { id: 3, date: '2024-12-15', item: 'Bell Peppers', quantity: 8, amount: 32.00, rootsEarned: 160.0 },
    { id: 4, date: '2024-12-12', item: 'Zucchini', quantity: 4, amount: 18.00, rootsEarned: 90.0 },
  ],
};

export default function EarningsPage() {
  const router = useRouter();
  const [rootsPrice, setRootsPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  // Fetch $ROOTS price (mock for now - would use CoinGecko API in production)
  useEffect(() => {
    const fetchPrice = async () => {
      setPriceLoading(true);
      try {
        // TODO: Replace with actual CoinGecko API call
        // const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=roots-token&vs_currencies=usd');
        // const data = await response.json();
        // setRootsPrice(data['roots-token'].usd);

        // Mock price for now
        await new Promise(resolve => setTimeout(resolve, 500));
        setRootsPrice(0.15); // $0.15 per $ROOTS
      } catch (error) {
        console.error('Failed to fetch ROOTS price:', error);
        setRootsPrice(null);
      } finally {
        setPriceLoading(false);
      }
    };

    fetchPrice();
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const rootsValueUsd = rootsPrice ? MOCK_EARNINGS.rootsBalance * rootsPrice : null;
  const totalValue = MOCK_EARNINGS.totalUsd + (rootsValueUsd || 0);

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/sell')}
              className="text-roots-gray hover:text-roots-primary flex items-center gap-2 mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="font-heading text-3xl font-bold">Your Earnings</h1>
            <p className="text-roots-gray">Track your sales and $ROOTS rewards</p>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* USD Earnings */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">Cash Earnings</p>
                <p className="text-3xl font-heading font-bold text-gray-900">
                  ${MOCK_EARNINGS.totalUsd.toFixed(2)}
                </p>
                {MOCK_EARNINGS.pendingUsd > 0 && (
                  <p className="text-sm text-roots-secondary mt-1">
                    +${MOCK_EARNINGS.pendingUsd.toFixed(2)} pending
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ROOTS Balance */}
            <Card className="border-roots-primary/20 bg-roots-primary/5">
              <CardContent className="pt-6">
                <p className="text-sm text-roots-gray mb-1">$ROOTS Balance</p>
                <p className="text-3xl font-heading font-bold text-roots-primary">
                  {MOCK_EARNINGS.rootsBalance.toLocaleString()}
                  <span className="text-lg ml-1">$ROOTS</span>
                </p>
                {priceLoading ? (
                  <p className="text-sm text-roots-gray mt-1">Loading price...</p>
                ) : rootsValueUsd ? (
                  <p className="text-sm text-roots-gray mt-1">
                    ≈ ${rootsValueUsd.toFixed(2)} USD
                  </p>
                ) : (
                  <p className="text-sm text-roots-gray mt-1">Price unavailable</p>
                )}
              </CardContent>
            </Card>

            {/* Total Value */}
            <Card className="bg-gray-900 text-white">
              <CardContent className="pt-6">
                <p className="text-sm text-gray-400 mb-1">Total Value</p>
                <p className="text-3xl font-heading font-bold">
                  ${totalValue.toFixed(2)}
                </p>
                {rootsPrice && (
                  <p className="text-sm text-gray-400 mt-1">
                    $ROOTS @ ${rootsPrice.toFixed(4)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ROOTS Info */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="font-heading flex items-center gap-2">
                <div className="w-8 h-8 bg-roots-primary rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">$R</span>
                </div>
                What is $ROOTS?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-roots-gray mb-4">
                $ROOTS is the Local Roots community token. You earn $ROOTS with every sale you make on the platform.
                These tokens can be:
              </p>
              <ul className="space-y-2 text-roots-gray">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Held</strong> - Watch their value grow as the Local Roots community expands</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Traded</strong> - Exchange for other cryptocurrencies or cash out</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-roots-secondary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Used</strong> - Get discounts on purchases from other sellers</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Recent Sales</CardTitle>
              <CardDescription>Your latest transactions</CardDescription>
            </CardHeader>
            <CardContent>
              {MOCK_EARNINGS.transactions.length === 0 ? (
                <div className="text-center py-8 text-roots-gray">
                  <p>No sales yet. Start by adding listings!</p>
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
                        <th className="pb-3 font-medium text-roots-gray text-right">$ROOTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_EARNINGS.transactions.map((tx) => (
                        <tr key={tx.id} className="border-b last:border-0">
                          <td className="py-3 text-sm">{tx.date}</td>
                          <td className="py-3">{tx.item}</td>
                          <td className="py-3 text-right">{tx.quantity}</td>
                          <td className="py-3 text-right font-medium">${tx.amount.toFixed(2)}</td>
                          <td className="py-3 text-right text-roots-primary font-medium">
                            +{tx.rootsEarned.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Out Button */}
          <div className="mt-8 text-center">
            <Button
              size="lg"
              className="bg-roots-primary hover:bg-roots-primary/90"
              onClick={() => {
                // TODO: Implement cash out flow
                alert('Cash out feature coming soon! This will allow you to transfer earnings to your bank account.');
              }}
            >
              Cash Out Earnings
            </Button>
            <p className="text-sm text-roots-gray mt-2">
              Transfer your earnings to your bank account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
