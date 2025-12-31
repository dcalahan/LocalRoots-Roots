'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
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
import { WalletButton } from '@/components/WalletButton';
import { uploadImage, uploadMetadata } from '@/lib/pinata';

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
  const { toast } = useToast();
  const { isConnected, address } = useAccount();
  const { registerSeller, isPending, isSuccess, error, txHash } = useRegisterSeller();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    geohash: string;
  } | null>(null);
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [offersPickup, setOffersPickup] = useState(true);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(10);
  const [profileImageHash, setProfileImageHash] = useState<string | null>(null);
  const [showLocationWarning, setShowLocationWarning] = useState(false);

  // Handle success
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Registration successful!',
        description: 'You are now a registered seller on Local Roots.',
      });
      // Clear ambassador referral from localStorage
      localStorage.removeItem('ambassadorRef');
    }
  }, [isSuccess, toast]);

  // Handle errors
  useEffect(() => {
    if (error) {
      toast({
        title: 'Registration failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // For MVP, location is optional - we can collect it later
  const isFormValid =
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    email.trim().length > 0 &&
    email.includes('@') &&
    (offersDelivery || offersPickup);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet to register as a seller.',
        variant: 'destructive',
      });
      return;
    }

    if (!isFormValid) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
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
              label="Add a photo (your garden, your produce, or yourself)"
            />
          </div>

          {/* Location */}
          <div className="pt-4 border-t">
            <Label className="mb-3 block">Where are you located? (optional)</Label>
            <LocationPicker onLocationSelect={setLocation} />
            <p className="text-xs text-roots-gray mt-2">
              This helps buyers find you. You can add this later if you prefer.
            </p>
          </div>

          {/* Delivery Options */}
          <div className="pt-4 border-t space-y-4">
            <Label className="block">How will buyers get their produce? *</Label>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                We&apos;ll send order notifications here
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

          {/* Location Warning */}
          {showLocationWarning && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
              <p className="text-sm text-amber-800 font-medium">
                Your location helps buyers find you!
              </p>
              <p className="text-sm text-amber-700">
                Without it, your listings won&apos;t appear in local searches. Are you sure you want to continue?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLocationWarning(false)}
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Go back and add location
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="text-amber-600 hover:text-amber-800"
                >
                  Continue without location
                </Button>
              </div>
            </div>
          )}

          {/* Wallet Connection */}
          {!isConnected && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-3">
                Connect your wallet to register as a seller on the blockchain.
              </p>
              <WalletButton />
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!isFormValid || isPending || !isConnected}
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
            ) : !isConnected ? (
              'Connect Wallet to Register'
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
