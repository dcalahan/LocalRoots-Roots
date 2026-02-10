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
import type { Address } from 'viem';

export default function FindGardenersGuidePage() {
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
            <span>🌾</span> Find Local Gardeners
          </h1>
          <p className="text-roots-gray">
            Your complete guide to recruiting growers — whether you're local or remote.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <Card className="mb-8 border-2 border-roots-primary bg-roots-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Button
                onClick={() => setShareCardData({
                  type: 'recruit-sellers',
                  ambassadorName: profile?.name || '',
                  ambassadorId: ambassadorId?.toString() || '',
                })}
                className="bg-roots-primary hover:bg-roots-primary/90"
              >
                Share Recruitment Card
              </Button>
              <Button variant="outline" onClick={handleCopyLink}>
                Copy My Referral Link
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PART 1: THE MESSAGE */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-roots-primary mb-4 flex items-center gap-2">
            <span className="bg-roots-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
            The Message You're Spreading
          </h2>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Why This Matters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-roots-gray">
              <p>What happens when supply chains break? What happens when grocery stores can't stock shelves?</p>
              <p><strong className="text-gray-900">Communities that grow their own food thrive.</strong></p>
              <p>Local food production is community resilience. We're building something that matters — a network of neighbors who can feed each other.</p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">The LocalRoots Vision</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-roots-gray">
                <li className="flex items-start gap-2">
                  <span className="text-roots-secondary">✓</span>
                  More neighbors growing food
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-secondary">✓</span>
                  More neighbors sharing with each other
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-secondary">✓</span>
                  Local food networks that make communities stronger
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-secondary">✓</span>
                  Less dependence on fragile supply chains
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-secondary">✓</span>
                  A community that can feed itself
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-roots-secondary bg-roots-secondary/5">
            <CardHeader>
              <CardTitle className="text-lg">Your Message</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-roots-gray mb-3">
                When you talk to people, you're not selling an app — you're sharing a vision:
              </p>
              <div className="space-y-2">
                <div className="p-3 bg-white rounded-lg border-l-4 border-roots-secondary">
                  "I want our community to be able to feed itself."
                </div>
                <div className="p-3 bg-white rounded-lg border-l-4 border-roots-secondary">
                  "When more people grow food, we all become more resilient."
                </div>
                <div className="p-3 bg-white rounded-lg border-l-4 border-roots-secondary">
                  "This isn't about money — it's about building something that matters."
                </div>
                <div className="p-3 bg-white rounded-lg border-l-4 border-roots-secondary">
                  "Start small — even a few tomato plants makes a difference."
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* PART 2: INSPIRE NEW GROWERS */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-roots-secondary mb-4 flex items-center gap-2">
            <span className="bg-roots-secondary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
            Inspire New Growers
          </h2>
          <p className="text-sm text-roots-gray mb-4 italic">The biggest impact — help people start growing!</p>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Who Could Start Growing?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-roots-gray">
                <li className="flex items-start gap-2">
                  <span>🏡</span>
                  People with sunny yards who don't garden yet
                </li>
                <li className="flex items-start gap-2">
                  <span>🌿</span>
                  Renters with balcony space for containers
                </li>
                <li className="flex items-start gap-2">
                  <span>🌍</span>
                  Anyone interested in sustainability or self-sufficiency
                </li>
                <li className="flex items-start gap-2">
                  <span>💭</span>
                  People who say "I wish I could grow my own food"
                </li>
              </ul>
              <p className="mt-4 text-sm font-medium text-roots-primary">
                Your vision will inspire them to start.
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-lg">The Inspiration Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-white rounded-lg">
                  <strong>"You have a yard — you could grow food for the neighborhood."</strong>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <strong>"Container gardens can produce a lot — start with herbs."</strong>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <strong>"Imagine if 10% of our neighborhood grew something."</strong>
                </div>
                <div className="p-3 bg-white rounded-lg">
                  <strong>"LocalRoots makes it easy to share what you grow."</strong>
                </div>
              </div>
              <p className="mt-4 text-sm text-amber-800">
                Show them what's possible. Your enthusiasm is contagious.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* PART 3: CONNECT EXISTING GARDENERS */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-green-700 mb-4 flex items-center gap-2">
            <span className="bg-green-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
            Connect Existing Gardeners
          </h2>
          <p className="text-sm text-roots-gray mb-4 italic">Easier wins — people already growing!</p>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Find People Already Growing</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-roots-gray">
                <li className="flex items-start gap-2">
                  <span>👋</span>
                  Who do you know that gardens?
                </li>
                <li className="flex items-start gap-2">
                  <span>🌻</span>
                  Community garden members
                </li>
                <li className="flex items-start gap-2">
                  <span>📱</span>
                  "Extra produce" posts on NextDoor
                </li>
                <li className="flex items-start gap-2">
                  <span>👥</span>
                  Local gardening Facebook groups
                </li>
                <li className="flex items-start gap-2">
                  <span>🥕</span>
                  Farmers market growers
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-lg">Their Extra Produce Has Value</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-roots-gray">
              <p>Most gardeners <strong>give away or throw away</strong> their extras.</p>
              <p>LocalRoots turns that into <strong>income AND community connection</strong>.</p>
              <p>Every sale strengthens the local food network.</p>
              <p className="font-medium text-green-800">They're already growing — just help them share it.</p>
            </CardContent>
          </Card>
        </div>

        {/* PART 4: HOW TO REACH PEOPLE */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-purple-700 mb-4 flex items-center gap-2">
            <span className="bg-purple-700 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">4</span>
            How to Reach People
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Local Channels</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-roots-gray space-y-1">
                <p>• NextDoor / neighborhood apps</p>
                <p>• Local Facebook groups</p>
                <p>• Community garden bulletin boards</p>
                <p>• Gardening clubs and meetups</p>
                <p>• Word of mouth</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Remote Recruiting</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-roots-gray space-y-1">
                <p>• Leverage local contacts for intros</p>
                <p>• Video calls to demo signup</p>
                <p>• Share your referral link</p>
                <p>• Provide remote tech support</p>
                <p>• Follow up after they register</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Starting Fresh</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-roots-gray space-y-1">
                <p>• Find community gardens online</p>
                <p>• Join local gardening groups</p>
                <p>• Build relationships first</p>
                <p>• Lead with the vision</p>
                <p>• Be patient — trust takes time</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <Card className="border-2 border-roots-primary bg-roots-primary/5">
          <CardContent className="py-6 text-center">
            <h3 className="text-lg font-bold mb-3">Ready to Start Recruiting?</h3>
            <div className="flex flex-wrap gap-3 items-center justify-center">
              <Button
                onClick={() => setShareCardData({
                  type: 'recruit-sellers',
                  ambassadorName: profile?.name || '',
                  ambassadorId: ambassadorId?.toString() || '',
                })}
                className="bg-roots-primary hover:bg-roots-primary/90"
              >
                Share Recruitment Card
              </Button>
              <Button variant="outline" onClick={handleCopyLink}>
                Copy Referral Link
              </Button>
              <Link href="/ambassador/guide/help-register">
                <Button variant="outline">
                  Next: Help Them Register →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link href="/ambassador/dashboard" className="text-roots-primary hover:underline text-sm">
            ← Back to Dashboard
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
