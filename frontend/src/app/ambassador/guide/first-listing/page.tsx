'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';

export default function FirstListingGuidePage() {
  const router = useRouter();
  const { authenticated: isConnected } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const { isAmbassador, isLoading } = useAmbassadorStatus();

  // Redirect if not an ambassador
  if (!isLoading && isConnected && !isAmbassador) {
    router.push('/ambassador');
    return null;
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6">
            <div className="text-4xl mb-4">🔗</div>
            <p className="text-roots-gray mb-4">Log in to view this guide</p>
            <Link href="/ambassador">
              <Button className="bg-roots-primary hover:bg-roots-primary/90">
                Go to Ambassador Portal
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/ambassador/dashboard" className="text-roots-primary hover:underline text-sm">
            ← Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2 mb-2">
            <span>📸</span> First Listing Support
          </h1>
          <p className="text-roots-gray">
            Help your farmers create listings that sell.
          </p>
        </div>

        {/* Creating a Listing */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Creating a Great Listing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Choose what to sell</h4>
                  <p className="text-sm text-roots-gray">Pick from the produce list or add custom items. Start with what they have the most of.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Take a good photo</h4>
                  <p className="text-sm text-roots-gray">Real photos of their actual produce. This is the most important step!</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Set a fair price</h4>
                  <p className="text-sm text-roots-gray">Usually less than grocery stores, competitive with farmers markets.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium">Set quantity available</h4>
                  <p className="text-sm text-roots-gray">How many bunches, pounds, or items? They can always add more later.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-primary text-white rounded-full flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium">Submit!</h4>
                  <p className="text-sm text-roots-gray">Listing goes live immediately. Neighbors can start buying.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Tips */}
        <Card className="mb-6 border-2 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>📷</span> Photo Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 text-sm">
                <h4 className="font-medium text-green-700">Do:</h4>
                <ul className="space-y-1 text-roots-gray">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    Use natural lighting (outdoors or near window)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    Clean background (counter, cutting board, basket)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    Show the actual produce they're selling
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    Multiple items look abundant and fresh
                  </li>
                </ul>
              </div>
              <div className="space-y-2 text-sm">
                <h4 className="font-medium text-red-700">Don't:</h4>
                <ul className="space-y-1 text-roots-gray">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    Use stock photos (buyers want real produce)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    Dark or blurry images
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    Cluttered backgrounds
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">✗</span>
                    Photos of wilted or damaged produce
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Guidance */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>💰</span> Pricing Guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-roots-gray">
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-1">Check local farmers market prices</h4>
              <p>This is your best benchmark. LocalRoots prices should be competitive.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-1">Start slightly below grocery store</h4>
              <p>Buyers expect a deal for buying local. Homegrown quality at better prices.</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-1">Can always adjust later</h4>
              <p>If it sells too fast, raise the price. If it doesn't sell, lower it. Easy to change.</p>
            </div>
          </CardContent>
        </Card>

        {/* After the Listing */}
        <Card className="mb-6 border-2 border-roots-secondary bg-roots-secondary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🎉</span> After the Listing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-roots-gray">
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary font-bold">1.</span>
                <strong>Help them share it</strong> — use the share card feature from their seller dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary font-bold">2.</span>
                <strong>Check back in a few days</strong> — see if they have questions or issues
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary font-bold">3.</span>
                <strong>Celebrate their first sale!</strong> — this is a huge milestone
              </li>
              <li className="flex items-start gap-2">
                <span className="text-roots-secondary font-bold">4.</span>
                <strong>Encourage more listings</strong> — variety attracts more buyers
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Pro Tips */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>⭐</span> Pro Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-roots-gray">
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                Seasonal produce sells best — tomatoes in summer, squash in fall
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                Unique items stand out — heirloom varieties, exotic herbs, edible flowers
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                Bundle items together — "salad mix" or "stir-fry veggies" can be convenient
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                Fresh eggs are always popular if they have chickens
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="py-6 text-center">
            <h3 className="text-lg font-bold mb-3">You're Ready!</h3>
            <p className="text-sm text-roots-gray mb-4">
              You now have everything you need to help farmers succeed on LocalRoots.
            </p>
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Link href="/ambassador/dashboard">
                <Button className="bg-roots-primary hover:bg-roots-primary/90">
                  Back to Dashboard
                </Button>
              </Link>
              <Link href="/ambassador/guide/find-gardeners">
                <Button variant="outline">
                  ← Start Over: Find Gardeners
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-8 flex justify-between text-sm">
          <Link href="/ambassador/guide/help-register" className="text-roots-primary hover:underline">
            ← Help Register
          </Link>
          <Link href="/ambassador/dashboard" className="text-roots-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
