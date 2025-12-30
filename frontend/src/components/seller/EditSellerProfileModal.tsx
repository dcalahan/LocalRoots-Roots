'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ImageUploader } from './ImageUploader';
import { useUpdateSeller } from '@/hooks/useUpdateSeller';
import { useToast } from '@/hooks/use-toast';
import { useUserPreferences } from '@/contexts/UserPreferencesContext';
import { fromKm, toKm, getUnitLabel } from '@/lib/distance';
import { uploadImage, uploadMetadata } from '@/lib/pinata';
import type { SellerProfile } from '@/hooks/useSellerProfile';

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

interface EditSellerProfileModalProps {
  profile: SellerProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditSellerProfileModal({ profile, onClose, onSuccess }: EditSellerProfileModalProps) {
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const { updateSeller, isPending, isSuccess, error, reset } = useUpdateSeller();

  const distanceUnit = preferences.distanceUnit;

  const [name, setName] = useState(profile.metadata?.name || '');
  const [description, setDescription] = useState(profile.metadata?.description || '');
  const [imageUrl, setImageUrl] = useState<string | null>(profile.metadata?.imageUrl || null);
  const [offersDelivery, setOffersDelivery] = useState(profile.offersDelivery);
  const [offersPickup, setOffersPickup] = useState(profile.offersPickup);
  // Store display value (converted from km)
  const [deliveryRadius, setDeliveryRadius] = useState(
    Math.round(fromKm(profile.deliveryRadiusKm, distanceUnit))
  );

  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Profile updated',
        description: 'Your seller profile has been updated.',
      });
      onSuccess();
      onClose();
    }
  }, [isSuccess, toast, onSuccess, onClose]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Update failed',
        description: error.message || 'Could not update profile. Please try again.',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Upload image to IPFS if it's a base64 data URL
      let finalImageUrl = imageUrl;
      if (imageUrl && imageUrl.startsWith('data:')) {
        toast({
          title: 'Uploading image...',
          description: 'Saving your photo to IPFS',
        });
        const imageFile = dataUrlToFile(imageUrl, `profile-${Date.now()}.jpg`);
        const imageResult = await uploadImage(imageFile);
        finalImageUrl = imageResult.ipfsHash;
        console.log('[EditProfile] Image uploaded to IPFS:', finalImageUrl);
      }

      // Build storefront metadata
      const metadata = {
        name,
        description,
        imageUrl: finalImageUrl,
      };

      // Upload metadata to IPFS
      toast({
        title: 'Uploading profile...',
        description: 'Saving your profile to IPFS',
      });
      const metadataResult = await uploadMetadata(metadata, `profile-${Date.now()}.json`);
      const storefrontIpfs = `ipfs://${metadataResult.ipfsHash}`;
      console.log('[EditProfile] Metadata uploaded to IPFS:', storefrontIpfs);

      // Convert display value back to km for storage
      const deliveryRadiusKm = Math.round(toKm(deliveryRadius, distanceUnit));

      toast({
        title: 'Saving to blockchain...',
        description: 'Please confirm the transaction',
      });

      await updateSeller({
        storefrontIpfs,
        offersDelivery,
        offersPickup,
        deliveryRadiusKm,
        active: profile.active,
      });
    } catch (err) {
      console.error('[EditProfile] Error:', err);
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Failed to upload to IPFS',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b">
            <h2 className="text-xl font-heading font-bold">Edit Profile</h2>
            <p className="text-sm text-roots-gray">Update your seller information</p>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <Label htmlFor="name">Garden/Farm Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Backyard Garden"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell buyers about your garden..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label>Profile Photo</Label>
              <div className="mt-2">
                <ImageUploader
                  onUpload={setImageUrl}
                  currentHash={imageUrl || undefined}
                  label="Upload Photo"
                  showStockPhotos={true}
                />
              </div>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Offer Pickup</p>
                  <p className="text-sm text-roots-gray">Buyers can pick up from your location</p>
                </div>
                <Switch checked={offersPickup} onCheckedChange={setOffersPickup} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Offer Delivery</p>
                  <p className="text-sm text-roots-gray">You can deliver to buyers</p>
                </div>
                <Switch checked={offersDelivery} onCheckedChange={setOffersDelivery} />
              </div>

              {offersDelivery && (
                <div>
                  <Label htmlFor="deliveryRadius">Delivery Radius ({getUnitLabel(distanceUnit)})</Label>
                  <Input
                    id="deliveryRadius"
                    type="number"
                    min={1}
                    max={distanceUnit === 'miles' ? 60 : 100}
                    value={deliveryRadius}
                    onChange={(e) => setDeliveryRadius(Number(e.target.value))}
                    className="mt-1 w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
              disabled={isPending}
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
