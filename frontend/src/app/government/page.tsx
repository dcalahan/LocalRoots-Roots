'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function GovernmentPage() {
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Hero */}
      <div className="bg-roots-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-heading font-bold mb-4">
            LocalRoots for Government Agencies
          </h1>
          <p className="text-xl text-white/90">
            Supporting food safety through transparent, community-governed data requests
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Food Safety Section */}
        <Card className="mb-8 border-2 border-roots-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <span className="text-3xl">🥬</span>
              Food Safety Traceability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-roots-gray">
              LocalRoots supports food safety by enabling rapid identification of buyers
              who may have purchased affected produce. Our blockchain-based marketplace
              creates an immutable record of all transactions, allowing for precise
              traceability when needed.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div className="bg-roots-cream rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-roots-secondary">✓</span>
                  What We Can Provide
                </h3>
                <ul className="space-y-2 text-sm text-roots-gray">
                  <li>• Order records (dates, quantities, seller info)</li>
                  <li>• Wallet addresses of affected buyers</li>
                  <li>• Transaction history for specific products/sellers</li>
                  <li>• Seller registration details</li>
                </ul>
              </div>

              <div className="bg-gray-100 rounded-lg p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <span className="text-red-500">✗</span>
                  What We Cannot Provide
                </h3>
                <ul className="space-y-2 text-sm text-roots-gray">
                  <li>• Personal information (names, phones, addresses)</li>
                  <li>• Payment card details</li>
                  <li>• Private messages between users</li>
                </ul>
                <p className="text-xs text-roots-gray mt-3 italic">
                  User PII is encrypted and controlled by users themselves.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl">How Our Process Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">1</span>
                </div>
                <h3 className="font-medium mb-2">Submit Request</h3>
                <p className="text-sm text-roots-gray">
                  Provide agency credentials, jurisdiction, and justification for the
                  data request.
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">2</span>
                </div>
                <h3 className="font-medium mb-2">Community Review</h3>
                <p className="text-sm text-roots-gray">
                  Our ambassador community votes on the legitimacy of each request
                  (5-day voting period).
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-roots-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">3</span>
                </div>
                <h3 className="font-medium mb-2">Data Access</h3>
                <p className="text-sm text-roots-gray">
                  If approved, we generate and provide the requested transaction data
                  export.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Why Community Governance */}
        <Card className="mb-8 bg-roots-secondary/5 border-roots-secondary/20">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <span>⚖️</span>
              Why Community Governance?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-roots-gray mb-4">
              LocalRoots is built on the principle of community sovereignty. Rather than
              giving a single administrator the power to share user data, all data requests
              must be approved by our network of verified ambassadors.
            </p>
            <ul className="space-y-2 text-sm text-roots-gray">
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary">✓</span>
                <span>Prevents unauthorized or frivolous data requests</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary">✓</span>
                <span>Creates public transparency around all government inquiries</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary">✓</span>
                <span>Protects user privacy while supporting legitimate investigations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary">✓</span>
                <span>All requests and votes are recorded on the blockchain</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/government/request">
            <Button size="lg" className="bg-roots-primary hover:bg-roots-primary/90 w-full sm:w-auto">
              Submit a Request
            </Button>
          </Link>
          <Link href="/government/requests">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              View Request History
            </Button>
          </Link>
        </div>

        {/* Public Log Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Requests</CardTitle>
              <Link
                href="/government/requests"
                className="text-sm text-roots-primary hover:underline"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-roots-gray">
              <p className="text-4xl mb-3">📋</p>
              <p>No government data requests have been submitted yet.</p>
              <p className="text-sm mt-2">
                All requests will be publicly logged here for transparency.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="mt-12 text-center text-sm text-roots-gray">
          <p>
            Questions about the data request process?{' '}
            <a href="mailto:government@localroots.love" className="text-roots-primary hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
