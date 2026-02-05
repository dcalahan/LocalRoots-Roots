'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { parseFiatToRoots } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProduceSelector } from './ProduceSelector';
import { ImageUploader } from './ImageUploader';
import { ShareCardModal } from '@/components/ShareCardModal';
import type { ShareCardData } from '@/lib/shareCards';
import { useToast } from '@/hooks/use-toast';
import { useCreateListing } from '@/hooks/useCreateListing';
import { useSellerStatus } from '@/hooks/useSellerStatus';
import { WalletButton } from '@/components/WalletButton';
import { getAllUnits } from '@/lib/produce';
import { uploadImage, uploadMetadata } from '@/lib/pinata';
import type { ProduceItem } from '@/lib/produce';

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

// Helper to get user-friendly error message
function getErrorMessage(error: Error | null): string {
  if (!error) return 'Something went wrong. Please try again.';

  // Log the full error for debugging
  console.error('[CreateListing] Full error:', error);
  console.error('[CreateListing] Error message:', error.message);

  const message = error.message.toLowerCase();

  if (message.includes('not a registered seller')) {
    return 'You need to register as a seller first before creating listings.';
  }
  if (message.includes('seller not active')) {
    return 'Your seller account is not active. Please contact support.';
  }
  if (message.includes('price must be')) {
    return 'Please enter a valid price greater than 0.';
  }
  if (message.includes('quantity must be')) {
    return 'Please enter a valid quantity greater than 0.';
  }
  if (message.includes('user rejected') || message.includes('user denied')) {
    return 'Transaction was cancelled. No changes were made.';
  }
  if (message.includes('insufficient funds')) {
    return 'Insufficient ETH for gas fees. Please add ETH to your wallet.';
  }
  if (message.includes('switch') && message.includes('network')) {
    return 'Please switch your wallet to Base Sepolia network.';
  }
  if (message.includes('eth_estimategas') || message.includes('estimate gas')) {
    return 'Transaction would fail. Please check your wallet is on Base Sepolia and you are registered as a seller.';
  }
  // Be more specific - only match actual chain mismatch, not general network errors
  if (message.includes('chain mismatch') || message.includes('wrong network') || message.includes('switch to')) {
    return 'Please switch your wallet to Base Sepolia network.';
  }

  // Return the actual error for debugging (truncated if too long)
  return error.message.length > 150
    ? error.message.substring(0, 150) + '...'
    : error.message;
}

export function CreateListingForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { authenticated } = usePrivy();
  const { isSeller, isLoading: isCheckingSeller } = useSellerStatus();
  const { createListing, isPending, isSuccess, error, reset } = useCreateListing();

  const units = getAllUnits();

  // Share state
  const [shareCardData, setShareCardData] = useState<ShareCardData | null>(null);

  // Form state
  const [selectedProduce, setSelectedProduce] = useState<ProduceItem | null>(null);
  const [description, setDescription] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitId, setUnitId] = useState('lb');
  const [organic, setOrganic] = useState(false);
  const [growingPractices, setGrowingPractices] = useState('');
  const [imageHash, setImageHash] = useState<string | null>(null);

  // Handle errors from hook
  useEffect(() => {
    if (error) {
      const friendlyMessage = getErrorMessage(error);
      toast({
        title: 'Unable to create listing',
        description: friendlyMessage,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Handle success from hook
  useEffect(() => {
    if (isSuccess) {
      toast({
        title: 'Listing created!',
        description: 'Your produce has been added to the marketplace.',
      });
    }
  }, [isSuccess, toast]);

  const isFormValid =
    selectedProduce !== null &&
    pricePerUnit.trim().length > 0 &&
    parseFloat(pricePerUnit) > 0 &&
    quantity > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authenticated) {
      toast({
        title: 'Not logged in',
        description: 'Please log in to create a listing.',
        variant: 'destructive',
      });
      return;
    }

    if (!isFormValid || !selectedProduce) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const selectedUnit = units.find((u) => u.id === unitId);

      // Upload image to IPFS if it's a base64 data URL
      let imageIpfsHash: string | undefined;
      if (imageHash && imageHash.startsWith('data:')) {
        toast({
          title: 'Uploading image...',
          description: 'Saving your photo to IPFS',
        });
        const imageFile = dataUrlToFile(imageHash, `listing-${Date.now()}.jpg`);
        const imageResult = await uploadImage(imageFile);
        imageIpfsHash = imageResult.ipfsHash;
        console.log('[CreateListing] Image uploaded to IPFS:', imageIpfsHash);
      } else if (imageHash) {
        // It's already a URL or IPFS hash
        imageIpfsHash = imageHash;
      }

      // Create metadata object
      const metadata = {
        produceId: selectedProduce.id,
        produceName: selectedProduce.name,
        category: selectedProduce.category,
        description: description || undefined,
        unitId,
        unitName: selectedUnit?.name || unitId,
        images: imageIpfsHash ? [imageIpfsHash] : [],
        organic,
        growingPractices: growingPractices || undefined,
        createdAt: new Date().toISOString(),
      };

      // Upload metadata to IPFS
      toast({
        title: 'Uploading metadata...',
        description: 'Saving listing details to IPFS',
      });
      const metadataResult = await uploadMetadata(
        metadata,
        `listing-${selectedProduce.id}-${Date.now()}.json`
      );
      const metadataIpfs = `ipfs://${metadataResult.ipfsHash}`;
      console.log('[CreateListing] Metadata uploaded to IPFS:', metadataIpfs);

      // Convert USD price to ROOTS tokens
      const priceInRoots = parseFiatToRoots(pricePerUnit, 'USD');

      // Call the blockchain with just the IPFS hash
      toast({
        title: 'Creating listing...',
        description: 'Confirm the transaction in your wallet',
      });
      await createListing({
        pricePerUnit: priceInRoots,
        quantityAvailable: quantity,
        metadataIpfs,
      });
    } catch (err) {
      console.error('Create listing error:', err);
      // Show error toast for IPFS upload failures
      if (err instanceof Error && err.message.includes('IPFS')) {
        toast({
          title: 'Upload failed',
          description: err.message,
          variant: 'destructive',
        });
      }
    }
  };

  const resetForm = () => {
    setSelectedProduce(null);
    setDescription('');
    setPricePerUnit('');
    setQuantity(1);
    setUnitId('lb');
    setOrganic(false);
    setGrowingPractices('');
    setImageHash(null);
    reset(); // Reset the hook state
  };

  // Show loading while checking seller status
  if (isCheckingSeller) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-roots-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-roots-gray">Checking seller status...</p>
        </CardContent>
      </Card>
    );
  }

  // Show message if not a registered seller
  if (authenticated && !isSeller) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-heading font-bold mb-2">
            Register First
          </h3>
          <p className="text-roots-gray mb-4">
            You need to create your seller profile before you can add listings.
          </p>
          <Link href="/sell/register">
            <Button className="bg-roots-primary hover:bg-roots-primary/90">
              Create Seller Profile
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Handle successful listing creation
  if (isSuccess) {
    return (
      <>
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
              Listing Created!
            </h3>
            <p className="text-roots-gray mb-4">
              Your {selectedProduce?.name} listing is now live on the marketplace!
            </p>
            <p className="text-sm text-roots-gray mb-4">
              Tell your neighbors about it!
            </p>
            <div className="flex flex-col gap-3">
              <Button
                className="w-full bg-roots-secondary hover:bg-roots-secondary/90"
                onClick={() => setShareCardData({
                  type: 'seller-listing',
                  produceName: selectedProduce?.name || '',
                  price: pricePerUnit ? `$${pricePerUnit}/${unitId}` : '',
                  sellerName: '',
                  neighborhood: '',
                  imageUrl: imageHash && !imageHash.startsWith('data:')
                    ? (imageHash.startsWith('http') ? imageHash : `https://gateway.pinata.cloud/ipfs/${imageHash}`)
                    : undefined,
                })}
              >
                Share Listing
              </Button>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={resetForm}
                >
                  Add Another
                </Button>
                <Button onClick={() => router.push('/sell/dashboard')} className="bg-roots-primary">
                  View Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <ShareCardModal
          data={shareCardData}
          onClose={() => setShareCardData(null)}
        />
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Add Produce Listing</CardTitle>
          <CardDescription>
            What are you growing? Add it to your store.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Produce Selection */}
          <div>
            <Label className="mb-3 block">What are you selling? *</Label>
            <ProduceSelector
              onSelect={setSelectedProduce}
              selectedId={selectedProduce?.id}
            />
          </div>

          {/* Listing Details */}
          {selectedProduce && (
            <>
              <div className="pt-4 border-t">
                <Label htmlFor="description">Tell buyers about it (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Picked fresh this morning, great for salads..."
                  className="mt-1"
                  rows={2}
                />
              </div>

              <ImageUploader
                onUpload={setImageHash}
                currentHash={imageHash || undefined}
                label="Add a Photo"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price *</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      $
                    </span>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      placeholder="0.00"
                      className="pl-7"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="unit">Per</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="quantity">How many do you have? *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-32"
                  required
                />
              </div>

              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Naturally Grown</p>
                    <p className="text-sm text-roots-gray">
                      No synthetic pesticides or fertilizers
                    </p>
                  </div>
                  <Switch checked={organic} onCheckedChange={setOrganic} />
                </div>

                {organic && (
                  <div>
                    <Label htmlFor="practices">Growing practices (optional)</Label>
                    <Input
                      id="practices"
                      value={growingPractices}
                      onChange={(e) => setGrowingPractices(e.target.value)}
                      placeholder="e.g., No-till, companion planting, hand-weeded..."
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Login Prompt */}
          {!authenticated && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 mb-3">
                Log in to create a listing on the blockchain.
              </p>
              <WalletButton />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/sell/dashboard')}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || isPending || !authenticated}
              className="flex-1 bg-roots-primary hover:bg-roots-primary/90"
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
                  Creating...
                </>
              ) : !authenticated ? (
                'Log In'
              ) : (
                'Create Listing'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
