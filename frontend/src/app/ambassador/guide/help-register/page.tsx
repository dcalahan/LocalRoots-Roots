'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorProfile } from '@/hooks/useAmbassadorProfile';
import { ShareCardModal } from '@/components/ShareCardModal';
import { useToast } from '@/hooks/use-toast';
import type { ShareCardData } from '@/lib/shareCards';

export default function HelpRegisterGuidePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { authenticated: isConnected } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const { isAmbassador, ambassadorId, ambassador, isLoading } = useAmbassadorStatus();
  const { profile } = useAmbassadorProfile(ambassador?.profileIpfs);

  const [shareCardData, setShareCardData] = useState<ShareCardData | null>(null);

  const sellerReferralLink = ambassadorId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/sell/register?ref=${ambassadorId.toString()}`
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(sellerReferralLink);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
      });
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive',
      });
    }
  };

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
            <span>📱</span> Help Them Register
          </h1>
          <p className="text-roots-gray">
            A quick reference for walking someone through seller registration.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <Card className="mb-8 border-2 border-roots-secondary bg-roots-secondary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Button variant="outline" onClick={handleCopyLink}>
                Copy Registration Link
              </Button>
              <Button
                onClick={() => setShareCardData({
                  type: 'recruit-sellers',
                  ambassadorName: profile?.name || '',
                  ambassadorId: ambassadorId?.toString() || '',
                })}
                className="bg-roots-secondary hover:bg-roots-secondary/90 text-white"
              >
                Share Registration Card
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step by Step */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Step-by-Step Walkthrough</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-secondary text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Share your referral link</h4>
                  <p className="text-sm text-roots-gray">Send them the link via text, email, or show them on your phone.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-secondary text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">They enter email or phone</h4>
                  <p className="text-sm text-roots-gray">Privy will send them a verification code. Simple as logging into any website.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-secondary text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Wallet is created automatically</h4>
                  <p className="text-sm text-roots-gray">They don't need to understand crypto. A wallet is created behind the scenes.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-secondary text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-medium">Fill in seller profile</h4>
                  <p className="text-sm text-roots-gray">Name, location (or allow location access), optional photo and bio.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-roots-primary text-white rounded-full flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="font-medium">Done! They're registered</h4>
                  <p className="text-sm text-roots-gray">Now they can create their first listing.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mb-6 border-2 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>💡</span> Tips for Success
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-roots-gray">
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <strong>Be patient</strong> — many gardeners are new to apps and technology
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <strong>Sit with them if possible</strong> — in-person help is most effective
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <strong>Use your phone to demonstrate</strong> — show before you tell
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <strong>Explain they never need crypto or ETH</strong> — LocalRoots covers all transaction fees
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-600">•</span>
                <strong>Celebrate small wins</strong> — registration is a milestone!
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Common Issues */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>🔧</span> Common Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-1">Email verification not arriving?</h4>
                <p className="text-sm text-roots-gray">Check spam/junk folder. Gmail users: check "Promotions" tab. Can also use phone number instead.</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-1">Location not detected?</h4>
                <p className="text-sm text-roots-gray">They can type their city/address manually. Browser permissions may need to be enabled.</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-1">"What's a wallet?"</h4>
                <p className="text-sm text-roots-gray">Tell them: "It's like a digital account that LocalRoots creates for you automatically. You don't need to do anything — it just works."</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-1">Page seems stuck?</h4>
                <p className="text-sm text-roots-gray">Try refreshing the page. If that doesn't work, clear browser cache or try a different browser.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        <Card className="border-2 border-roots-secondary bg-roots-secondary/5">
          <CardContent className="py-6 text-center">
            <h3 className="text-lg font-bold mb-3">Share Your Registration Link</h3>
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Button variant="outline" onClick={handleCopyLink}>
                Copy Link
              </Button>
              <Button
                onClick={() => setShareCardData({
                  type: 'recruit-sellers',
                  ambassadorName: profile?.name || '',
                  ambassadorId: ambassadorId?.toString() || '',
                })}
                className="bg-roots-secondary hover:bg-roots-secondary/90 text-white"
              >
                Share Card
              </Button>
              <Link href="/ambassador/guide/first-listing">
                <Button variant="outline">
                  Next: First Listing Support →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="mt-8 flex justify-between text-sm">
          <Link href="/ambassador/guide/find-gardeners" className="text-roots-primary hover:underline">
            ← Find Gardeners
          </Link>
          <Link href="/ambassador/dashboard" className="text-roots-primary hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Share Card Modal */}
      <ShareCardModal
        data={shareCardData}
        onClose={() => setShareCardData(null)}
      />
    </div>
  );
}
