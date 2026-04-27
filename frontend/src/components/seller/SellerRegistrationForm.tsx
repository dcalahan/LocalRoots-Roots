'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LocationPicker } from './LocationPicker';
import { ImageUploader } from './ImageUploader';
import { useToast } from '@/hooks/use-toast';
import { useRegisterSeller } from '@/hooks/useRegisterSeller';
import { uploadImage, uploadMetadata } from '@/lib/pinata';
import { usePublicGardenProfile } from '@/hooks/usePublicGardenProfile';
import { decodeGeohash, encodeLocation } from '@/lib/geohash';

// Helper to convert base64 data URL to File
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

interface SellerRegistrationFormProps {
  ambassadorId?: bigint | null;
}

export function SellerRegistrationForm({ ambassadorId }: SellerRegistrationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isConnected } = useAccount();
  const { login, authenticated, user: privyUser } = usePrivy();
  const { registerSeller, isPending, isSuccess, error, txHash } = useRegisterSeller();

  // Listing intent — set when user came from a "Sell" button on a My Garden
  // plant card. After successful registration we route them straight to the
  // listing creation flow with the crop pre-filled, instead of the generic
  // success card. Keeps the Sell-from-garden journey one continuous path.
  const listingIntent = searchParams?.get('intent') === 'list'
    ? {
        cropId: searchParams.get('cropId') || '',
        qty: searchParams.get('qty') || '1',
      }
    : null;

  // ─── Existing public garden profile lookup ──────────────────────────
  // If the user already has a public garden profile (set up via /grow/my-garden),
  // pre-fill name / description / photo from it. They've already told us this
  // about their garden — no reason to make them type it again for selling.
  const gardenerUserId = privyUser?.id || null;
  const { profile: existingGardenProfile } = usePublicGardenProfile(gardenerUserId);

  // Privy already has the user's email if they logged in via email auth.
  // Pull it so we can pre-fill the contact field instead of asking for it
  // a second time. Privy's email account is stored on user.email.address.
  const privyEmail = ((privyUser as unknown as { email?: { address?: string } | string })?.email);
  const privyEmailAddress = typeof privyEmail === 'string'
    ? privyEmail
    : (privyEmail?.address || '');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    geohash: string;
    address?: string | null;
  } | null>(null);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(true);
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(10);
  const [profileImageHash, setProfileImageHash] = useState<string | null>(null);
  const [showLocationWarning, setShowLocationWarning] = useState(false);

  // Pre-fill tracking — distinguishes "user typed nothing yet" from "user
  // explicitly cleared and wants a fresh pitch."
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [prefillDismissed, setPrefillDismissed] = useState(false);

  // Apply the pre-fill once when the gardener profile arrives.
  // Only writes into empty fields — never overwrites user input.
  useEffect(() => {
    if (!existingGardenProfile || existingGardenProfile.hidden) return;
    if (prefillApplied || prefillDismissed) return;
    if (name || description || profileImageHash) return; // user already typed something

    if (existingGardenProfile.displayName) setName(existingGardenProfile.displayName);
    if (existingGardenProfile.bio) setDescription(existingGardenProfile.bio);
    // Prefer the garden photo (what neighbors actually want to see) over the avatar
    const photoIpfs = existingGardenProfile.gardenPhotoIpfs || existingGardenProfile.profilePhotoIpfs;
    if (photoIpfs) setProfileImageHash(photoIpfs);

    // Pre-fill approximate location from the gardener profile's geohash5
    // (~5km cell — privacy-preserving, no street-level data exposed).
    // Skips the "Your location helps buyers find you!" warning entirely.
    // User can hit "Update Location" to refine to exact GPS for the
    // navigable pickup address.
    if (existingGardenProfile.geohash5 && !location) {
      try {
        const decoded = decodeGeohash(existingGardenProfile.geohash5);
        // Re-encode at the seller's standard precision so the on-chain
        // geohash matches the format the rest of the marketplace uses.
        const sellerGeohash = encodeLocation(decoded.latitude, decoded.longitude);
        setLocation({
          latitude: decoded.latitude,
          longitude: decoded.longitude,
          geohash: sellerGeohash,
          // No street address yet — user can hit "Update Location" for GPS,
          // OR type their pickup address manually below.
          address: null,
        });
      } catch {
        /* malformed geohash — skip, user can set location manually */
      }
    }

    setPrefillApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingGardenProfile]);

  const handleStartFresh = () => {
    setName('');
    setDescription('');
    setProfileImageHash(null);
    setLocation(null);
    setPrefillApplied(false);
    setPrefillDismissed(true);
  };

  // Pre-fill email from Privy once it's available. Doesn't overwrite if
  // the user has already typed something different (e.g. they want orders
  // routed to a different inbox than their login email).
  useEffect(() => {
    if (privyEmailAddress && !email) {
      setEmail(privyEmailAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privyEmailAddress]);

  // Auto-fill the Pickup location from the reverse-geocoded address when
  // the user clicks "Get My Location." Only writes if the field is still
  // empty — never overwrites what the user typed. Buyers paste this
  // straight into Google Maps / Waze, so a real address (not coords)
  // matters.
  useEffect(() => {
    if (location?.address && !pickupAddress.trim()) {
      setPickupAddress(location.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.address]);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Registration successful!',
        description: 'You are now a registered seller on Local Roots.',
      });
      // Clear ambassador referral from localStorage
      localStorage.removeItem('ambassadorRef');

      // If they came from My Garden via a Sell button, take them straight
      // to the listing creation flow with the crop pre-filled. Don't show
      // the generic success card — keep the path continuous.
      if (listingIntent && listingIntent.cropId) {
        const params = new URLSearchParams({
          source: 'garden',
          crop: listingIntent.cropId,
          qty: listingIntent.qty,
        });
        router.push(`/sell/listings/new?${params.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // For MVP, location is optional - we can collect it later
  // Pickup address is required if offering pickup
  const isFormValid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    (offersDelivery || offersPickup) &&
    (!offersPickup || pickupAddress.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // If not connected, trigger Privy login with the email from the form
    // User will need to click submit again after login
    if (!authenticated) {
      login({ prefill: { type: 'email', value: email.trim() } });
      return;
    }

    // Show warning if location not set
    if (!location && !showLocationWarning) {
      setShowLocationWarning(true);
      return;
    }

    setShowLocationWarning(false);

    try {
      // Upload profile image to IPFS if it's a base64 data URL
      let finalImageUrl = profileImageHash;
      if (profileImageHash && profileImageHash.startsWith('data:')) {
        toast({
          title: 'Uploading image...',
          description: 'Saving your photo to IPFS',
        });
        const imageFile = dataUrlToFile(profileImageHash, `profile-${Date.now()}.jpg`);
        const imageResult = await uploadImage(imageFile);
        finalImageUrl = imageResult.ipfsHash;
        console.log('[Registration] Image uploaded to IPFS:', finalImageUrl);
      }

      // Create metadata JSON
      const metadata: Record<string, any> = {
        name,
        description,
        email,
        phone,
        imageUrl: finalImageUrl,
        createdAt: new Date().toISOString(),
      };

      // Include pickup address if offering pickup
      if (offersPickup && pickupAddress.trim()) {
        metadata.address = pickupAddress.trim();
      }

      // Include ambassador referral if present
      if (ambassadorId) {
        metadata.ambassadorId = ambassadorId.toString();
        console.log('[Registration] Including ambassador referral:', ambassadorId.toString());
      }

      // Upload metadata to IPFS
      toast({
        title: 'Uploading profile...',
        description: 'Saving your profile to IPFS',
      });
      const metadataResult = await uploadMetadata(metadata, `profile-${Date.now()}.json`);
      const storefrontIpfs = `ipfs://${metadataResult.ipfsHash}`;
      console.log('[Registration] Metadata uploaded to IPFS:', storefrontIpfs);

      // Use a default geohash if location not set
      const geohash = location?.geohash || '9q8yyk8y'; // Default to SF area

      toast({
        title: 'Registering...',
        description: 'Please confirm the transaction',
      });

      await registerSeller({
        geohash,
        storefrontIpfs,
        offersDelivery,
        offersPickup,
        deliveryRadiusKm,
        ambassadorId: ambassadorId ?? undefined,
      });
    } catch (err) {
      console.error('Registration error:', err);
      toast({
        title: 'Registration failed',
        description: err instanceof Error ? err.message : 'Failed to upload to IPFS',
        variant: 'destructive',
      });
    }
  };

  // Success state
  if (isSuccess) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-roots-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-roots-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-xl font-heading font-bold mb-2">
            Welcome to Local Roots!
          </h3>
          <p className="text-roots-gray mb-4">
            We&apos;ve received your information and your seller profile is being set up.
          </p>
          <p className="text-sm text-roots-gray mb-6">
            You can now start adding your produce listings. We&apos;ll reach out to{' '}
            <strong>{email}</strong> if we need anything else.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => router.push('/sell/dashboard')} variant="outline">
              View Dashboard
            </Button>
            <Button onClick={() => router.push('/sell/listings/new')} className="bg-roots-primary">
              Add Your First Listing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Create Your Seller Profile</CardTitle>
          <CardDescription>
            Tell your neighbors about your garden. This takes about 2 minutes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pre-fill notice — shown when we've populated fields from the
              user's existing public garden profile. Lets them know where
              the data came from and offers an easy escape hatch if they
              want a different pitch for selling vs. their public profile. */}
          {prefillApplied && !prefillDismissed && (
            <div className="bg-roots-secondary/10 border border-roots-secondary/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🌱</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-roots-secondary">
                    Using your public garden profile
                  </p>
                  <p className="text-xs text-roots-gray mt-1 leading-relaxed">
                    We've pre-filled your garden name, description, and photo from your
                    {' '}<a href="/grow/my-garden" className="underline">public garden profile</a>.
                    Edit anything below — or{' '}
                    <button
                      type="button"
                      onClick={handleStartFresh}
                      className="text-roots-primary underline font-medium"
                    >
                      start fresh
                    </button>
                    {' '}if you'd like a different pitch for selling.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">What should we call your garden? *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Smith Family Garden, Mary's Backyard Farm"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Tell neighbors about what you grow *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="I've been growing vegetables in my backyard for 15 years. I specialize in heirloom tomatoes and peppers..."
                className="mt-1"
                rows={3}
                required
              />
            </div>

            <ImageUploader
              onUpload={(hash) => setProfileImageHash(hash)}
              currentHash={profileImageHash || undefined}
              label="Add a photo (your garden, your produce, or yourself)"
            />
          </div>

          {/* Location */}
          <div className="pt-4 border-t">
            <Label className="mb-3 block">Where are you located? (optional)</Label>
            <LocationPicker
              onLocationSelect={setLocation}
              initialGeohash={location?.geohash}
            />
            <p className="text-xs text-roots-gray mt-2">
              {location && !location.address
                ? "We're using your approximate location from your garden profile. Tap \"Update Location\" to share an exact street address — buyers will only see it after they place an order."
                : 'This helps buyers find you. You can add this later if you prefer.'}
            </p>
          </div>

          {/* Delivery Options */}
          <div className="pt-4 border-t space-y-4">
            <Label className="block">How will buyers get their produce? *</Label>

            <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
              offersPickup
                ? 'bg-roots-primary/10 border-roots-primary'
                : 'bg-white border-roots-gray/40 hover:border-roots-gray/70'
            }`}>
              <div>
                <p className="font-medium">Pickup from my place</p>
                <p className="text-sm text-roots-gray">
                  Buyers come to you
                </p>
              </div>
              <Switch
                checked={offersPickup}
                onCheckedChange={setOffersPickup}
              />
            </div>

            {offersPickup && (
              <div className="pl-4">
                <Label htmlFor="pickupAddress">Pickup location *</Label>
                <Input
                  id="pickupAddress"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="e.g., 123 Oak Street or Corner of Oak and Main"
                  className="mt-1"
                  required
                />
                <p className="text-xs text-roots-gray mt-1">
                  Where should buyers meet you? This will be shown to buyers after they order.
                </p>
              </div>
            )}

            <div className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
              offersDelivery
                ? 'bg-roots-primary/10 border-roots-primary'
                : 'bg-white border-roots-gray/40 hover:border-roots-gray/70'
            }`}>
              <div>
                <p className="font-medium">I can deliver</p>
                <p className="text-sm text-roots-gray">
                  You bring it to them
                </p>
              </div>
              <Switch
                checked={offersDelivery}
                onCheckedChange={setOffersDelivery}
              />
            </div>

            {offersDelivery && (
              <div className="pl-4">
                <Label htmlFor="radius">How far will you deliver? (miles)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={Math.round(deliveryRadiusKm * 0.621371)}
                  onChange={(e) => setDeliveryRadiusKm(Math.round(Number(e.target.value) / 0.621371))}
                  min={1}
                  max={30}
                  className="mt-1 w-24"
                />
              </div>
            )}

            {!offersPickup && !offersDelivery && (
              <p className="text-sm text-red-600">
                Please select at least one option.
              </p>
            )}
          </div>

          {/* Contact Info */}
          <div className="pt-4 border-t space-y-4">
            <Label className="block">How can we reach you?</Label>

            <div>
              <Label htmlFor="email">Email address *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1"
                required
              />
              <p className="text-xs text-roots-gray mt-1">
                {privyEmailAddress && email === privyEmailAddress
                  ? 'From your login — change this if you want orders sent to a different inbox.'
                  : "We'll send order notifications here"}
              </p>
            </div>

            <div>
              <Label htmlFor="phone">Phone number (optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="mt-1"
              />
              <p className="text-xs text-roots-gray mt-1">
                For coordinating pickups/deliveries with buyers
              </p>
            </div>
          </div>

          {/* Location Warning — stacks vertically on mobile so neither button
              gets clipped off-screen on narrow viewports. */}
          {showLocationWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <p className="text-sm text-amber-800 font-medium">
                Your location helps buyers find you
              </p>
              <p className="text-sm text-amber-700">
                Without it, your listings won&apos;t appear in local searches. Are you sure you want to continue?
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setShowLocationWarning(false)}
                  className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto"
                >
                  Go back and add location
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100 w-full sm:w-auto"
                >
                  Continue without location
                </Button>
              </div>
            </div>
          )}

          {/* Show status if logged in */}
          {authenticated && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                Logged in and ready to register!
              </p>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!isFormValid || isPending}
            className="w-full bg-roots-primary hover:bg-roots-primary/90"
          >
            {isPending ? (
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
                Registering on blockchain...
              </>
            ) : (
              'Create My Seller Profile'
            )}
          </Button>

          <p className="text-xs text-center text-roots-gray">
            By signing up, you agree to our Terms of Service. We&apos;ll never
            share your contact info with anyone.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
