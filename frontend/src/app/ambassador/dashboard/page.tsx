'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/seller/ImageUploader';
import { useAmbassadorStatus } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorProfile } from '@/hooks/useAmbassadorProfile';
import { useUpdateAmbassadorProfile } from '@/hooks/useUpdateAmbassadorProfile';
import { useToast } from '@/hooks/use-toast';
import { useSeeds, formatSeeds as formatSeedsAmount } from '@/hooks/useSeeds';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import { EarlyAdopterBanner } from '@/components/seeds/EarlyAdopterBanner';
import { MultiplierBadge } from '@/components/seeds/MultiplierBadge';
import { AmbassadorTierCard, AmbassadorTierBadge } from '@/components/seeds/AmbassadorTierBadge';
import { getMultiplierInfo, AMBASSADOR_RECRUITMENT_BONUS, AMBASSADOR_COMMISSION_PERCENT } from '@/components/seeds/PhaseConfig';
import { RecruitedFarmersWidget } from '@/components/ambassador/RecruitedFarmersWidget';
import { ShareCardModal } from '@/components/ShareCardModal';
import { useGovernanceStats } from '@/hooks/useGovernanceStats';
import type { ShareCardData } from '@/lib/shareCards';
import { formatUnits, type Address } from 'viem';

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
  const { authenticated: isConnected, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
  const address = (embeddedWallet?.address || user?.wallet?.address) as Address | undefined;
  const { isAmbassador, ambassadorId, ambassador, isLoading, refetch } = useAmbassadorStatus();
  const { profile, isLoading: isLoadingProfile } = useAmbassadorProfile(ambassador?.profileIpfs);
  const { updateProfile, isPending: isUpdatingProfile, error: updateError } = useUpdateAmbassadorProfile();

  // Phase 1: Fetch Seeds data
  const { data: seedsData, isLoading: isSeedsLoading } = useSeeds(address as Address);
  const multiplierInfo = getMultiplierInfo();

  // Governance stats for dashboard
  const {
    totalDisputes,
    openDisputes: openDisputeCount,
    resolvedDisputes,
    qualifiedVoters,
    totalGovRequests,
    activeGovRequests: activeGovRequestCount,
    isLoading: isLoadingGovernance,
  } = useGovernanceStats();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
    // Set a flag to prevent auto-redirect on the landing page
    sessionStorage.setItem('just_logged_out', 'true');
    // Force full page reload
    window.location.href = '/ambassador';
  };

  const [copied, setCopied] = useState(false);
  const [shareCardData, setShareCardData] = useState<ShareCardData | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Pinata upload hook for profile images
  const { uploadFile } = usePinataUpload();

  // Initialize edit form when profile loads
  useEffect(() => {
    if (profile) {
      setEditName(profile.name || '');
      setEditBio(profile.bio || '');
      setEditEmail(profile.email || '');
      setEditImageUrl(profile.imageUrl || '');
    }
  }, [profile]);

  // Show error toast when update fails
  useEffect(() => {
    if (updateError) {
      toast({
        title: 'Update failed',
        description: updateError.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [updateError, toast]);

  // Handle image from ImageUploader (receives data URL)
  const handleImageUpload = async (dataUrl: string | null) => {
    if (!dataUrl) {
      setEditImageUrl('');
      return;
    }

    // If it's already a URL (stock photo or IPFS), use it directly
    if (dataUrl.startsWith('http') || dataUrl.startsWith('/')) {
      setEditImageUrl(dataUrl);
      return;
    }

    // For data URLs, upload to IPFS
    if (dataUrl.startsWith('data:')) {
      setIsUploadingImage(true);
      try {
        // Convert data URL to file
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });

        const result = await uploadFile(file);
        if (result) {
          const imageUrl = `https://gateway.pinata.cloud/ipfs/${result.ipfsHash}`;
          setEditImageUrl(imageUrl);
          toast({
            title: 'Image uploaded!',
            description: 'Your profile picture has been uploaded.',
          });
        }
      } catch (err) {
        console.error('[handleImageUpload] Error:', err);
        toast({
          title: 'Upload failed',
          description: 'Could not upload image. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name',
        variant: 'destructive',
      });
      return;
    }

    console.log('[handleSaveProfile] Saving profile...');
    const success = await updateProfile({
      name: editName.trim(),
      bio: editBio.trim() || undefined,
      email: editEmail.trim() || undefined,
      imageUrl: editImageUrl || undefined,
      createdAt: profile?.createdAt || new Date().toISOString(),
    });

    console.log('[handleSaveProfile] Result:', success);
    if (success) {
      toast({
        title: 'Profile updated!',
        description: 'Your ambassador profile has been saved.',
      });
      setIsEditingProfile(false);
      // Refetch ambassador data to get new profile IPFS hash
      setTimeout(() => refetch(), 2000); // Wait for tx to be indexed
    }
  };

  // Check if user just registered (prevents redirect before data is indexed)
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    const flag = sessionStorage.getItem('just_registered_ambassador');
    if (flag) {
      setJustRegistered(true);
      sessionStorage.removeItem('just_registered_ambassador');
      // Refetch ambassador status after a delay to get the new data
      setTimeout(() => refetch(), 3000);
    }
  }, [refetch]);

  // Auto-show share modal for new ambassadors once data loads
  useEffect(() => {
    if (justRegistered && isAmbassador && ambassadorId) {
      const ambassadorName = profile?.name || '';
      setShareCardData({
        type: 'recruit-sellers',
        ambassadorName,
        ambassadorId: ambassadorId.toString(),
      });
    }
  }, [justRegistered, isAmbassador, ambassadorId, profile?.name]);

  // Redirect if not an ambassador (but not if just registered)
  useEffect(() => {
    if (!isLoading && isConnected && !isAmbassador && !justRegistered) {
      router.push('/ambassador');
    }
    // Clear justRegistered flag once we confirm they're an ambassador
    if (isAmbassador && justRegistered) {
      setJustRegistered(false);
    }
  }, [isAmbassador, isLoading, isConnected, router, justRegistered]);

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

  // Loading (show welcome message if just registered)
  if (isLoading || (justRegistered && !isAmbassador)) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {justRegistered ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎉</div>
              <h1 className="text-2xl font-bold mb-2">Welcome, Ambassador!</h1>
              <p className="text-roots-gray mb-4">Setting up your dashboard...</p>
              <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-32 bg-gray-200 rounded" />
              <div className="h-64 bg-gray-200 rounded" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render dashboard
  return (
    <div className="min-h-screen bg-roots-cream">
      {/* Early Adopter Banner */}
      <EarlyAdopterBanner />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
              Ambassador Dashboard
              <AmbassadorTierBadge
                recruitedSellers={Number(ambassador?.recruitedSellers || 0n)}
                size="sm"
              />
            </h1>
            <p className="text-roots-gray">
              Ambassador #{ambassadorId?.toString()}
              {ambassador?.uplineId === 0n && (
                <span className="ml-2 px-2 py-0.5 bg-roots-primary/10 text-roots-primary text-xs rounded-full">
                  Independent Ambassador
                </span>
              )}
            </p>
            {user?.wallet?.address && (
              <p className="text-xs text-roots-gray mt-1">
                Wallet: {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/ambassador">
              <Button variant="outline" size="sm">
                Learn More
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Log Out
            </Button>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="mb-8">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>👤</span> Your Profile
              </CardTitle>
              {!isEditingProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingProfile ? (
              <div className="space-y-4">
                {/* Profile Picture */}
                <div className="space-y-2">
                  <ImageUploader
                    label="Profile Picture (optional)"
                    onUpload={handleImageUpload}
                    currentHash={editImageUrl}
                    accept="image/*"
                    maxSizeMB={5}
                  />
                  {isUploadingImage && (
                    <p className="text-sm text-roots-gray">Uploading to IPFS...</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Your name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Input
                    id="bio"
                    type="text"
                    placeholder="Tell people about yourself"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <p className="text-xs text-roots-gray">For Local Roots updates only</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isUpdatingProfile || isUploadingImage || !editName.trim()}
                    className="bg-roots-primary hover:bg-roots-primary/90"
                  >
                    {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      // Reset to current values
                      setEditName(profile?.name || '');
                      setEditBio(profile?.bio || '');
                      setEditEmail(profile?.email || '');
                      setEditImageUrl(profile?.imageUrl || '');
                    }}
                    disabled={isUpdatingProfile}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : isLoadingProfile ? (
              <div className="animate-pulse space-y-2">
                <div className="h-5 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ) : profile ? (
              <div className="flex items-start gap-4">
                {profile.imageUrl ? (
                  <img
                    src={profile.imageUrl}
                    alt={profile.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-roots-primary"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-roots-primary/10 flex items-center justify-center text-2xl">
                    👤
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-medium text-lg">{profile.name}</p>
                  {profile.bio && <p className="text-roots-gray">{profile.bio}</p>}
                  {profile.email && <p className="text-sm text-roots-gray">{profile.email}</p>}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-roots-gray mb-3">No profile set up yet</p>
                <Button
                  size="sm"
                  onClick={() => setIsEditingProfile(true)}
                  className="bg-roots-primary hover:bg-roots-primary/90"
                >
                  Set Up Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions - Clickable Guide Links */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/ambassador/guide/find-gardeners">
                <div className="p-4 bg-roots-primary/5 rounded-lg hover:bg-roots-primary/10 transition cursor-pointer h-full">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="text-2xl">🌾</span> Find Local Gardeners
                  </h4>
                  <p className="text-sm text-roots-gray">
                    Action plans for recruiting sellers — whether you're local or remote
                  </p>
                </div>
              </Link>

              <Link href="/ambassador/guide/help-register">
                <div className="p-4 bg-roots-secondary/5 rounded-lg hover:bg-roots-secondary/10 transition cursor-pointer h-full">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="text-2xl">📱</span> Help Them Register
                  </h4>
                  <p className="text-sm text-roots-gray">
                    Step-by-step guide to walking someone through seller signup
                  </p>
                </div>
              </Link>

              <Link href="/ambassador/guide/first-listing">
                <div className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition cursor-pointer h-full">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <span className="text-2xl">📸</span> First Listing Support
                  </h4>
                  <p className="text-sm text-roots-gray">
                    Help farmers create listings that sell — photos, pricing, tips
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Ambassador Tier Progress Card */}
        <AmbassadorTierCard
          recruitedSellers={Number(ambassador?.recruitedSellers || 0n)}
          className="mb-8"
        />

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
              <div className="text-3xl font-bold text-amber-600 flex items-center justify-center gap-1">
                <span>🌱</span>
                {seedsData ? formatSeedsAmount(seedsData.total) : '0'}
              </div>
              <div className="text-sm text-roots-gray">Seeds Earned</div>
              {multiplierInfo.isActive && (
                <div className="text-xs text-amber-600 mt-1">
                  {multiplierInfo.multiplierDisplay} active!
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {seedsData ? formatSeedsAmount(seedsData.referrals) : '0'}
              </div>
              <div className="text-sm text-roots-gray">From Referrals</div>
            </CardContent>
          </Card>
        </div>

        {/* Seeds Breakdown Card */}
        <Card className="mb-8 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-2xl">🌱</span> Your Seeds
              {multiplierInfo.isActive && <MultiplierBadge />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-amber-600">
                  {seedsData ? formatSeedsAmount(seedsData.referrals) : '0'}
                </div>
                <div className="text-xs text-roots-gray">Referral Commissions</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {seedsData ? formatSeedsAmount(seedsData.recruitments) : '0'}
                </div>
                <div className="text-xs text-roots-gray">Recruitment Bonuses</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {seedsData ? formatSeedsAmount(seedsData.purchases) : '0'}
                </div>
                <div className="text-xs text-roots-gray">Your Purchases</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {seedsData ? formatSeedsAmount(seedsData.sales) : '0'}
                </div>
                <div className="text-xs text-roots-gray">Your Sales</div>
              </div>
            </div>
            <div className="text-center pt-3 border-t">
              <p className="text-sm text-amber-800">
                Seeds convert to $ROOTS tokens at Phase 2 launch.{' '}
                <Link href="/about/tokenomics" className="underline hover:no-underline">
                  Learn more
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

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
                Share this link with farmers to onboard them. You'll earn <strong>{AMBASSADOR_COMMISSION_PERCENT}% in Seeds</strong> from their sales!
              </p>
              <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">
                🌱 Recruitment bonus: <strong>{AMBASSADOR_RECRUITMENT_BONUS.toLocaleString()} Seeds</strong> when they make their first sale
              </div>
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShareCardData({
                    type: 'recruit-sellers',
                    ambassadorName: profile?.name || '',
                    ambassadorId: ambassadorId?.toString() || '',
                  })}
                >
                  Share
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
                Share this link to recruit more ambassadors. Earn Seeds from your entire network's activity!
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShareCardData({
                    type: 'recruit-ambassadors',
                    ambassadorName: profile?.name || '',
                    ambassadorId: ambassadorId?.toString() || '',
                  })}
                >
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recruited Farmers Activity Widget */}
        <RecruitedFarmersWidget
          address={address}
          onShareListing={(produceName, imageUrl) => setShareCardData({
            type: 'ambassador-listing',
            produceName,
            neighborhood: '',
            imageUrl,
          })}
        />

        {/* Governance Section - Always visible with stats */}
        <Card className="mb-8 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <span>⚖️</span> Ambassador Governance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-roots-gray mb-4">
              Help govern LocalRoots by voting on disputes and reviewing data requests. Earn Seeds for participating.
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-xl font-bold text-roots-primary">
                  {isLoadingGovernance ? '...' : openDisputeCount}
                </div>
                <div className="text-xs text-roots-gray">Open Disputes</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {isLoadingGovernance ? '...' : resolvedDisputes}
                </div>
                <div className="text-xs text-roots-gray">Resolved</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  {isLoadingGovernance ? '...' : activeGovRequestCount}
                </div>
                <div className="text-xs text-roots-gray">Gov Requests</div>
              </div>
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-xl font-bold text-purple-600">
                  {isLoadingGovernance ? '...' : qualifiedVoters}
                </div>
                <div className="text-xs text-roots-gray">Voters</div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid md:grid-cols-2 gap-4">
              <Link href="/ambassador/disputes">
                <div className="p-4 bg-white border rounded-lg hover:border-roots-primary hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <span>🗳️</span> Dispute Resolution
                    </h4>
                    {openDisputeCount > 0 ? (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full animate-pulse">
                        {openDisputeCount} need votes
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        All clear
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-roots-gray">
                    Vote on buyer/seller disputes. <span className="text-amber-600 font-medium">100 Seeds per vote</span>
                  </p>
                </div>
              </Link>
              <Link href="/ambassador/governance">
                <div className="p-4 bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium flex items-center gap-2">
                      <span>🏛️</span> Government Requests
                    </h4>
                    {activeGovRequestCount > 0 ? (
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        {activeGovRequestCount} pending
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        None pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-roots-gray">
                    Review government data access requests.
                  </p>
                </div>
              </Link>
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

      {/* Share Card Modal */}
      <ShareCardModal
        data={shareCardData}
        onClose={() => setShareCardData(null)}
      />
    </div>
  );
}
