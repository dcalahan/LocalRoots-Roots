'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUploader } from '@/components/seller/ImageUploader';
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
  const { user, authenticated: isConnected, login } = usePrivy();

  // Get referral from URL params
  const refParam = searchParams.get('ref');
  const [uplineId, setUplineId] = useState<bigint | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  // Pre-fill email from Privy user (only once)
  const emailPrefilled = useRef(false);
  useEffect(() => {
    if (user?.email?.address && !emailPrefilled.current) {
      emailPrefilled.current = true;
      setEmail(user.email.address);
    }
  }, [user?.email?.address]);

  // Check if already an ambassador
  const { isAmbassador, isLoading: isCheckingStatus } = useAmbassadorStatus();

  // Get upline ambassador details
  const { ambassador: uplineAmbassador, isLoading: isLoadingUpline, error: uplineError } = useAmbassadorById(uplineId);

  // Get upline ambassador profile from IPFS
  const { profile: uplineProfile, isLoading: isLoadingUplineProfile } = useAmbassadorProfile(uplineAmbassador?.profileIpfs);

  // IPFS upload hook
  const { uploadJson, uploadFile } = usePinataUpload();

  // Handle image from ImageUploader (receives data URL)
  const handleImageUpload = async (dataUrl: string | null) => {
    if (!dataUrl) {
      setImageUrl('');
      return;
    }

    // If it's already a URL (stock photo or IPFS), use it directly
    if (dataUrl.startsWith('http') || dataUrl.startsWith('/')) {
      setImageUrl(dataUrl);
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
          const uploadedUrl = `https://gateway.pinata.cloud/ipfs/${result.ipfsHash}`;
          setImageUrl(uploadedUrl);
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

  // Registration hook
  const {
    registerAmbassador,
    isPending,
    isSuccess,
    error: registerError,
  } = useRegisterAmbassador();

  // Parse referral param - ambassadors can register independently (uplineId = 0)
  useEffect(() => {
    if (refParam) {
      try {
        const id = BigInt(refParam);
        if (id > 0n) {
          setUplineId(id);
          // Also store in localStorage for seller registration flow
          localStorage.setItem('ambassadorRef', refParam);
        } else {
          // ref=0 means independent registration
          setUplineId(0n);
        }
      } catch {
        console.error('[AmbassadorRegister] Invalid ref param:', refParam);
        // Fall back to independent registration
        setUplineId(0n);
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
      // No referral - register independently (uplineId = 0)
      setUplineId(0n);
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
      // Set flag to prevent dashboard redirect before data is indexed
      sessionStorage.setItem('just_registered_ambassador', 'true');
      router.push('/ambassador/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, router]);

  // Handle errors
  useEffect(() => {
    if (registerError) {
      toast({
        title: 'Registration failed',
        description: registerError.message || 'Please try again.',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerError]);


  // The actual registration submission (called after login is confirmed)
  const handleRegistrationSubmit = async () => {
    if (uplineId === null || !isConnected) return;

    setIsUploadingProfile(true);

    try {
      // Create ambassador profile
      const profile: AmbassadorProfile = {
        name: name.trim(),
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        imageUrl: imageUrl || undefined,
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

  // Handle button click - validate and either submit or trigger login
  const handleRegister = async () => {
    // uplineId can be 0n for independent registration, or null if still loading
    if (uplineId === null) {
      toast({
        title: 'Please wait',
        description: 'Still loading registration details...',
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

    if (!email.trim() || !email.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address to continue.',
        variant: 'destructive',
      });
      return;
    }

    // If already connected, submit directly
    if (isConnected) {
      await handleRegistrationSubmit();
      return;
    }

    // If not connected, trigger Privy login - user will click button again after login
    login({ prefill: { type: 'email', value: email.trim() } });
  };

  // Loading state
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-roots-cream flex items-center justify-center">
        <div className="animate-pulse text-roots-gray">Loading...</div>
      </div>
    );
  }

  // Check if registering independently (no referral/upline)
  const isIndependentRegistration = uplineId === 0n;

  // Invalid upline (but not if we're registering independently or still loading)
  if (!isIndependentRegistration && (uplineError || (uplineAmbassador && !uplineAmbassador.active))) {
    return (
      <div className="min-h-screen bg-roots-cream">
        <div className="max-w-xl mx-auto px-4 py-16">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8">
              <div className="text-6xl mb-4">❌</div>
              <h1 className="text-2xl font-heading font-bold mb-4">Invalid Referral</h1>
              <p className="text-roots-gray mb-6">
                This referral link is not valid. The ambassador may no longer be active.
                You can still register independently without a referral.
              </p>
              <Link href="/ambassador/register">
                <Button variant="outline">Register Without Referral</Button>
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
            ) : isIndependentRegistration ? (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 font-medium">Independent Ambassador Registration</p>
                <p className="text-xs text-green-700 mt-1">
                  You're registering as an independent ambassador. Once registered, you can recruit farmers and other ambassadors to earn rewards!
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

              {/* Profile Picture */}
              <div className="space-y-2">
                <ImageUploader
                  label="Profile Picture (optional)"
                  onUpload={handleImageUpload}
                  currentHash={imageUrl}
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
                <Label htmlFor="email">
                  Email {user?.email?.address ? '(from your login)' : '(optional)'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={user?.email?.address ? 'bg-gray-50' : ''}
                />
                <p className="text-xs text-roots-gray">For Local Roots updates only</p>
              </div>
            </div>

            {/* Show wallet status if connected */}
            {isConnected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  Logged in and ready to register!
                </p>
              </div>
            )}

            {/* Register button */}
            <Button
              onClick={handleRegister}
              disabled={isPending || isLoadingUpline || isUploadingProfile || isUploadingImage || !name.trim() || !email.trim() || !email.includes('@')}
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
              ) : !name.trim() ? (
                'Enter Your Name'
              ) : !email.trim() || !email.includes('@') ? (
                'Enter Your Email'
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
