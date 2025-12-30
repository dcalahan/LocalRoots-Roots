'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WalletButton } from '@/components/WalletButton';
import { useAmbassadorStatus, useAmbassadorById } from '@/hooks/useAmbassadorStatus';
import { useAmbassadorProfile } from '@/hooks/useAmbassadorProfile';
import { useRegisterAmbassador } from '@/hooks/useRegisterAmbassador';
import { usePinataUpload } from '@/hooks/usePinataUpload';
import { useToast } from '@/hooks/use-toast';
import type { AmbassadorProfile } from '@/lib/contracts/ambassador';

function AmbassadorRegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isConnected } = useAccount();

  // Get referral from URL params
  const refParam = searchParams.get('ref');
  const [uplineId, setUplineId] = useState<bigint | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  // Check if already an ambassador
  const { isAmbassador, isLoading: isCheckingStatus } = useAmbassadorStatus();

  // Get upline ambassador details
  const { ambassador: uplineAmbassador, isLoading: isLoadingUpline, error: uplineError } = useAmbassadorById(uplineId);

  // Get upline ambassador profile from IPFS
  const { profile: uplineProfile, isLoading: isLoadingUplineProfile } = useAmbassadorProfile(uplineAmbassador?.profileIpfs);

  // IPFS upload hook
  const { uploadJson } = usePinataUpload();

  // Registration hook
  const {
    registerAmbassador,
    isPending,
    isSuccess,
    error: registerError,
  } = useRegisterAmbassador();

  // Default community founder ID - anyone can join under this if they don't have a referral
  // This should be set to the first State Founder registered in the system
  const DEFAULT_COMMUNITY_UPLINE = 1n;

  // Parse referral param
  useEffect(() => {
    if (refParam) {
      try {
        const id = BigInt(refParam);
        if (id > 0n) {
          setUplineId(id);
          // Also store in localStorage for seller registration flow
          localStorage.setItem('ambassadorRef', refParam);
        }
      } catch {
        console.error('[AmbassadorRegister] Invalid ref param:', refParam);
        // Fall back to community upline
        setUplineId(DEFAULT_COMMUNITY_UPLINE);
      }
    } else {
      // Check localStorage
      const storedRef = localStorage.getItem('ambassadorRef');
      if (storedRef) {
        try {
          const id = BigInt(storedRef);
          if (id > 0n) {
            setUplineId(id);
            return;
          }
        } catch {
          // Invalid stored ref
        }
      }
      // No referral - use default community upline
      setUplineId(DEFAULT_COMMUNITY_UPLINE);
    }
  }, [refParam]);

  // Redirect if already an ambassador
  useEffect(() => {
    if (!isCheckingStatus && isAmbassador) {
      router.push('/ambassador/dashboard');
    }
  }, [isAmbassador, isCheckingStatus, router]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Welcome, Ambassador!',
        description: 'You are now registered as a Local Roots Ambassador.',
      });
      // Clear stored ref
      localStorage.removeItem('ambassadorRef');
      router.push('/ambassador/dashboard');
    }
  }, [isSuccess, toast, router]);

  // Handle errors
  useEffect(() => {
    if (registerError) {
      toast({
        title: 'Registration failed',
        description: registerError.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [registerError, toast]);

  const handleRegister = async () => {
    if (!uplineId) {
      toast({
        title: 'Missing referral',
        description: 'You need a referral link from an existing ambassador to join.',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter your name to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingProfile(true);

    try {
      // Create ambassador profile
      const profile: AmbassadorProfile = {
        name: name.trim(),
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      // Upload profile to IPFS
      const result = await uploadJson(profile as unknown as Record<string, unknown>, `ambassador-${name.trim()}.json`);
      if (!result) {
        throw new Error('Failed to upload profile to IPFS');
      }

      const profileIpfs = `ipfs://${result.ipfsHash}`;
      console.log('[AmbassadorRegister] Profile uploaded:', profileIpfs);

      // Register with profile IPFS hash
      await registerAmbassador(uplineId, profileIpfs);
    } catch (err) {
      console.error('[AmbassadorRegister] Error:', err);
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload profile',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingProfile(false);
    }
  };

  // Loading state
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <div className="animate-pulse text-roots-gray">Loading...</div>
      </div>
    );
  }

  // Check if using default community upline (no specific referral)
  const isUsingDefaultUpline = uplineId === DEFAULT_COMMUNITY_UPLINE && !refParam;

  // Invalid upline (but not if we're still loading or using default)
  if (uplineError || (uplineAmbassador && !uplineAmbassador.active)) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-xl mx-auto px-4 py-16">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-2xl font-heading font-bold mb-4">Invalid Referral</h1>
              <p className="text-roots-gray mb-6">
                This referral link is not valid. The ambassador may no longer be active.
                Please get a new referral link from an active ambassador.
              </p>
              <Link href="/ambassador">
                <Button variant="outline">Learn About Ambassadors</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-roots-cream">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/ambassador"
            className="text-roots-gray hover:text-roots-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="text-5xl mb-2">🌟</div>
            <CardTitle className="text-2xl font-heading">Become an Ambassador</CardTitle>
            <CardDescription>
              Join the Local Roots ambassador network and help build community food resilience
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Upline info */}
            {isLoadingUpline || isLoadingUplineProfile ? (
              <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ) : isUsingDefaultUpline && uplineProfile ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium">
                  Join with {uplineProfile.name}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  You'll be joining under {uplineProfile.name}, our community founder. Once registered, you can recruit farmers and other ambassadors!
                </p>
              </div>
            ) : isUsingDefaultUpline ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium">Join the Local Roots Community</p>
                <p className="text-xs text-green-700 mt-1">
                  You'll be joining under the community founder. Once registered, you can recruit farmers and other ambassadors!
                </p>
              </div>
            ) : uplineAmbassador ? (
              <div className="p-4 bg-roots-primary/5 rounded-lg border border-roots-primary/20">
                <p className="text-sm text-roots-gray mb-1">
                  {uplineProfile?.name ? (
                    `Referred by ${uplineProfile.name}`
                  ) : (
                    `Referred by Ambassador #${uplineId?.toString()}`
                  )}
                </p>
                <p className="text-xs text-roots-gray">
                  Wallet: {uplineAmbassador.wallet.slice(0, 6)}...{uplineAmbassador.wallet.slice(-4)}
                </p>
                {uplineAmbassador.uplineId === 0n && (
                  <p className="text-xs text-roots-primary font-medium mt-1">State Founder</p>
                )}
              </div>
            ) : null}

            {/* Benefits summary */}
            <div className="space-y-3">
              <h3 className="font-medium">As an Ambassador, you'll:</h3>
              <ul className="space-y-2 text-sm text-roots-gray">
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary">✓</span>
                  <span>Earn 25% of sales from farmers you onboard for 1 year</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary">✓</span>
                  <span>Get your own referral link to recruit more ambassadors</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-roots-primary">✓</span>
                  <span>Help build local food resilience in your community</span>
                </li>
              </ul>
            </div>

            {/* Profile form */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium">Your Ambassador Profile</h3>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (optional)</Label>
                <Input
                  id="bio"
                  type="text"
                  placeholder="Tell us about yourself"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-roots-gray">For Local Roots updates only</p>
              </div>
            </div>

            {/* Wallet connection */}
            {!isConnected ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 mb-3">
                  Connect your wallet to register as an ambassador
                </p>
                <WalletButton />
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  Wallet connected. Ready to register!
                </p>
              </div>
            )}

            {/* Register button */}
            <Button
              onClick={handleRegister}
              disabled={!isConnected || isPending || isLoadingUpline || isUploadingProfile || !name.trim()}
              className="w-full bg-roots-primary hover:bg-roots-primary/90"
            >
              {isPending || isUploadingProfile ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {isUploadingProfile ? 'Uploading profile...' : 'Registering...'}
                </>
              ) : !isConnected ? (
                'Connect Wallet to Register'
              ) : !name.trim() ? (
                'Enter Your Name to Continue'
              ) : (
                'Become an Ambassador'
              )}
            </Button>

            <p className="text-xs text-center text-roots-gray">
              By registering, you agree to help grow local food production
              and maintain the integrity of the marketplace.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-roots-cream flex items-center justify-center">
      <div className="animate-pulse text-roots-gray">Loading...</div>
    </div>
  );
}

export default function AmbassadorRegisterPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AmbassadorRegisterContent />
    </Suspense>
  );
}
