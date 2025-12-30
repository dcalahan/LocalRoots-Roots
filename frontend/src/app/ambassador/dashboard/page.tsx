'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useToast } from '@/hooks/use-toast';
import { formatUnits } from 'viem';

function formatRoots(amount: bigint): string {
  const formatted = formatUnits(amount, 18);
  const num = parseFloat(formatted);
  if (num === 0) return '0';
  if (num < 0.01) return '<0.01';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AmbassadorDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isConnected, address } = useAccount();
  const { isAmbassador, ambassadorId, ambassador, isLoading, refetch } = useAmbassadorStatus();
  const [copied, setCopied] = useState(false);

  // Redirect if not an ambassador
  useEffect(() => {
    if (!isLoading && isConnected && !isAmbassador) {
      router.push('/ambassador');
    }
  }, [isAmbassador, isLoading, isConnected, router]);

  const referralLink = ambassadorId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/ambassador/register?ref=${ambassadorId.toString()}`
    : '';

  const sellerReferralLink = ambassadorId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sell/register?ref=${ambassadorId.toString()}`
    : '';

  const handleCopyReferralLink = async (link: string, type: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: `${type} referral link copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
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
            <p className="text-roots-gray mb-4">Connect your wallet to view your ambassador dashboard</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-64 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Render dashboard
  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              Ambassador Dashboard
            </h1>
            <p className="text-roots-gray">
              Ambassador #{ambassadorId?.toString()}
              {ambassador?.uplineId === 0n && (
                <span className="ml-2 px-2 py-0.5 bg-roots-primary/10 text-roots-primary text-xs rounded-full">
                  State Founder
                </span>
              )}
            </p>
          </div>
          <Link href="/ambassador">
            <Button variant="outline" size="sm">
              Learn More
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-roots-primary">
                {ambassador?.recruitedSellers.toString() || '0'}
              </div>
              <div className="text-sm text-roots-gray">Farmers Recruited</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-roots-secondary">
                {ambassador?.recruitedAmbassadors.toString() || '0'}
              </div>
              <div className="text-sm text-roots-gray">Ambassadors Recruited</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatRoots(ambassador?.totalEarned || 0n)}
              </div>
              <div className="text-sm text-roots-gray">ROOTS Earned</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-amber-600">
                {formatRoots(ambassador?.totalPending || 0n)}
              </div>
              <div className="text-sm text-roots-gray">ROOTS Pending</div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Links */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Farmer Referral Link */}
          <Card className="border-2 border-roots-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">🌱</span> Farmer Referral Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-roots-gray mb-3">
                Share this link with farmers to onboard them. You'll earn 25% of their sales for 1 year!
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sellerReferralLink}
                  readOnly
                  className="flex-1 text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600"
                />
                <Button
                  size="sm"
                  onClick={() => handleCopyReferralLink(sellerReferralLink, 'Farmer')}
                  className="bg-roots-primary hover:bg-roots-primary/90"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Ambassador Referral Link */}
          <Card className="border-2 border-roots-secondary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">👥</span> Ambassador Referral Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-roots-gray mb-3">
                Share this link to recruit more ambassadors. Build your network and multiply your impact!
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 text-xs bg-gray-50 border rounded px-3 py-2 text-gray-600"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyReferralLink(referralLink, 'Ambassador')}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-roots-primary/5 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <span>🌾</span> Find Local Gardeners
                </h4>
                <p className="text-sm text-roots-gray mb-3">
                  Look for neighbors with gardens, or check Nextdoor for "extra produce" posts.
                </p>
                <p className="text-xs text-roots-primary font-medium">
                  Tip: Farmers markets are great places to find growers!
                </p>
              </div>

              <div className="p-4 bg-roots-secondary/5 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <span>📱</span> Help Them Register
                </h4>
                <p className="text-sm text-roots-gray mb-3">
                  Walk them through wallet setup and seller registration. Use your farmer referral link!
                </p>
                <p className="text-xs text-roots-secondary font-medium">
                  Tip: Be patient - many farmers are new to crypto.
                </p>
              </div>

              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <span>📸</span> First Listing Support
                </h4>
                <p className="text-sm text-roots-gray mb-3">
                  Help them create their first listing. Good photos = more sales!
                </p>
                <p className="text-xs text-green-700 font-medium">
                  Tip: Fresh produce photos in natural light work best.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ambassador Info */}
        <div className="mt-8 text-center text-sm text-roots-gray">
          <p>
            Member since {ambassador?.createdAt
              ? new Date(Number(ambassador.createdAt) * 1000).toLocaleDateString()
              : '...'
            }
          </p>
          {ambassador?.suspended && (
            <p className="text-red-600 mt-2">
              Your ambassador status has been suspended. Contact support for assistance.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
